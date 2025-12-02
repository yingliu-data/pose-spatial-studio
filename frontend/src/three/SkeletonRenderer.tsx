import { useMemo } from 'react';
import { Line, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { Landmark } from '@/types/pose';
import { POSE_CONNECTIONS } from './connections';

interface SkeletonRendererProps {
  landmarks: Landmark[];
  color?: string;
  jointRadius?: number;
  lineWidth?: number;
}

export function SkeletonRenderer({
  landmarks,
  color = '#00ff00',
  jointRadius = 0.02,
  lineWidth = 2,
}: SkeletonRendererProps) {
  if (!landmarks || landmarks.length === 0) {
    return null;
  }

  const connections = useMemo(() =>
    POSE_CONNECTIONS.filter(([start, end]) =>
      start < landmarks.length && end < landmarks.length &&
      landmarks[start].visibility > 0.5 && landmarks[end].visibility > 0.5
    ).map(([start, end]) => ({
      start: new THREE.Vector3(landmarks[start].x, -landmarks[start].y, -landmarks[start].z),
      end: new THREE.Vector3(landmarks[end].x, -landmarks[end].y, -landmarks[end].z),
    })), [landmarks]);

  const visibleJoints = useMemo(() => 
    landmarks.filter((lm) => lm.visibility > 0.5), [landmarks]);

  return (
    <group>
      {connections.map((conn, idx) => (
        <Line
          key={`line-${idx}`}
          points={[conn.start, conn.end]}
          color={color}
          lineWidth={lineWidth}
        />
      ))}
      {visibleJoints.map((lm, idx) => (
        <Sphere
          key={`joint-${idx}`}
          args={[jointRadius, 16, 16]}
          position={[lm.x, -lm.y, -lm.z]}
        >
          <meshStandardMaterial color={color} />
        </Sphere>
      ))}
    </group>
  );
}

