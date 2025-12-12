import { io, Socket } from 'socket.io-client';

// Backend WebSocket URL - set via environment variable for production
// For local development: http://localhost:49101
// For production: http://<GPU-VM-IP>:49101 or use reverse proxy
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.0.50:49101';

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
