import { useEffect, useRef, useState } from 'react';
import { LogEntry } from '@/hooks/useLogStream';

const MAX_MESSAGE_LENGTH = 200;

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

function LogMessage({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = message.length > MAX_MESSAGE_LENGTH;

  if (!truncated || expanded) {
    return (
      <span className="log-message" onClick={truncated ? () => setExpanded(false) : undefined}>
        {message}
      </span>
    );
  }

  return (
    <span className="log-message log-message-truncated" onClick={() => setExpanded(true)}>
      {message.slice(0, MAX_MESSAGE_LENGTH)}...
    </span>
  );
}

export function LogPanel({ logs, onClear }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  };

  return (
    <div className="log-panel">
      <div className="log-panel-header">
        <h2>Backend Logs</h2>
        <div className="log-panel-actions">
          <span className="log-count">{logs.length}</span>
          <button className="btn btn-sm" onClick={onClear}>Clear</button>
        </div>
      </div>
      <div
        className="log-panel-entries"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {logs.map((entry, i) => (
          <div key={i} className="log-entry">
            <span className="log-timestamp">{entry.timestamp}</span>
            <span className={`log-level log-level-${entry.level.toLowerCase()}`}>
              {entry.level}
            </span>
            <LogMessage message={entry.message} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {!autoScroll && (
        <button
          className="log-scroll-to-bottom"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
