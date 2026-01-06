import 'package:flutter/foundation.dart';
import 'package:pose_spatial_studio/config/app_config.dart';
import 'package:pose_spatial_studio/models/landmark.dart';
import 'package:pose_spatial_studio/models/pose_result.dart';
import 'package:pose_spatial_studio/services/socket_service.dart';
import 'package:pose_spatial_studio/services/camera_service.dart';

/// Central state management for pose estimation app.
class PoseProvider extends ChangeNotifier {
  final SocketService _socketService;
  final CameraService _cameraService;
  
  // State
  ConnectionState _connectionState = ConnectionState.disconnected;
  CameraState _cameraState = CameraState.uninitialized;
  bool _isStreaming = false;
  String? _streamId;
  String? _errorMessage;
  String? _statusMessage;
  
  // Pose data
  List<Landmark> _landmarks = [];
  List<Landmark> _worldLandmarks = [];
  int _lastTimestamp = 0;
  int _frameCount = 0;
  double _fps = 0;
  DateTime? _fpsStartTime;

  PoseProvider({
    SocketService? socketService,
    CameraService? cameraService,
  })  : _socketService = socketService ?? SocketService(),
        _cameraService = cameraService ?? CameraService() {
    _setupCallbacks();
  }

  // Getters
  ConnectionState get connectionState => _connectionState;
  CameraState get cameraState => _cameraState;
  bool get isStreaming => _isStreaming;
  bool get isConnected => _connectionState == ConnectionState.connected;
  String? get streamId => _streamId;
  String? get errorMessage => _errorMessage;
  String? get statusMessage => _statusMessage;
  List<Landmark> get landmarks => _landmarks;
  List<Landmark> get worldLandmarks => _worldLandmarks;
  int get lastTimestamp => _lastTimestamp;
  double get fps => _fps;
  bool get hasLandmarks => _landmarks.isNotEmpty;

  void _setupCallbacks() {
    // Socket callbacks
    _socketService.onConnectionStateChanged = (state) {
      _connectionState = state;
      if (state == ConnectionState.connected) {
        _statusMessage = 'Connected to server';
        _errorMessage = null;
      } else if (state == ConnectionState.disconnected) {
        _statusMessage = 'Disconnected';
        _isStreaming = false;
      }
      notifyListeners();
    };

    _socketService.onPoseResult = (result) {
      _handlePoseResult(result);
    };

    _socketService.onStreamInitialized = (streamId, message) {
      _streamId = streamId;
      _statusMessage = message;
      notifyListeners();
    };

    _socketService.onStreamLoading = (streamId, message) {
      _statusMessage = message;
      notifyListeners();
    };

    _socketService.onError = (error) {
      _errorMessage = error;
      notifyListeners();
    };

    // Camera callbacks
    _cameraService.onStateChanged = (state) {
      _cameraState = state;
      notifyListeners();
    };

    _cameraService.onFrame = (base64Frame) {
      if (_isStreaming && _streamId != null) {
        _socketService.sendFrame(_streamId!, base64Frame);
      }
    };

    _cameraService.onError = (error) {
      _errorMessage = error;
      notifyListeners();
    };
  }

  void _handlePoseResult(PoseResult result) {
    _landmarks = result.landmarks;
    _worldLandmarks = result.worldLandmarks;
    _lastTimestamp = result.timestampMs;
    
    // Calculate FPS
    _frameCount++;
    final now = DateTime.now();
    if (_fpsStartTime == null) {
      _fpsStartTime = now;
    } else {
      final elapsed = now.difference(_fpsStartTime!).inMilliseconds;
      if (elapsed >= 1000) {
        _fps = (_frameCount * 1000) / elapsed;
        _frameCount = 0;
        _fpsStartTime = now;
      }
    }
    
    notifyListeners();
  }

  /// Connect to the backend server
  Future<void> connect() async {
    _statusMessage = 'Connecting...';
    _errorMessage = null;
    notifyListeners();
    
    _socketService.connect();
  }

  /// Disconnect from the backend
  void disconnect() {
    stopStreaming();
    _socketService.disconnect();
    _landmarks = [];
    _worldLandmarks = [];
    _streamId = null;
    notifyListeners();
  }

  /// Start streaming camera frames
  Future<void> startStreaming() async {
    if (!isConnected) {
      _errorMessage = 'Not connected to server';
      notifyListeners();
      return;
    }

    // Initialize stream on backend
    final streamId = AppConfig.defaultStreamId;
    _statusMessage = 'Initializing stream...';
    notifyListeners();
    
    _socketService.initializeStream(streamId);
    
    // Start camera
    final success = await _cameraService.startCamera();
    if (!success) {
      _errorMessage = 'Failed to start camera';
      notifyListeners();
      return;
    }

    _isStreaming = true;
    _statusMessage = 'Streaming...';
    _fpsStartTime = null;
    _frameCount = 0;
    notifyListeners();
  }

  /// Stop streaming
  void stopStreaming() {
    _cameraService.stopCamera();
    
    if (_streamId != null) {
      _socketService.cleanupStream(_streamId!);
    }
    
    _isStreaming = false;
    _landmarks = [];
    _worldLandmarks = [];
    _fps = 0;
    _statusMessage = 'Stopped';
    notifyListeners();
  }

  /// Toggle streaming state
  Future<void> toggleStreaming() async {
    if (_isStreaming) {
      stopStreaming();
    } else {
      await startStreaming();
    }
  }

  /// Switch camera (front/back)
  Future<void> switchCamera() async {
    await _cameraService.switchCamera();
  }

  /// Clear error message
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    stopStreaming();
    _socketService.dispose();
    _cameraService.dispose();
    super.dispose();
  }
}

