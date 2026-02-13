import { useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Controls } from '@/components/Controls';
import { MultiViewGrid } from '@/components/MultiViewGrid';
import './App.css';

interface Stream {
  streamId: string;
  sourceType: 'camera' | 'video';
  deviceId?: string;
  deviceLabel?: string;
  videoFile?: File;
  processorConfig?: Record<string, any>;
  active: boolean;
  createdAt: number;
}

function App() {
  const { socket, connected, poseResults, clearPoseResult, flushStream } = useWebSocket();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const addStream = (
    streamId: string, 
    sourceType: 'camera' | 'video', 
    deviceId?: string, 
    deviceLabel?: string,
    videoFile?: File, 
    processorConfig?: Record<string, any>
  ): boolean => {
    if (streams.find(s => s.streamId === streamId)) {
      alert(`Stream "${streamId}" already exists`);
      return false;
    }
    setStreams(prev => [...prev, { streamId, sourceType, deviceId, deviceLabel, videoFile, processorConfig, active: true, createdAt: Date.now() }]);
    return true;
  };

  const removeStream = (streamId: string) => {
    setStreams(prev => prev.filter(s => s.streamId !== streamId));
    clearPoseResult(streamId);
    if (selectedStream === streamId) setSelectedStream(null);
  };

  return (
    <div className="app">
      {/* Animated background orbs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(10,132,255,0.3) 0%, rgba(10,132,255,0.05) 40%, transparent 70%)', top: '-15%', left: '-10%', animation: 'orbMove1 30s ease-in-out infinite', filter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(191,90,242,0.3) 0%, rgba(191,90,242,0.05) 40%, transparent 70%)', bottom: '-10%', right: '-8%', animation: 'orbMove2 35s ease-in-out infinite', filter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(48,209,88,0.15) 0%, transparent 60%)', top: '50%', left: '40%', animation: 'orbMove3 22s ease-in-out infinite', filter: 'blur(8px)' }} />
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,159,10,0.12) 0%, transparent 60%)', top: '20%', right: '20%', animation: 'orbMove4 28s ease-in-out infinite', filter: 'blur(8px)' }} />
      </div>

      <header className="app-header">
        <h1>Pose Spatial Studio</h1>
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <div className="app-content">
        <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {!sidebarCollapsed && (
            <Controls
              streams={streams}
              selectedStream={selectedStream}
              onStreamSelect={setSelectedStream}
              onAddStream={addStream}
              onRemoveStream={removeStream}
              connected={connected}
              socket={socket}
            />
          )}
        </aside>

        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(prev => !prev)}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          style={{ left: sidebarCollapsed ? 0 : 298 }}
        >
          {sidebarCollapsed ? '\u25B6' : '\u25C0'}
        </button>

        <main className="main-content">
          <MultiViewGrid
            socket={socket}
            streams={streams}
            poseResults={poseResults}
            selectedStream={selectedStream}
            onFlushStream={flushStream}
          />
        </main>
      </div>
    </div>
  );
}

export default App;

