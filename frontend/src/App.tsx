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
      <header className="app-header">
        <h1>Real-time Pose Estimation Viewer</h1>
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <div className="app-content">
        <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(prev => !prev)}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {sidebarCollapsed ? '\u25B6' : '\u25C0'}
          </button>
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

