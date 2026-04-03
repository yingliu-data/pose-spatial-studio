import { Socket } from 'socket.io-client';
import { useAppStore } from '@/stores/appStore';
import { View2D } from '@/components/View2D';
import { View3D } from '@/components/View3D';
import { RoboticControlView } from '@/components/RoboticControlView';

interface FunctionViewerProps {
  socket: Socket | null;
}

function PlaceholderView() {
  return (
    <div className="placeholder-view">
      <div className="placeholder-card">
        <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F916}'}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>
          Robotic Control
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
          Coming Soon
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="placeholder-view">
      <div className="placeholder-card">
        <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F4A1}'}</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
          Select a function to get started
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Choose from the menu on the left
        </div>
      </div>
    </div>
  );
}

export function FunctionViewer({ socket }: FunctionViewerProps) {
  const { activeFunction, functionDef } = useAppStore();

  if (!activeFunction || !functionDef) {
    return <EmptyState />;
  }

  switch (functionDef.viewMode) {
    case '2d':
      return <View2D socket={socket} />;
    case '3d':
      return <View3D socket={socket} />;
    case 'voice':
      return <RoboticControlView socket={socket} />;
    case 'placeholder':
      return <PlaceholderView />;
    default:
      return <EmptyState />;
  }
}
