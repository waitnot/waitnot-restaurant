import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Register WifiPrinter plugin for iOS TCP printing
        let bridge = CAPBridgeViewController()
        _ = bridge  // plugin registration happens automatically via @objc annotation

        // Configure Firebase if available (loaded via CocoaPods)
        configureFirebaseIfAvailable()
        return true
    }

    private func configureFirebaseIfAvailable() {
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else { return }
        guard let firebaseAppClass = NSClassFromString("FIRApp") as? NSObject.Type else { return }
        let selector = NSSelectorFromString("configure")
        if firebaseAppClass.responds(to: selector) {
            firebaseAppClass.perform(selector)
        }
    }

    // MARK: - Push Notifications (Firebase Messaging)

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(
            name: Notification.Name(CAPNotifications.DidRegisterForRemoteNotificationsWithDeviceToken.name()),
            object: deviceToken
        )
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: Notification.Name(CAPNotifications.DidFailToRegisterForRemoteNotificationsWithError.name()),
            object: error
        )
    }

    // MARK: - Scene lifecycle

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
