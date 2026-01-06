import UIKit
import Flutter

@main
@objc class AppDelegate: FlutterAppDelegate {
    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Register Flutter plugins
        GeneratedPluginRegistrant.register(with: self)
        
        // Register custom camera plugin
        if let registrar = self.registrar(forPlugin: "CameraPlugin") {
            CameraPlugin.register(with: registrar)
        }
        
        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
}

