import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { type ChatMessage } from '@/types/chat';

interface ChatPanelProps {
  remainingSeconds: number;
  isExpired: boolean;
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  onMicTap: () => void;
  onSend: (text: string) => void;
  isSending: boolean;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: isUser ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
          background: isUser ? 'rgba(10,132,255,0.3)' : 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.9)',
          fontSize: 14,
          lineHeight: 1.45,
          marginLeft: isUser ? 60 : 0,
          marginRight: isUser ? 0 : 60,
          wordBreak: 'break-word',
          backdropFilter: 'blur(8px)',
        }}
      >
        {message.content}
        {message.isStreaming && (
          <span style={{ opacity: 0.5, animation: 'pulse 1s infinite' }}> |</span>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({
  remainingSeconds,
  isExpired,
  isListening,
  isSupported,
  transcript,
  onMicTap,
  onSend,
  isSending,
}: ChatPanelProps) {
  const chatMessages = useAppStore((s) => s.chatMessages);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Sync transcript into input while listening
  useEffect(() => {
    if (isListening && transcript) {
      setInputText(transcript);
    }
  }, [isListening, transcript]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isSending || isExpired) return;
    onSend(text);
    setInputText('');
  }, [inputText, isSending, isExpired, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const canSend = inputText.trim().length > 0 && !isSending && !isExpired;

  const timerColor =
    remainingSeconds <= 10
      ? 'rgba(255,69,58,0.9)'
      : remainingSeconds <= 30
        ? 'rgba(255,159,10,0.9)'
        : 'rgba(255,255,255,0.5)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Timer bar */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
          Voice Chat
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
          {isExpired ? 'Session ended' : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`}
        </span>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px 0',
        }}
      >
        {chatMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Say a command to control the avatar
          </div>
        )}
        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input area */}
      <div style={{ padding: '8px 12px 12px' }}>
        {isListening ? (
          // Recording state
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 20,
              background: 'rgba(10,132,255,0.15)',
              border: '1px solid rgba(10,132,255,0.3)',
            }}
          >
            <button
              onClick={onMicTap}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,69,58,0.8)',
                color: '#fff',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                animation: 'pulse 1.5s infinite',
              }}
            >
              {'\u{1F3A4}'}
            </button>
            <span
              style={{
                flex: 1,
                fontSize: 14,
                color: transcript ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {transcript || 'Listening...'}
            </span>
            <button
              onClick={() => { if (transcript) handleSend(); }}
              disabled={!transcript}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background: transcript ? 'linear-gradient(135deg, #0a84ff, #5e5ce6)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 16,
                cursor: transcript ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: transcript ? 1 : 0.4,
              }}
            >
              {'\u{2191}'}
            </button>
          </div>
        ) : (
          // Normal state
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '0 4px 0 14px',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isExpired ? 'Session ended' : 'Type a command...'}
                disabled={isExpired || isSending}
                maxLength={200}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 14,
                  padding: '10px 0',
                }}
              />
              {canSend ? (
                <button
                  onClick={handleSend}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0a84ff, #5e5ce6)',
                    color: '#fff',
                    fontSize: 15,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {'\u{2191}'}
                </button>
              ) : !isExpired && isSupported ? (
                <button
                  onClick={onMicTap}
                  disabled={isSending}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 15,
                    cursor: isSending ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    opacity: isSending ? 0.4 : 1,
                  }}
                >
                  {'\u{1F3A4}'}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
