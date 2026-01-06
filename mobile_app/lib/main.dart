import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pose_spatial_studio/app.dart';
import 'package:pose_spatial_studio/providers/pose_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => PoseProvider(),
      child: const PoseSpatialStudioApp(),
    ),
  );
}

