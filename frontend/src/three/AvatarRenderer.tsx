import { useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnifiedFKData, RootPosition, UNIFIED_JOINT_NAMES } from '@/types/pose';
import { JOINT_TO_BONE_MAP, MIXAMO_BONES } from './boneMapping';

const AVATAR_GLB_PATH = '/src/avatars/skeleton.glb';
const SMOOTHING_FACTOR = 0.3; // 0 = no smoothing, 1 = no lag

// Arm chain: LeftShoulder/RightShoulder bone sits between Spine2 and Arm in Mixamo
// but the FK chain skips it, so all arm descendants need conjugation by the
// intermediate bone's initial rotation.
const INTERMEDIATE_BONE_MAP: Record<string, string> = {
  [MIXAMO_BONES.LEFT_ARM]: MIXAMO_BONES.LEFT_SHOULDER,
  [MIXAMO_BONES.LEFT_FOREARM]: MIXAMO_BONES.LEFT_SHOULDER,
  [MIXAMO_BONES.LEFT_HAND]: MIXAMO_BONES.LEFT_SHOULDER,
  [MIXAMO_BONES.RIGHT_ARM]: MIXAMO_BONES.RIGHT_SHOULDER,
  [MIXAMO_BONES.RIGHT_FOREARM]: MIXAMO_BONES.RIGHT_SHOULDER,
  [MIXAMO_BONES.RIGHT_HAND]: MIXAMO_BONES.RIGHT_SHOULDER,
  // Thigh bones: conjugated by Hips only (same frame level as FK hipCentre)
  [MIXAMO_BONES.LEFT_UP_LEG]: MIXAMO_BONES.HIPS,
  [MIXAMO_BONES.RIGHT_UP_LEG]: MIXAMO_BONES.HIPS,
};

// Deeper leg bones (knee and below) need conjugation by their parent's accumulated
// T-pose world quaternion to transform FK rotations into each bone's local frame.
const LEG_CONJUGATION_BONES = new Set([
  MIXAMO_BONES.LEFT_LEG, MIXAMO_BONES.LEFT_FOOT, MIXAMO_BONES.LEFT_TOE_BASE,
  MIXAMO_BONES.RIGHT_LEG, MIXAMO_BONES.RIGHT_FOOT, MIXAMO_BONES.RIGHT_TOE_BASE,
]);

// All leg bones need Z-axis rotation negated: FK Z=backward but Mixamo leg bone
// local Z=forward, so Z-axis rotations (abduction/adduction) appear inverted.
const LEG_Z_NEGATE_BONES: Set<string> = new Set([
  MIXAMO_BONES.LEFT_UP_LEG, MIXAMO_BONES.RIGHT_UP_LEG,
  MIXAMO_BONES.LEFT_LEG, MIXAMO_BONES.LEFT_FOOT, MIXAMO_BONES.LEFT_TOE_BASE,
  MIXAMO_BONES.RIGHT_LEG, MIXAMO_BONES.RIGHT_FOOT, MIXAMO_BONES.RIGHT_TOE_BASE,
]);

interface AvatarRendererProps {
  fkData: UnifiedFKData | null;
  rootPosition?: RootPosition | null;
  scale?: number;
  visibilityThreshold?: number;
}

export function AvatarRenderer({
  fkData,
  rootPosition,
  scale = 1,
  visibilityThreshold = 0.8,
}: AvatarRendererProps) {
  const gltf = useGLTF(AVATAR_GLB_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const bonesRef = useRef<Map<string, THREE.Bone>>(new Map());
  const initialRotationsRef = useRef<Map<string, THREE.Quaternion>>(new Map());
  const initialScalesRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const modelRef = useRef<THREE.Object3D | null>(null);
  const isInitializedRef = useRef(false);
  const prevQuaternionsRef = useRef<Map<string, THREE.Quaternion>>(new Map());
  const prevPositionRef = useRef<THREE.Vector3>(new THREE.Vector3());
  // Pre-computed inverse initial rotations for intermediate bones
  const intermediateInverseRef = useRef<Map<string, THREE.Quaternion>>(new Map());
  const intermediateRotationRef = useRef<Map<string, THREE.Quaternion>>(new Map());

  useEffect(() => {
    if (isInitializedRef.current || !groupRef.current) return;

    const model = gltf.scene;
    const bones = new Map<string, THREE.Bone>();
    const initialRotations = new Map<string, THREE.Quaternion>();
    const initialScales = new Map<string, THREE.Vector3>();

    model.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;

        if (object.skeleton) {
          object.skeleton.bones.forEach((bone) => {
            if (!bones.has(bone.name)) {
              bones.set(bone.name, bone);
              initialRotations.set(bone.name, bone.quaternion.clone());
              initialScales.set(bone.name, bone.scale.clone());
            }
          });
        }
      }
    });

    // Pre-compute inverse rotations for intermediate bones (arm chain)
    const intermediateInverse = new Map<string, THREE.Quaternion>();
    const intermediateRotation = new Map<string, THREE.Quaternion>();
    for (const [mappedBone, intermediateBone] of Object.entries(INTERMEDIATE_BONE_MAP)) {
      const intRotation = initialRotations.get(intermediateBone);
      if (intRotation) {
        intermediateInverse.set(mappedBone, intRotation.clone().invert());
        intermediateRotation.set(mappedBone, intRotation.clone());
      }
    }

    // Leg chain: compute each bone's parent T-pose world quaternion by accumulating
    // initial rotations from root to parent. This correctly transforms FK rotations
    // (computed in the base body frame) into each Mixamo bone's local frame.
    for (const boneName of LEG_CONJUGATION_BONES) {
      const bone = bones.get(boneName);
      if (!bone) continue;

      const parentWorldQuat = new THREE.Quaternion();
      let current: THREE.Object3D | null = bone.parent;
      const chain: THREE.Quaternion[] = [];
      while (current && current instanceof THREE.Bone) {
        const initRot = initialRotations.get(current.name);
        if (initRot) chain.unshift(initRot.clone());
        current = current.parent;
      }
      for (const q of chain) {
        parentWorldQuat.multiply(q);
      }

      intermediateInverse.set(boneName, parentWorldQuat.clone().invert());
      intermediateRotation.set(boneName, parentWorldQuat.clone());
    }

    groupRef.current.add(model);
    modelRef.current = model;
    bonesRef.current = bones;
    initialRotationsRef.current = initialRotations;
    initialScalesRef.current = initialScales;
    intermediateInverseRef.current = intermediateInverse;
    intermediateRotationRef.current = intermediateRotation;
    isInitializedRef.current = true;
        return () => {
      if (groupRef.current && modelRef.current) {
        groupRef.current.remove(modelRef.current);
      }
    };
  }, [gltf.scene]);

  useFrame(() => {
    if (!isInitializedRef.current || !fkData) return;

    const bones = bonesRef.current;
    const initialScales = initialScalesRef.current;
    const initialRotations = initialRotationsRef.current;
    const prevQuaternions = prevQuaternionsRef.current;
    const intermediateInverse = intermediateInverseRef.current;
    const intermediateRotations = intermediateRotationRef.current;

    if (rootPosition) {
      const hipsBone = bones.get(MIXAMO_BONES.HIPS);
      if (hipsBone) {
        const targetPos = new THREE.Vector3(rootPosition.x, rootPosition.y, rootPosition.z);
        prevPositionRef.current.lerp(targetPos, SMOOTHING_FACTOR);
        hipsBone.position.copy(prevPositionRef.current);
      }
    }

    for (const jointName of UNIFIED_JOINT_NAMES) {
      const boneName = JOINT_TO_BONE_MAP[jointName];
      if (!boneName) continue;

      const bone = bones.get(boneName);
      if (!bone) continue;

      const jointData = fkData[jointName];
      const initialScale = initialScales.get(boneName);

      if (!jointData || jointData.visibility === undefined || jointData.visibility < visibilityThreshold) {
        bone.scale.set(1, 1, 1);
      } else {
        if (initialScale) {
          bone.scale.copy(initialScale);
        } else {
          bone.scale.set(1, 1, 1);
        }

        const targetQuat = new THREE.Quaternion(
          jointData.x,
          jointData.y,
          jointData.z,
          jointData.w
        );

        // Negate Z-axis rotation for leg bones: FK Z=backward, Mixamo Z=forward
        if (LEG_Z_NEGATE_BONES.has(boneName)) {
          targetQuat.z = -targetQuat.z;
        }

        // SLERP smoothing: interpolate between previous and target quaternion
        const prevQuat = prevQuaternions.get(boneName);
        let smoothedQuat: THREE.Quaternion;
        if (prevQuat) {
          smoothedQuat = prevQuat.clone().slerp(targetQuat, SMOOTHING_FACTOR);
        } else {
          smoothedQuat = targetQuat.clone();
        }
        prevQuaternions.set(boneName, smoothedQuat.clone());

        const initialRotation = initialRotations.get(boneName);
        const intInv = intermediateInverse.get(boneName);
        const intRot = intermediateRotations.get(boneName);

        if (intInv && intRot && initialRotation) {
          // Conjugate FK quat by the pre-computed intermediate rotation:
          // Arms: R_intermediate^(-1) * fkQuat * R_intermediate * R_initial
          // Legs: R_parentWorld^(-1) * fkQuat * R_parentWorld * R_initial
          const conjugated = intInv.clone().multiply(smoothedQuat).multiply(intRot);
          bone.quaternion.copy(conjugated).multiply(initialRotation);
        } else if (initialRotation) {
          // Other bones: apply FK rotation in bone's local frame
          bone.quaternion.copy(initialRotation).multiply(smoothedQuat);
        } else {
          bone.quaternion.copy(smoothedQuat);
        }
      }
    }

    const mappedBones = new Set(Object.values(JOINT_TO_BONE_MAP));
    bones.forEach((bone, boneName) => {
      if (!mappedBones.has(boneName as any)) {
        const initialRotation = initialRotations.get(boneName);
        const initialScale = initialScales.get(boneName);
        if (initialRotation) bone.quaternion.copy(initialRotation);
        if (initialScale) bone.scale.copy(initialScale);
      }
    });
  });

  if (!fkData) {
    return null;
  }

  return (
    <group ref={groupRef} scale={scale} />
  );
}

useGLTF.preload(AVATAR_GLB_PATH);
