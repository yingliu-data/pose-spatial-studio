import { io, Socket } from 'socket.io-client';

// Backend WebSocket URL - must be set via VITE_BACKEND_URL environment variable
// Local dev: set in .env.local | Production: set in GitHub Actions secrets
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL;

// Dev-only fallback chain: local → staging → production
const DEV_FALLBACK_URLS = [
  'http://localhost:49101',
  'https://pose-backend-staging.yingliu.site',
  'https://pose-backend.yingliu.site',
];

async function probeHealth(url: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

class SocketService {
  private socket: Socket | null = null;
  private resolvedUrl: string | null = null;

  /** Resolve the backend URL once (dev: fallback chain, prod: env var). */
  async resolveUrl(): Promise<string> {
    if (this.resolvedUrl) return this.resolvedUrl;

    if (import.meta.env.DEV) {
      for (const url of DEV_FALLBACK_URLS) {
        console.log(`[Socket] Trying ${url}...`);
        if (await probeHealth(url)) {
          console.log(`[Socket] Using backend: ${url}`);
          this.resolvedUrl = url;
          return url;
        }
      }
      // All failed — fall back to default so reconnection can retry
      console.warn('[Socket] No backend reachable, defaulting to', SOCKET_URL);
    }

    this.resolvedUrl = SOCKET_URL;
    return SOCKET_URL;
  }

  connect(url?: string): Socket {
    if (!this.socket) {
      const target = url ?? this.resolvedUrl ?? SOCKET_URL;
      this.socket = io(target, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }
    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
