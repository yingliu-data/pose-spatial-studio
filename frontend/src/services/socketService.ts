import { io, Socket } from 'socket.io-client';

// Backend WebSocket URL - set via environment variable for production
// For local development: http://localhost:49101
// For production: Use Cloudflare tunnel URL (HTTPS required for browser access)
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'https://pose-backend.yingliu.site';

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
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
