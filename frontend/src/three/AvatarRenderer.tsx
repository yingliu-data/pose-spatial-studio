import { useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnifiedFKData, RootPosition, UNIFIED_JOINT_NAMES } from '@/types/pose';
import { JOINT_TO_BONE_MAP, MIXAMO_BONES } from './boneMapping';

const AVATAR_GLB_PATH = '/src/avatars/skeleton.glb';

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
    
    groupRef.current.add(model);
    modelRef.current = model;
    bonesRef.current = bones;
    initialRotationsRef.current = initialRotations;
    initialScalesRef.current = initialScales;
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

    if (rootPosition) {
      const hipsBone = bones.get(MIXAMO_BONES.HIPS);
      if (hipsBone) {
        hipsBone.position.set(rootPosition.x, rootPosition.y, rootPosition.z);
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
        
        const fkQuat = new THREE.Quaternion(
          jointData.x,
          jointData.y,
          jointData.z,
          jointData.w
        );
        
        const initialRotation = initialRotations.get(boneName);
        if (initialRotation) {
          bone.quaternion.copy(initialRotation).multiply(fkQuat);
        } else {
          bone.quaternion.copy(fkQuat);
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
