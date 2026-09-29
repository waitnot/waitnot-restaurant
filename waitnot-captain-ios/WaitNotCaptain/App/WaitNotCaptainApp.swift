import SwiftUI
import UserNotifications

@main
struct WaitNotCaptainApp: App {
    @StateObject private var authStore = AuthStore()
    @StateObject private var appState = AppState()

    init() {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authStore)
                .environmentObject(appState)
        }
    }
}
