import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import { SkeletonRenderer } from '@/three/SkeletonRenderer';
import { VideoPlane } from '@/three/VideoPlane';
import { PoseResult } from '@/types/pose';

interface Skeleton3DViewerProps {
  poseResult: PoseResult | null;
  videoElement: HTMLVideoElement | null;
  processedCanvas: HTMLCanvasElement | null;
}

export function Skeleton3DViewer({ poseResult, videoElement, processedCanvas }: Skeleton3DViewerProps) {
  return (
    <div style={{ width: '100%', height: '600px', backgroundColor: '#000' }}>
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 3]} />
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />

        <Grid
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#6f6f6f"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#9d4b4b"
          fadeDistance={25}
          fadeStrength={1}
          followCamera={false}
          position={[0, 0, -0.5]}
        />

        {processedCanvas ? (
          <VideoPlane canvasElement={processedCanvas} />
        ) : videoElement ? (
          <VideoPlane videoElement={videoElement} />
        ) : null}

        {poseResult?.pose_data?.world_landmarks && (
          <SkeletonRenderer
            landmarks={poseResult.pose_data.world_landmarks}
            color="#00ff00"
            jointRadius={0.02}
            lineWidth={3}
          />
        )}
      </Canvas>
    </div>
  );
}

