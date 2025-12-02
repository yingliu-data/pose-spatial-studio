import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface VideoPlaneProps {
  videoElement?: HTMLVideoElement | null;
  canvasElement?: HTMLCanvasElement | null;
  width?: number;
  height?: number;
  position?: [number, number, number];
}

export function VideoPlane({ 
  videoElement, 
  canvasElement,
  width = 2, 
  height = 1.5, 
  position = [0, 0, -0.5] 
}: VideoPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    if (canvasElement) {
      const texture = new THREE.CanvasTexture(canvasElement);
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.format = THREE.RGBAFormat;
      textureRef.current = texture;
    } else if (videoElement) {
      const texture = new THREE.VideoTexture(videoElement);
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.format = THREE.RGBAFormat;
      textureRef.current = texture;
    }
  }, [videoElement, canvasElement]);

  useFrame(() => {
    if (textureRef.current && meshRef.current) {
      textureRef.current.needsUpdate = true;
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.map = textureRef.current;
      material.needsUpdate = true;
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={[0, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0.7} />
    </mesh>
  );
}
