import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:pose_spatial_studio/providers/pose_provider.dart';
import 'package:pose_spatial_studio/widgets/skeleton_painter.dart';
import 'package:pose_spatial_studio/widgets/connection_status.dart';

/// Main screen with skeleton visualization and streaming controls.
class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> with WidgetsBindingObserver {
  bool _permissionGranted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final provider = context.read<PoseProvider>();
    if (state == AppLifecycleState.paused && provider.isStreaming) {
      provider.stopStreaming();
    }
  }

  Future<void> _checkPermissions() async {
    final status = await Permission.camera.request();
    setState(() {
      _permissionGranted = status.isGranted;
    });
    
    if (!status.isGranted && mounted) {
      _showPermissionDialog();
    }
  }

  void _showPermissionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Camera Permission Required'),
        content: const Text(
          'This app needs camera access to capture video for pose estimation. '
          'Please grant camera permission in Settings.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              openAppSettings();
            },
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<PoseProvider>(
        builder: (context, provider, child) {
          return Stack(
            children: [
              // Background gradient
              Container(
                decoration: const BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.center,
                    radius: 1.5,
                    colors: [
                      Color(0xFF1A1A2E),
                      Color(0xFF0A0A0A),
                    ],
                  ),
                ),
              ),

              // Grid pattern overlay
              CustomPaint(
                size: Size.infinite,
                painter: _GridPainter(),
              ),

              // Skeleton visualization
              if (provider.hasLandmarks)
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: SkeletonView(
                      landmarks: provider.landmarks,
                      jointColor: Theme.of(context).colorScheme.primary,
                      stickColor: Colors.white.withOpacity(0.9),
                    ),
                  ),
                ),

              // Placeholder when no pose detected
              if (!provider.hasLandmarks && provider.isStreaming)
                Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.accessibility_new,
                        size: 80,
                        color: Colors.white.withOpacity(0.2),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Waiting for pose...',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.5),
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),

              // Top bar with status
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header row
                      Row(
                        children: [
                          // App title
                          const Expanded(
                            child: Text(
                              'Pose Studio',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          // Connection status
                          ConnectionStatusIndicator(
                            connectionState: provider.connectionState,
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 8),
                      
                      // Status/error messages
                      if (provider.errorMessage != null)
                        _StatusChip(
                          message: provider.errorMessage!,
                          isError: true,
                          onDismiss: provider.clearError,
                        )
                      else if (provider.statusMessage != null)
                        _StatusChip(
                          message: provider.statusMessage!,
                          isError: false,
                        ),

                      // FPS counter when streaming
                      if (provider.isStreaming && provider.fps > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            '${provider.fps.toStringAsFixed(1)} FPS',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.6),
                              fontSize: 12,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // Bottom controls
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Main streaming button
                        _StreamingButton(
                          isConnected: provider.isConnected,
                          isStreaming: provider.isStreaming,
                          permissionGranted: _permissionGranted,
                          onPressed: () async {
                            if (!provider.isConnected) {
                              await provider.connect();
                            } else {
                              await provider.toggleStreaming();
                            }
                          },
                        ),
                        
                        const SizedBox(height: 16),
                        
                        // Secondary controls
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Switch camera button
                            if (provider.isStreaming)
                              _IconButton(
                                icon: Icons.flip_camera_ios,
                                label: 'Flip',
                                onPressed: provider.switchCamera,
                              ),
                            
                            const SizedBox(width: 24),
                            
                            // Disconnect button
                            if (provider.isConnected)
                              _IconButton(
                                icon: Icons.power_settings_new,
                                label: 'Disconnect',
                                color: Colors.red,
                                onPressed: provider.disconnect,
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Streaming control button
class _StreamingButton extends StatelessWidget {
  final bool isConnected;
  final bool isStreaming;
  final bool permissionGranted;
  final VoidCallback onPressed;

  const _StreamingButton({
    required this.isConnected,
    required this.isStreaming,
    required this.permissionGranted,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final (label, icon, color) = !isConnected
        ? ('Connect', Icons.wifi, Theme.of(context).colorScheme.primary)
        : isStreaming
            ? ('Stop', Icons.stop_circle, const Color(0xFFFF4081))
            : ('Start', Icons.play_circle, const Color(0xFF4CAF50));

    return SizedBox(
      width: 200,
      height: 56,
      child: ElevatedButton.icon(
        onPressed: permissionGranted ? onPressed : null,
        icon: Icon(icon, size: 28),
        label: Text(
          label,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          disabledBackgroundColor: Colors.grey.shade800,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
        ),
      ),
    );
  }
}

/// Small icon button with label
class _IconButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  final VoidCallback onPressed;

  const _IconButton({
    required this.icon,
    required this.label,
    this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: color ?? Colors.white70,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 24),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}

/// Status message chip
class _StatusChip extends StatelessWidget {
  final String message;
  final bool isError;
  final VoidCallback? onDismiss;

  const _StatusChip({
    required this.message,
    required this.isError,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: (isError ? Colors.red : Colors.blue).withOpacity(0.2),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.info_outline,
            size: 14,
            color: isError ? Colors.red : Colors.blue,
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              message,
              style: TextStyle(
                color: isError ? Colors.red : Colors.blue,
                fontSize: 12,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (onDismiss != null) ...[
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onDismiss,
              child: Icon(
                Icons.close,
                size: 14,
                color: isError ? Colors.red : Colors.blue,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Background grid pattern painter
class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.03)
      ..strokeWidth = 1;

    const spacing = 40.0;

    // Vertical lines
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    // Horizontal lines
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

