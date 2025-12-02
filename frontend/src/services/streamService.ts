import { Socket } from 'socket.io-client';

export class StreamService {
  private lastSentTimestamp = 0;

  constructor(
    private socket: Socket,
    private streamId: string,
    private processorConfig: Record<string, any> = {}
  ) {}

  sendFrame(frameData: string, timestamp: number): void {
    if (timestamp < this.lastSentTimestamp) return;
    
    this.lastSentTimestamp = timestamp;
    this.socket.emit('process_frame', {
      stream_id: this.streamId,
      frame: frameData,
      timestamp_ms: timestamp,
    });
  }

  flush(): void {
    this.socket.emit('flush_stream', { stream_id: this.streamId });
    this.lastSentTimestamp = Date.now();
  }

  cleanup(): void {
    this.socket.emit('cleanup_processor', { stream_id: this.streamId });
  }
}
