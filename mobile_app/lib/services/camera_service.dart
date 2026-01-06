import 'dart:async';
import 'package:flutter/services.dart';

/// Camera state enumeration
enum CameraState {
  uninitialized,
  initializing,
  ready,
  streaming,
  error,
}

/// Service for managing native iOS camera via platform channels.
class CameraService {
  static const MethodChannel _methodChannel = 
      MethodChannel('site.yingliu.robot/camera');
  static const EventChannel _eventChannel = 
      EventChannel('site.yingliu.robot/camera_stream');

  CameraState _state = CameraState.uninitialized;
  StreamSubscription<String>? _frameSubscription;
  String? _errorMessage;

  // Callbacks
  Function(String)? onFrame;
  Function(CameraState)? onStateChanged;
  Function(String)? onError;

  CameraState get state => _state;
  String? get errorMessage => _errorMessage;
  bool get isStreaming => _state == CameraState.streaming;

  void _updateState(CameraState newState, [String? error]) {
    _state = newState;
    _errorMessage = error;
    onStateChanged?.call(newState);
    if (error != null) {
      onError?.call(error);
    }
  }

  /// Get the frame stream from native camera
  Stream<String> get frameStream {
    return _eventChannel
        .receiveBroadcastStream()
        .map((event) => event as String);
  }

  /// Initialize the camera (setup but don't start streaming)
  Future<bool> initialize() async {
    if (_state == CameraState.ready || _state == CameraState.streaming) {
      return true;
    }

    _updateState(CameraState.initializing);

    try {
      await _methodChannel.invokeMethod('setupCamera');
      _updateState(CameraState.ready);
      print('[CameraService] Camera initialized');
      return true;
    } on PlatformException catch (e) {
      print('[CameraService] Failed to initialize camera: ${e.message}');
      _updateState(CameraState.error, e.message);
      return false;
    }
  }

  /// Start camera streaming
  Future<bool> startCamera() async {
    if (_state == CameraState.streaming) {
      print('[CameraService] Camera already streaming');
      return true;
    }

    // Initialize if needed
    if (_state != CameraState.ready) {
      final initialized = await initialize();
      if (!initialized) return false;
    }

    try {
      await _methodChannel.invokeMethod('startCamera');
      
      // Subscribe to frame stream
      _frameSubscription = frameStream.listen(
        (base64Frame) {
          onFrame?.call(base64Frame);
        },
        onError: (error) {
          print('[CameraService] Frame stream error: $error');
          _updateState(CameraState.error, error.toString());
        },
      );

      _updateState(CameraState.streaming);
      print('[CameraService] Camera started streaming');
      return true;
    } on PlatformException catch (e) {
      print('[CameraService] Failed to start camera: ${e.message}');
      _updateState(CameraState.error, e.message);
      return false;
    }
  }

  /// Stop camera streaming
  Future<void> stopCamera() async {
    if (_state != CameraState.streaming) {
      return;
    }

    try {
      await _frameSubscription?.cancel();
      _frameSubscription = null;
      await _methodChannel.invokeMethod('stopCamera');
      _updateState(CameraState.ready);
      print('[CameraService] Camera stopped');
    } on PlatformException catch (e) {
      print('[CameraService] Failed to stop camera: ${e.message}');
      _updateState(CameraState.error, e.message);
    }
  }

  /// Switch between front and back camera
  Future<void> switchCamera() async {
    try {
      await _methodChannel.invokeMethod('switchCamera');
      print('[CameraService] Camera switched');
    } on PlatformException catch (e) {
      print('[CameraService] Failed to switch camera: ${e.message}');
      onError?.call('Failed to switch camera: ${e.message}');
    }
  }

  /// Set JPEG compression quality (0.0 - 1.0)
  Future<void> setQuality(double quality) async {
    try {
      await _methodChannel.invokeMethod('setQuality', {'quality': quality});
      print('[CameraService] Quality set to $quality');
    } on PlatformException catch (e) {
      print('[CameraService] Failed to set quality: ${e.message}');
    }
  }

  /// Dispose resources
  void dispose() {
    stopCamera();
    _frameSubscription?.cancel();
    _frameSubscription = null;
  }
}

