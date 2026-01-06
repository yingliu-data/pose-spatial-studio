import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:pose_spatial_studio/config/app_config.dart';
import 'package:pose_spatial_studio/models/pose_result.dart';

/// Connection state for the WebSocket
enum ConnectionState {
  disconnected,
  connecting,
  connected,
  error,
}

/// Service for managing WebSocket connection to the pose estimation backend.
class SocketService {
  io.Socket? _socket;
  final String serverUrl;
  
  ConnectionState _connectionState = ConnectionState.disconnected;
  String? _errorMessage;
  String? _currentStreamId;
  
  // Callbacks
  Function(PoseResult)? onPoseResult;
  Function(ConnectionState)? onConnectionStateChanged;
  Function(String)? onError;
  Function(String, String)? onStreamInitialized;
  Function(String, String)? onStreamLoading;

  SocketService({this.serverUrl = AppConfig.serverUrl});

  ConnectionState get connectionState => _connectionState;
  String? get errorMessage => _errorMessage;
  bool get isConnected => _connectionState == ConnectionState.connected;
  String? get currentStreamId => _currentStreamId;

  void _updateConnectionState(ConnectionState state, [String? error]) {
    _connectionState = state;
    _errorMessage = error;
    onConnectionStateChanged?.call(state);
  }

  /// Connect to the backend WebSocket server
  void connect() {
    if (_socket != null) {
      print('[SocketService] Already connected or connecting');
      return;
    }

    _updateConnectionState(ConnectionState.connecting);
    print('[SocketService] Connecting to $serverUrl');

    _socket = io.io(
      serverUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(5)
          .setReconnectionDelay(1000)
          .build(),
    );

    _setupEventHandlers();
    _socket!.connect();
  }

  void _setupEventHandlers() {
    _socket!.onConnect((_) {
      print('[SocketService] Connected to backend');
      _updateConnectionState(ConnectionState.connected);
    });

    _socket!.onDisconnect((_) {
      print('[SocketService] Disconnected from backend');
      _updateConnectionState(ConnectionState.disconnected);
      _currentStreamId = null;
    });

    _socket!.onConnectError((error) {
      print('[SocketService] Connection error: $error');
      _updateConnectionState(ConnectionState.error, error.toString());
      onError?.call('Connection error: $error');
    });

    _socket!.onError((error) {
      print('[SocketService] Socket error: $error');
      onError?.call(error['message'] ?? 'Unknown error');
    });

    _socket!.on('connection_status', (data) {
      print('[SocketService] Connection status: $data');
    });

    _socket!.on('stream_loading', (data) {
      final streamId = data['stream_id'] as String? ?? '';
      final message = data['message'] as String? ?? 'Loading...';
      print('[SocketService] Stream loading: $streamId - $message');
      onStreamLoading?.call(streamId, message);
    });

    _socket!.on('stream_initialized', (data) {
      final streamId = data['stream_id'] as String? ?? '';
      final status = data['status'] as String? ?? '';
      final message = data['message'] as String? ?? '';
      print('[SocketService] Stream initialized: $streamId ($status)');
      _currentStreamId = streamId;
      onStreamInitialized?.call(streamId, message);
    });

    _socket!.on('stream_error', (data) {
      final message = data['message'] as String? ?? 'Stream error';
      print('[SocketService] Stream error: $message');
      onError?.call(message);
    });

    _socket!.on('pose_result', (data) {
      try {
        final result = PoseResult.fromJson(data as Map<String, dynamic>);
        onPoseResult?.call(result);
      } catch (e) {
        print('[SocketService] Error parsing pose result: $e');
      }
    });

    _socket!.on('error', (data) {
      final message = data['message'] as String? ?? 'Unknown error';
      print('[SocketService] Error: $message');
      onError?.call(message);
    });
  }

  /// Initialize a pose processing stream on the backend
  void initializeStream(String streamId, [Map<String, dynamic>? processorConfig]) {
    if (!isConnected) {
      print('[SocketService] Cannot initialize stream: not connected');
      onError?.call('Not connected to server');
      return;
    }

    print('[SocketService] Initializing stream: $streamId');
    _socket!.emit('initialize_stream', {
      'stream_id': streamId,
      'processor_config': processorConfig ?? AppConfig.defaultProcessorConfig,
    });
  }

  /// Send a camera frame for pose processing
  void sendFrame(String streamId, String base64Frame) {
    if (!isConnected) return;

    _socket!.emit('process_frame', {
      'stream_id': streamId,
      'frame': base64Frame,
      'timestamp_ms': DateTime.now().millisecondsSinceEpoch,
    });
  }

  /// Cleanup a stream on the backend
  void cleanupStream(String streamId) {
    if (!isConnected) return;

    print('[SocketService] Cleaning up stream: $streamId');
    _socket!.emit('cleanup_processor', {
      'stream_id': streamId,
    });
    _currentStreamId = null;
  }

  /// Flush stream buffer
  void flushStream(String streamId) {
    if (!isConnected) return;

    _socket!.emit('flush_stream', {
      'stream_id': streamId,
    });
  }

  /// Disconnect from the backend
  void disconnect() {
    if (_currentStreamId != null) {
      cleanupStream(_currentStreamId!);
    }
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _updateConnectionState(ConnectionState.disconnected);
    print('[SocketService] Disconnected');
  }

  /// Dispose resources
  void dispose() {
    disconnect();
  }
}

