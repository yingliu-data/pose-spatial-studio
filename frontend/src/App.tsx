import { useState, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Controls } from '@/components/Controls';
import { MultiViewGrid } from '@/components/MultiViewGrid';
import { StreamInitService } from '@/services/streamInitService';
import './App.css';

export const AVAILABLE_MODELS = [
  { value: 'mediapipe', label: 'MediaPipe' },
  { value: 'rtmpose', label: 'RTMPose' },
] as const;

export type ModelType = typeof AVAILABLE_MODELS[number]['value'];

interface Stream {
  streamId: string;
  sourceType: 'camera' | 'video';
  deviceId?: string;
  deviceLabel?: string;
  videoFile?: File;
  processorConfig?: Record<string, any>;
  modelType: ModelType;
  active: boolean;
  createdAt: number;
}

function App() {
  const { socket, connected, poseResults, clearPoseResult, flushStream } = useWebSocket();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [switchingModels, setSwitchingModels] = useState<Map<string, string>>(new Map());

  const addStream = (
    streamId: string,
    sourceType: 'camera' | 'video',
    deviceId?: string,
    deviceLabel?: string,
    videoFile?: File,
    processorConfig?: Record<string, any>,
    modelType?: ModelType
  ): boolean => {
    if (streams.find(s => s.streamId === streamId)) {
      alert(`Stream "${streamId}" already exists`);
      return false;
    }
    setStreams(prev => [...prev, { streamId, sourceType, deviceId, deviceLabel, videoFile, processorConfig, modelType: modelType || 'mediapipe', active: true, createdAt: Date.now() }]);
    return true;
  };

  const removeStream = (streamId: string) => {
    setStreams(prev => prev.filter(s => s.streamId !== streamId));
    clearPoseResult(streamId);
    if (selectedStream === streamId) setSelectedStream(null);
  };

  const handleSwitchModel = useCallback(async (streamId: string, newModel: ModelType) => {
    if (!socket) return;

    setSwitchingModels(prev => new Map(prev).set(streamId, `Switching to ${newModel}...`));

    try {
      const result = await StreamInitService.switchModel(
        socket,
        streamId,
        newModel,
        (message) => setSwitchingModels(prev => new Map(prev).set(streamId, message))
      );

      if (result.success) {
        setStreams(prev => prev.map(s =>
          s.streamId === streamId ? { ...s, modelType: newModel } : s
        ));
      } else {
        console.error(`[App] Model switch failed: ${result.message}`);
      }
    } catch (err: any) {
      console.error(`[App] Model switch error:`, err);
    } finally {
      setSwitchingModels(prev => {
        const next = new Map(prev);
        next.delete(streamId);
        return next;
      });
    }
  }, [socket]);

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
            onSwitchModel={handleSwitchModel}
            switchingModels={switchingModels}
          />
        </main>
      </div>
    </div>
  );
}

export default App;

