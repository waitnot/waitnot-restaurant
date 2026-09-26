import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure Firebase if available (loaded via CocoaPods)
        configureFirebaseIfAvailable()
        return true
    }

    private func configureFirebaseIfAvailable() {
        // Only configure if GoogleService-Info.plist is bundled
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else { return }

        // Use NSClassFromString to avoid compile-time dependency on Firebase
        guard let firebaseAppClass = NSClassFromString("FIRApp") as? NSObject.Type else { return }
        let selector = NSSelectorFromString("configure")
        if firebaseAppClass.responds(to: selector) {
            firebaseAppClass.perform(selector)
        }
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
