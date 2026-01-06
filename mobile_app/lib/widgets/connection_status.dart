import 'package:flutter/material.dart';
import 'package:pose_spatial_studio/services/socket_service.dart';

/// Widget displaying WebSocket connection status indicator.
class ConnectionStatusIndicator extends StatelessWidget {
  final ConnectionState connectionState;
  final bool showLabel;

  const ConnectionStatusIndicator({
    super.key,
    required this.connectionState,
    this.showLabel = true,
  });

  @override
  Widget build(BuildContext context) {
    final (color, label, icon) = switch (connectionState) {
      ConnectionState.connected => (
        const Color(0xFF4CAF50),
        'Connected',
        Icons.wifi,
      ),
      ConnectionState.connecting => (
        const Color(0xFFFF9800),
        'Connecting...',
        Icons.wifi_find,
      ),
      ConnectionState.disconnected => (
        const Color(0xFF9E9E9E),
        'Disconnected',
        Icons.wifi_off,
      ),
      ConnectionState.error => (
        const Color(0xFFF44336),
        'Error',
        Icons.error_outline,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 16),
          if (showLabel) ...[
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Animated connection status dot
class ConnectionDot extends StatefulWidget {
  final ConnectionState connectionState;
  final double size;

  const ConnectionDot({
    super.key,
    required this.connectionState,
    this.size = 10,
  });

  @override
  State<ConnectionDot> createState() => _ConnectionDotState();
}

class _ConnectionDotState extends State<ConnectionDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _updateAnimation();
  }

  @override
  void didUpdateWidget(ConnectionDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.connectionState != widget.connectionState) {
      _updateAnimation();
    }
  }

  void _updateAnimation() {
    if (widget.connectionState == ConnectionState.connecting) {
      _controller.repeat();
    } else {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = switch (widget.connectionState) {
      ConnectionState.connected => const Color(0xFF4CAF50),
      ConnectionState.connecting => const Color(0xFFFF9800),
      ConnectionState.disconnected => const Color(0xFF9E9E9E),
      ConnectionState.error => const Color(0xFFF44336),
    };

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final opacity = widget.connectionState == ConnectionState.connecting
            ? 0.5 + 0.5 * (1 - _controller.value)
            : 1.0;
        
        return Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withOpacity(opacity),
            boxShadow: [
              BoxShadow(
                color: color.withOpacity(0.5),
                blurRadius: widget.size / 2,
                spreadRadius: 1,
              ),
            ],
          ),
        );
      },
    );
  }
}

