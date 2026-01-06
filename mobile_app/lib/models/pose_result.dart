import 'landmark.dart';

/// Container for pose estimation results from the backend.
class PoseResult {
  final String streamId;
  final String? frame;
  final List<Landmark> landmarks;
  final List<Landmark> worldLandmarks;
  final int numPoses;
  final int timestampMs;

  const PoseResult({
    required this.streamId,
    this.frame,
    this.landmarks = const [],
    this.worldLandmarks = const [],
    this.numPoses = 0,
    required this.timestampMs,
  });

  factory PoseResult.fromJson(Map<String, dynamic> json) {
    final poseData = json['pose_data'] as Map<String, dynamic>?;
    
    List<Landmark> parseLandmarks(dynamic data) {
      if (data == null) return [];
      if (data is List) {
        return data
            .map((e) => Landmark.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    }

    return PoseResult(
      streamId: json['stream_id'] as String? ?? '',
      frame: json['frame'] as String?,
      landmarks: parseLandmarks(poseData?['landmarks']),
      worldLandmarks: parseLandmarks(poseData?['world_landmarks']),
      numPoses: poseData?['num_poses'] as int? ?? 0,
      timestampMs: json['timestamp_ms'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'stream_id': streamId,
      'frame': frame,
      'pose_data': {
        'landmarks': landmarks.map((l) => l.toJson()).toList(),
        'world_landmarks': worldLandmarks.map((l) => l.toJson()).toList(),
        'num_poses': numPoses,
      },
      'timestamp_ms': timestampMs,
    };
  }

  bool get hasLandmarks => landmarks.isNotEmpty;

  @override
  String toString() => 'PoseResult(streamId: $streamId, landmarks: ${landmarks.length}, ts: $timestampMs)';
}

