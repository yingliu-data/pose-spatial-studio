import { useEffect, Component, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import { VideoPlane } from '@/three/VideoPlane';
import { PoseResult } from '@/types/pose';
import { StickBallRenderer } from '@/three/StickBallRenderer';
import { AvatarRenderer } from '@/three/AvatarRenderer';

type RendererType = 'stickball' | 'avatar';
const ACTIVE_RENDERER: RendererType = 'avatar';

// Error boundary to catch Three.js / Canvas crashes without unmounting the whole app
class ViewerErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[3D] Canvas crashed:', error.message); }
  render() {
    if (this.state.error) {
      return <div style={{ color: '#ff6b6b', padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>3D Viewer Error</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{this.state.error.message}</div>
      </div>;
    }
    return this.props.children;
  }
}

interface Skeleton3DViewerProps {
  poseResult: PoseResult | null;
  videoElement: HTMLVideoElement | null;
  processedCanvas: HTMLCanvasElement | null;
}

export function Skeleton3DViewer({ poseResult, videoElement, processedCanvas }: Skeleton3DViewerProps) {
  useEffect(() => {
    console.log('[3D] Skeleton3DViewer mounted', { hasVideo: !!videoElement, hasCanvas: !!processedCanvas, hasPose: !!poseResult?.pose_data });
    return () => console.log('[3D] Skeleton3DViewer unmounted');
  }, []);
  const renderSkeleton = () => {
    if (!poseResult?.pose_data) return null;

    if (ACTIVE_RENDERER === 'avatar') {
      return (
        <AvatarRenderer
          fkData={poseResult.pose_data.fk_data ?? null}
          rootPosition={poseResult.pose_data.root_position ?? null}
          scale={1}
          visibilityThreshold={0.5}
        />
      );
    }

    // Use first pose from world_landmarks array
    const joints = poseResult.pose_data.world_landmarks?.[0] ?? null;
    return (
      <StickBallRenderer
        joints={joints}
        color="#00ff00"
        jointRadius={0.02}
        lineWidth={3}
      />
    );
  };

  return (
    <div style={{ width: '100%', height: '600px', backgroundColor: '#000' }}>
      <ViewerErrorBoundary>
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

          {renderSkeleton()}
        </Canvas>
      </ViewerErrorBoundary>
    </div>
  );
}
