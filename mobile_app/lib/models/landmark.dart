/// Represents a single pose landmark with 3D coordinates and visibility.
class Landmark {
  final double x;
  final double y;
  final double z;
  final double visibility;
  final double presence;

  const Landmark({
    required this.x,
    required this.y,
    required this.z,
    this.visibility = 1.0,
    this.presence = 1.0,
  });

  factory Landmark.fromJson(Map<String, dynamic> json) {
    return Landmark(
      x: (json['x'] as num?)?.toDouble() ?? 0.0,
      y: (json['y'] as num?)?.toDouble() ?? 0.0,
      z: (json['z'] as num?)?.toDouble() ?? 0.0,
      visibility: (json['visibility'] as num?)?.toDouble() ?? 1.0,
      presence: (json['presence'] as num?)?.toDouble() ?? 1.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'x': x,
      'y': y,
      'z': z,
      'visibility': visibility,
      'presence': presence,
    };
  }

  /// Check if this landmark is visible enough to render
  bool isVisible([double threshold = 0.5]) => visibility > threshold;

  @override
  String toString() => 'Landmark(x: $x, y: $y, z: $z, vis: $visibility)';
}

