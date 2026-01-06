class AppConfig {
  // Backend server URL for WebSocket connection
  static const String serverUrl = 'https://pose-backend.yingliu.site';
  
  // Alternative server URL (can be configured)
  static const String alternativeServerUrl = 'https://robot.yingliu.site';
  
  // Default stream ID for mobile app
  static const String defaultStreamId = 'mobile_stream_1';
  
  // Processor configuration
  static const Map<String, dynamic> defaultProcessorConfig = {
    'pose_processor': {
      'processor_type': 'mediapipe',
    },
  };
  
  // Camera settings
  static const double jpegQuality = 0.5;
  static const int targetFrameRate = 15;
  
  // Skeleton visualization
  static const double jointRadius = 6.0;
  static const double stickWidth = 3.0;
  static const double visibilityThreshold = 0.5;
}

