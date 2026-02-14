import { useMemo } from 'react';
import { Line, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { UnifiedJoints, UNIFIED_JOINT_NAMES } from '@/types/pose';
import { POSE_CONNECTIONS } from './connections';

interface StickBallRendererProps {
  joints: UnifiedJoints | null;
  color?: string;
  jointRadius?: number;
  lineWidth?: number;
  visibilityThreshold?: number;
}

export function StickBallRenderer({
  joints,
  color = '#00ff00',
  jointRadius = 0.02,
  lineWidth = 2,
  visibilityThreshold = 0.5,
}: StickBallRendererProps) {
  if (!joints) {
    return null;
  }

  const connections = useMemo(() => {
    return POSE_CONNECTIONS.filter(([startName, endName]) => {
      const startJoint = joints[startName];
      const endJoint = joints[endName];
      return startJoint && endJoint && 
             startJoint.visibility > visibilityThreshold && 
             endJoint.visibility > visibilityThreshold;
    }).map(([startName, endName]) => {
      const start = joints[startName]!;
      const end = joints[endName]!;
      return {
        start: new THREE.Vector3(start.x, -start.y, -start.z),
        end: new THREE.Vector3(end.x, -end.y, -end.z),
      };
    });
  }, [joints, visibilityThreshold]);

  const visibleJoints = useMemo(() => {
    return UNIFIED_JOINT_NAMES
      .map(name => joints[name])
      .filter((joint): joint is NonNullable<typeof joint> => 
        joint !== null && joint !== undefined && joint.visibility > visibilityThreshold
      );
  }, [joints, visibilityThreshold]);

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
      {visibleJoints.map((joint, idx) => (
        <Sphere
          key={`joint-${idx}`}
          args={[jointRadius, 16, 16]}
          position={[joint.x, -joint.y, -joint.z]}
        >
          <meshStandardMaterial color={color} />
        </Sphere>
      ))}
    </group>
  );
}
