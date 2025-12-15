import { useEffect, useRef, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnifiedFKData, RootPosition, UNIFIED_JOINT_NAMES } from '@/types/pose';
import { JOINT_TO_BONE_MAP } from './boneMapping';

const AVATAR_GLB_PATH = '/src/avatars/skeleton.glb';

interface AvatarRendererProps {
  fkData: UnifiedFKData | null;
  rootPosition?: RootPosition | null;
  scale?: number;
  visibilityThreshold?: number;
  debug?: boolean;
}

export function AvatarRenderer({
  fkData,
  rootPosition,
  scale = 1,
  visibilityThreshold = 0.5,
  debug = false,
}: AvatarRendererProps) {
  const { scene } = useGLTF(AVATAR_GLB_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const bonesRef = useRef<Map<string, THREE.Bone>>(new Map());
  const initialRotationsRef = useRef<Map<string, THREE.Quaternion>>(new Map());
  const initialScalesRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    const bones = new Map<string, THREE.Bone>();
    const initialRotations = new Map<string, THREE.Quaternion>();
    const initialScales = new Map<string, THREE.Vector3>();
    
    clone.traverse((object) => {
      if (object instanceof THREE.Bone) {
        bones.set(object.name, object);
        initialRotations.set(object.name, object.quaternion.clone());
        initialScales.set(object.name, object.scale.clone());
      }
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    
    bonesRef.current = bones;
    initialRotationsRef.current = initialRotations;
    initialScalesRef.current = initialScales;
    
    return clone;
  }, [scene]);

  useEffect(() => {
    if (debug && groupRef.current) {
      let skinnedMesh: THREE.SkinnedMesh | null = null;
      clonedScene.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh) {
          skinnedMesh = object;
        }
      });
      
      if (skinnedMesh) {
        const helper = new THREE.SkeletonHelper(skinnedMesh);
        skeletonHelperRef.current = helper;
        groupRef.current.add(helper);
      }
    }
    
    return () => {
      if (skeletonHelperRef.current && groupRef.current) {
        groupRef.current.remove(skeletonHelperRef.current);
        skeletonHelperRef.current = null;
      }
    };
  }, [debug, clonedScene]);

  useFrame(() => {
    if (!fkData) return;

    const bones = bonesRef.current;
    const initialScales = initialScalesRef.current;
    const initialRotations = initialRotationsRef.current;

    if (rootPosition) {
      const hipsBone = bones.get('mixamorig:Hips');
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

      if (!jointData || jointData.visibility < visibilityThreshold) {
        bone.scale.set(0, 0, 0);
      } else {
        if (initialScale) {
          bone.scale.copy(initialScale);
        } else {
          bone.scale.set(1, 1, 1);
        }
        bone.quaternion.set(jointData.x, jointData.y, jointData.z, jointData.w);
      }
    }

    // Keep default pose for bones not in unified joints
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

  if (fkData === null) {
    return null;
  }

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload(AVATAR_GLB_PATH);
