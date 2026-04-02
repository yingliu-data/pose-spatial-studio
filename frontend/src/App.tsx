import { useCallback, Component, type ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useLogStream } from '@/hooks/useLogStream';
import { Controls } from '@/components/Controls';
import { FunctionViewer } from '@/components/FunctionViewer';
import { LogPanel } from '@/components/LogPanel';
import { useAppStore } from '@/stores/appStore';
import './App.css';

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[App] Render crash:', error); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: '#ff6b6b', padding: 40, textAlign: 'center', fontFamily: 'monospace' }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, opacity: 0.7 }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { socket, connected } = useWebSocket();
  const { logs, clearLogs, subscribe: subscribeLogs, unsubscribe: unsubscribeLogs } = useLogStream(socket, connected);

  // Use individual selectors to avoid re-rendering on every backendResult update
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const rightSidebarCollapsed = useAppStore((s) => s.rightSidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const storeToggleRight = useAppStore((s) => s.toggleRightSidebar);

  const toggleRightSidebar = useCallback(() => {
    const isCollapsed = useAppStore.getState().rightSidebarCollapsed;
    if (!isCollapsed) {
      unsubscribeLogs();
    } else {
      subscribeLogs();
    }
    storeToggleRight();
  }, [subscribeLogs, unsubscribeLogs, storeToggleRight]);

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
            <Controls connected={connected} socket={socket} />
          )}
        </aside>

        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          style={{ left: sidebarCollapsed ? 0 : 298 }}
        >
          {sidebarCollapsed ? '\u25B6' : '\u25C0'}
        </button>

        <main className="main-content">
          <FunctionViewer socket={socket} />
        </main>

        <button
          className="sidebar-toggle sidebar-toggle-right"
          onClick={toggleRightSidebar}
          title={rightSidebarCollapsed ? 'Show logs' : 'Hide logs'}
          style={{ right: rightSidebarCollapsed ? 0 : 358 }}
        >
          {rightSidebarCollapsed ? '\u25C0' : '\u25B6'}
        </button>

        <aside className={`right-sidebar ${rightSidebarCollapsed ? 'right-sidebar-collapsed' : ''}`}>
          {!rightSidebarCollapsed && (
            <LogPanel logs={logs} onClear={clearLogs} />
          )}
        </aside>
      </div>
    </div>
  );
}

function AppWithErrorBoundary() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}

export default AppWithErrorBoundary;
