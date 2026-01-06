import AVFoundation
import Flutter
import UIKit

/// Native iOS camera handler for high-performance frame capture and streaming.
class CameraHandler: NSObject, FlutterStreamHandler, AVCaptureVideoDataOutputSampleBufferDelegate {
    
    // MARK: - Properties
    
    private var eventSink: FlutterEventSink?
    private let captureSession = AVCaptureSession()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let queue = DispatchQueue(label: "camera_frame_queue", qos: .userInteractive)
    
    private var currentCameraPosition: AVCaptureDevice.Position = .front
    private var jpegQuality: CGFloat = 0.5
    private var isConfigured = false
    
    // Frame rate limiting
    private var lastFrameTime: CFTimeInterval = 0
    private let targetFrameInterval: CFTimeInterval = 1.0 / 15.0 // 15 FPS
    
    // MARK: - FlutterStreamHandler
    
    func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
        self.eventSink = events
        return nil
    }
    
    func onCancel(withArguments arguments: Any?) -> FlutterError? {
        self.eventSink = nil
        return nil
    }
    
    // MARK: - Camera Setup
    
    func setupCamera() -> Bool {
        guard !isConfigured else { return true }
        
        captureSession.beginConfiguration()
        captureSession.sessionPreset = .medium // Balance quality vs performance
        
        // Setup camera input
        guard let videoDevice = getCamera(position: currentCameraPosition),
              let videoDeviceInput = try? AVCaptureDeviceInput(device: videoDevice),
              captureSession.canAddInput(videoDeviceInput) else {
            captureSession.commitConfiguration()
            return false
        }
        
        captureSession.addInput(videoDeviceInput)
        
        // Setup video output
        videoOutput.setSampleBufferDelegate(self, queue: queue)
        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        
        if captureSession.canAddOutput(videoOutput) {
            captureSession.addOutput(videoOutput)
        }
        
        // Set video orientation
        if let connection = videoOutput.connection(with: .video) {
            if connection.isVideoOrientationSupported {
                connection.videoOrientation = .portrait
            }
            if connection.isVideoMirroringSupported && currentCameraPosition == .front {
                connection.isVideoMirrored = true
            }
        }
        
        captureSession.commitConfiguration()
        isConfigured = true
        return true
    }
    
    private func getCamera(position: AVCaptureDevice.Position) -> AVCaptureDevice? {
        return AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position)
    }
    
    // MARK: - Camera Control
    
    func startCapture() {
        guard isConfigured else {
            _ = setupCamera()
        }
        
        if !captureSession.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.captureSession.startRunning()
            }
        }
    }
    
    func stopCapture() {
        if captureSession.isRunning {
            captureSession.stopRunning()
        }
    }
    
    func switchCamera() {
        guard isConfigured else { return }
        
        captureSession.beginConfiguration()
        
        // Remove existing input
        if let currentInput = captureSession.inputs.first as? AVCaptureDeviceInput {
            captureSession.removeInput(currentInput)
        }
        
        // Toggle camera position
        currentCameraPosition = (currentCameraPosition == .front) ? .back : .front
        
        // Add new input
        guard let newDevice = getCamera(position: currentCameraPosition),
              let newInput = try? AVCaptureDeviceInput(device: newDevice),
              captureSession.canAddInput(newInput) else {
            captureSession.commitConfiguration()
            return
        }
        
        captureSession.addInput(newInput)
        
        // Update video mirroring
        if let connection = videoOutput.connection(with: .video) {
            if connection.isVideoMirroringSupported {
                connection.isVideoMirrored = (currentCameraPosition == .front)
            }
        }
        
        captureSession.commitConfiguration()
    }
    
    func setQuality(_ quality: CGFloat) {
        jpegQuality = max(0.1, min(1.0, quality))
    }
    
    // MARK: - AVCaptureVideoDataOutputSampleBufferDelegate
    
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        // Frame rate limiting
        let currentTime = CACurrentMediaTime()
        guard currentTime - lastFrameTime >= targetFrameInterval else { return }
        lastFrameTime = currentTime
        
        guard let eventSink = eventSink else { return }
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        
        // Convert to UIImage
        let ciImage = CIImage(cvPixelBuffer: imageBuffer)
        let context = CIContext()
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else { return }
        
        let uiImage = UIImage(cgImage: cgImage)
        
        // Compress to JPEG and encode as Base64
        guard let imageData = uiImage.jpegData(compressionQuality: jpegQuality) else { return }
        let base64String = imageData.base64EncodedString()
        
        // Send to Flutter
        DispatchQueue.main.async {
            eventSink(base64String)
        }
    }
}

// MARK: - Flutter Plugin Registration

class CameraPlugin: NSObject, FlutterPlugin {
    
    private let cameraHandler = CameraHandler()
    
    static func register(with registrar: FlutterPluginRegistrar) {
        let instance = CameraPlugin()
        
        // Method channel for control commands
        let methodChannel = FlutterMethodChannel(
            name: "site.yingliu.robot/camera",
            binaryMessenger: registrar.messenger()
        )
        registrar.addMethodCallDelegate(instance, channel: methodChannel)
        
        // Event channel for frame streaming
        let eventChannel = FlutterEventChannel(
            name: "site.yingliu.robot/camera_stream",
            binaryMessenger: registrar.messenger()
        )
        eventChannel.setStreamHandler(instance.cameraHandler)
    }
    
    func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "setupCamera":
            let success = cameraHandler.setupCamera()
            result(success)
            
        case "startCamera":
            cameraHandler.startCapture()
            result(nil)
            
        case "stopCamera":
            cameraHandler.stopCapture()
            result(nil)
            
        case "switchCamera":
            cameraHandler.switchCamera()
            result(nil)
            
        case "setQuality":
            if let args = call.arguments as? [String: Any],
               let quality = args["quality"] as? Double {
                cameraHandler.setQuality(CGFloat(quality))
            }
            result(nil)
            
        default:
            result(FlutterMethodNotImplemented)
        }
    }
}

