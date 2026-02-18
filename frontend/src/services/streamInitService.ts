import { Socket } from "socket.io-client";

export class StreamInitService {
    static async initializeStream(
      socket: Socket,
      streamId: string,
      processorConfig: Record<string, any> = {}, // Accept parsed config directly
      onProgress?: (message: string) => void, // Optional progress callback
      sourceType?: 'camera' | 'video'
    ): Promise<{ success: boolean; message: string }> {
      return new Promise((resolve, reject) => {
        
        const successHandler = (data: any) => {
          if (data.stream_id === streamId) {
            socket.off('stream_initialized', successHandler);
            socket.off('stream_error', errorHandler);
            socket.off('stream_loading', loadingHandler);
            resolve({ success: true, message: data.message });
          }
        };
  
        const errorHandler = (data: any) => {
          if (data.stream_id === streamId) {
            socket.off('stream_initialized', successHandler);
            socket.off('stream_error', errorHandler);
            socket.off('stream_loading', loadingHandler);
            resolve({ success: false, message: data.message });
          }
        };

        const loadingHandler = (data: any) => {
          if (data.stream_id === streamId && onProgress) {
            onProgress(data.message || 'Loading models...');
          }
        };
  
        socket.on('stream_initialized', successHandler);
        socket.on('stream_error', errorHandler);
        socket.on('stream_loading', loadingHandler);
  
        socket.emit('initialize_stream', {
          stream_id: streamId,
          processor_config: processorConfig,
          source_type: sourceType || 'camera',
        });
        
        setTimeout(() => {
          socket.off('stream_initialized', successHandler);
          socket.off('stream_error', errorHandler);
          socket.off('stream_loading', loadingHandler);
          reject({ success: false, message: 'Initialization timeout' });
        }, 60000); // Increased timeout to 60s for model loading
      });
    }
  }