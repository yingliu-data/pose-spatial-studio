import 'package:flutter/material.dart';
import 'package:pose_spatial_studio/config/app_config.dart';
import 'package:pose_spatial_studio/models/landmark.dart';
import 'package:pose_spatial_studio/utils/pose_connections.dart';

/// Custom painter for rendering ball-and-stick skeleton visualization.
class SkeletonPainter extends CustomPainter {
  final List<Landmark> landmarks;
  final Color jointColor;
  final Color stickColor;
  final double jointRadius;
  final double stickWidth;
  final double visibilityThreshold;
  final bool showFace;
  final bool useDepthShading;

  SkeletonPainter({
    required this.landmarks,
    this.jointColor = const Color(0xFF00E5FF),
    this.stickColor = const Color(0xFFFFFFFF),
    this.jointRadius = AppConfig.jointRadius,
    this.stickWidth = AppConfig.stickWidth,
    this.visibilityThreshold = AppConfig.visibilityThreshold,
    this.showFace = false,
    this.useDepthShading = true,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (landmarks.isEmpty) return;

    final jointPaint = Paint()
      ..style = PaintingStyle.fill;

    final stickPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stickWidth
      ..strokeCap = StrokeCap.round;

    // Get canvas-mapped offset for a landmark
    Offset getOffset(Landmark lm) {
      return Offset(
        lm.x * size.width,
        lm.y * size.height,
      );
    }

    // Calculate color based on depth (z coordinate)
    Color getDepthColor(Color baseColor, double z) {
      if (!useDepthShading) return baseColor;
      // z typically ranges from -0.5 to 0.5, normalize to 0-1
      final depth = (z + 0.5).clamp(0.0, 1.0);
      // Closer = brighter, further = dimmer
      final brightness = 0.5 + (1 - depth) * 0.5;
      return HSLColor.fromColor(baseColor)
          .withLightness((HSLColor.fromColor(baseColor).lightness * brightness).clamp(0.0, 1.0))
          .toColor();
    }

    // Select connections based on showFace setting
    final connections = showFace 
        ? PoseConnections.connections 
        : PoseConnections.bodyConnections;

    // Draw sticks (connections) first
    for (final connection in connections) {
      final startIdx = connection[0];
      final endIdx = connection[1];
      
      if (startIdx >= landmarks.length || endIdx >= landmarks.length) continue;
      
      final startLm = landmarks[startIdx];
      final endLm = landmarks[endIdx];
      
      if (!startLm.isVisible(visibilityThreshold) || 
          !endLm.isVisible(visibilityThreshold)) continue;

      final p1 = getOffset(startLm);
      final p2 = getOffset(endLm);
      
      // Average depth for stick color
      final avgZ = (startLm.z + endLm.z) / 2;
      stickPaint.color = getDepthColor(stickColor, avgZ);
      
      canvas.drawLine(p1, p2, stickPaint);
    }

    // Draw joints (balls) on top
    for (int i = 0; i < landmarks.length; i++) {
      // Skip face landmarks if not showing face
      if (!showFace && i < 11) continue;
      
      final lm = landmarks[i];
      if (!lm.isVisible(visibilityThreshold)) continue;

      final offset = getOffset(lm);
      jointPaint.color = getDepthColor(jointColor, lm.z);
      
      // Vary radius slightly based on depth
      final depthRadius = useDepthShading 
          ? jointRadius * (1.0 + (0.5 - lm.z) * 0.3)
          : jointRadius;
      
      canvas.drawCircle(offset, depthRadius, jointPaint);
    }
  }

  @override
  bool shouldRepaint(covariant SkeletonPainter oldDelegate) {
    return oldDelegate.landmarks != landmarks ||
           oldDelegate.jointColor != jointColor ||
           oldDelegate.stickColor != stickColor;
  }
}

/// Widget wrapper for SkeletonPainter with convenient defaults.
class SkeletonView extends StatelessWidget {
  final List<Landmark> landmarks;
  final Color? jointColor;
  final Color? stickColor;
  final bool showFace;

  const SkeletonView({
    super.key,
    required this.landmarks,
    this.jointColor,
    this.stickColor,
    this.showFace = false,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: SkeletonPainter(
        landmarks: landmarks,
        jointColor: jointColor ?? Theme.of(context).colorScheme.primary,
        stickColor: stickColor ?? Colors.white,
        showFace: showFace,
      ),
      size: Size.infinite,
    );
  }
}

