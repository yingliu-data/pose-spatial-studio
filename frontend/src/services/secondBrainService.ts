import { type AvatarCommand } from '@/types/chat';

const SECOND_BRAIN_URL = import.meta.env.VITE_SECOND_BRAIN_URL || '';

export async function sendGuestMessage(
  message: string,
  sessionId: string,
  onToken: (text: string) => void,
  onAvatarCommand: (cmd: AvatarCommand) => void,
  onDone: () => void,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${SECOND_BRAIN_URL}/api/v1/guest/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response stream');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (eventType === 'token') {
              onToken(parsed.text || '');
            } else if (eventType === 'avatar_command') {
              onAvatarCommand(parsed as AvatarCommand);
            } else if (eventType === 'done') {
              onDone();
            }
          } catch {
            // Ignore malformed JSON
          }
          eventType = '';
        } else if (line === '') {
          eventType = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
