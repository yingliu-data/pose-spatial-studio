import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import { AvatarRenderer } from '@/three/AvatarRenderer';
import { ChatPanel } from '@/components/ChatPanel';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { useAppStore } from '@/stores/appStore';
import { sendGuestMessage } from '@/services/secondBrainService';
import { type UnifiedFKData, type RootPosition } from '@/types/pose';
import { type AvatarCommand } from '@/types/chat';

interface RoboticControlViewProps {
  socket: Socket | null;
}

let _requestCounter = 0;

export function RoboticControlView({ socket }: RoboticControlViewProps) {
  const [sessionId] = useState(() => `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [sessionStart] = useState(() => Date.now());
  const [fkData, setFkData] = useState<UnifiedFKData | null>(null);
  const [rootPosition, setRootPosition] = useState<RootPosition | null>(null);
  const [isSending, setIsSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const animationRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { remainingSeconds, isExpired } = useSessionTimer(sessionStart);
  const { isListening, isSupported, transcript, startListening, stopListening, resetTranscript } =
    useVoiceRecognition();

  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const appendToStreamingMessage = useAppStore((s) => s.appendToStreamingMessage);
  const setSessionExpired = useAppStore((s) => s.setSessionExpired);

  // Mark session expired in store
  useEffect(() => {
    if (isExpired) {
      setSessionExpired(true);
      stopListening();
    }
  }, [isExpired, setSessionExpired, stopListening]);

  // Listen for fk_result from pose-backend
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { request_id: string; fk_data: UnifiedFKData; root_position: RootPosition }) => {
      if (data.fk_data && Object.keys(data.fk_data).length > 0) {
        setFkData(data.fk_data);
      }
      if (data.root_position) {
        setRootPosition(data.root_position);
      }
    };
    socket.on('fk_result', handler);
    return () => { socket.off('fk_result', handler); };
  }, [socket]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      animationRef.current.forEach(clearTimeout);
      animationRef.current = [];
      abortRef.current?.abort();
    };
  }, []);

  const solveAndApply = useCallback(
    (joints: Record<string, { x: number; y: number; z: number }>) => {
      if (!socket) return;
      const requestId = `ik_${++_requestCounter}`;
      socket.emit('solve_ik', { request_id: requestId, joints });
    },
    [socket],
  );

  const handleAvatarCommand = useCallback(
    (cmd: AvatarCommand) => {
      // Clear previous animation timers
      animationRef.current.forEach(clearTimeout);
      animationRef.current = [];

      if (cmd.result.type === 'pose' && cmd.result.joints) {
        solveAndApply(cmd.result.joints);
      } else if (cmd.result.type === 'animation' && cmd.result.frames) {
        let delay = 0;
        const frames = cmd.result.frames;
        const playSequence = (frameList: typeof frames) => {
          frameList.forEach((frame) => {
            const timer = setTimeout(() => {
              solveAndApply(frame.joints);
            }, delay);
            animationRef.current.push(timer);
            delay += frame.hold_ms;
          });
        };

        if (cmd.result.loop) {
          // Loop: replay sequence 5 times max (prevent infinite loop)
          for (let rep = 0; rep < 5; rep++) {
            playSequence(frames);
          }
        } else {
          playSequence(frames);
        }
      }
    },
    [solveAndApply],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (isSending || isExpired) return;

      // Stop listening and reset transcript
      stopListening();
      resetTranscript();

      // Add user message
      addChatMessage({
        id: `msg_${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      });

      // Create streaming assistant message
      const assistantMsgId = `msg_${Date.now()}_asst`;
      addChatMessage({
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      });

      setIsSending(true);
      abortRef.current = new AbortController();

      try {
        await sendGuestMessage(
          text,
          sessionId,
          (token) => appendToStreamingMessage(token),
          (cmd) => handleAvatarCommand(cmd),
          () => {
            // Mark streaming complete — update the last message
            const msgs = useAppStore.getState().chatMessages;
            const last = msgs[msgs.length - 1];
            if (last?.isStreaming) {
              useAppStore.setState({
                chatMessages: msgs.map((m) =>
                  m.id === last.id ? { ...m, isStreaming: false } : m,
                ),
              });
            }
          },
          abortRef.current.signal,
        );
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          appendToStreamingMessage(err.message || 'Something went wrong.');
          // Mark done
          const msgs = useAppStore.getState().chatMessages;
          const last = msgs[msgs.length - 1];
          if (last?.isStreaming) {
            useAppStore.setState({
              chatMessages: msgs.map((m) =>
                m.id === last.id ? { ...m, isStreaming: false } : m,
              ),
            });
          }
        }
      } finally {
        setIsSending(false);
        abortRef.current = null;
      }
    },
    [
      isSending,
      isExpired,
      sessionId,
      addChatMessage,
      appendToStreamingMessage,
      handleAvatarCommand,
      stopListening,
      resetTranscript,
    ],
  );

  const handleMicTap = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {/* Avatar panel */}
      <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ flex: 1, background: '#000' }}>
          <Canvas>
            <PerspectiveCamera makeDefault position={[0, 0, 5]} />
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
            <AvatarRenderer
              fkData={fkData}
              rootPosition={rootPosition}
              scale={1}
              visibilityThreshold={0.5}
            />
          </Canvas>
        </div>

        {/* Instructions overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
            HOW TO USE
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            1. Tap the mic or type a command{'\n'}
            2. Say something like "wave your right hand" or "do a T-pose"{'\n'}
            3. The avatar will move in real-time
          </div>
          {!isSupported && (
            <div style={{ fontSize: 12, color: 'rgba(255,69,58,0.8)', marginTop: 6 }}>
              Voice input not supported in this browser. Use Chrome for voice control.
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div style={{ flex: '0 0 45%', minWidth: 0 }}>
        <ChatPanel
          remainingSeconds={remainingSeconds}
          isExpired={isExpired}
          isListening={isListening}
          isSupported={isSupported}
          transcript={transcript}
          onMicTap={handleMicTap}
          onSend={handleSend}
          isSending={isSending}
        />
      </div>
    </div>
  );
}
