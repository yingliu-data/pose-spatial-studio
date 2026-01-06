/// MediaPipe Pose landmark connections for skeleton visualization.
/// Based on MediaPipe's 33-point pose model.
/// 
/// Landmark indices:
/// 0: nose, 1-4: left eye, 5-8: right eye
/// 9-10: mouth, 11-12: shoulders
/// 13-14: elbows, 15-16: wrists
/// 17-22: hands, 23-24: hips
/// 25-26: knees, 27-28: ankles
/// 29-32: feet
class PoseConnections {
  /// Full MediaPipe pose connections
  static const List<List<int>> connections = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    // Shoulders
    [11, 12],
    // Left arm
    [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    // Right arm
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    // Torso
    [11, 23], [12, 24], [23, 24],
    // Left leg
    [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
    // Right leg
    [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
  ];

  /// Simplified body connections (excludes face and hands)
  static const List<List<int>> bodyConnections = [
    // Shoulders
    [11, 12],
    // Left arm
    [11, 13], [13, 15],
    // Right arm
    [12, 14], [14, 16],
    // Torso
    [11, 23], [12, 24], [23, 24],
    // Left leg
    [23, 25], [25, 27],
    // Right leg
    [24, 26], [26, 28],
  ];

  /// Upper body connections only
  static const List<List<int>> upperBodyConnections = [
    [11, 12],  // Shoulders
    [11, 13], [13, 15],  // Left arm
    [12, 14], [14, 16],  // Right arm
    [11, 23], [12, 24], [23, 24],  // Torso
  ];

  /// Landmark names for debugging
  static const Map<int, String> landmarkNames = {
    0: 'nose',
    1: 'left_eye_inner',
    2: 'left_eye',
    3: 'left_eye_outer',
    4: 'right_eye_inner',
    5: 'right_eye',
    6: 'right_eye_outer',
    7: 'left_ear',
    8: 'right_ear',
    9: 'mouth_left',
    10: 'mouth_right',
    11: 'left_shoulder',
    12: 'right_shoulder',
    13: 'left_elbow',
    14: 'right_elbow',
    15: 'left_wrist',
    16: 'right_wrist',
    17: 'left_pinky',
    18: 'right_pinky',
    19: 'left_index',
    20: 'right_index',
    21: 'left_thumb',
    22: 'right_thumb',
    23: 'left_hip',
    24: 'right_hip',
    25: 'left_knee',
    26: 'right_knee',
    27: 'left_ankle',
    28: 'right_ankle',
    29: 'left_heel',
    30: 'right_heel',
    31: 'left_foot_index',
    32: 'right_foot_index',
  };
}

