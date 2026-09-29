import Foundation
import UserNotifications
import AVFoundation

final class NotificationService {
    static let shared = NotificationService()
    private var audioPlayer: AVAudioPlayer?
    private init() {}

    func requestPermission() async {
        _ = try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])
    }

    func showNewOrderNotification(order: Order) {
        let content = UNMutableNotificationContent()
        content.title = "New Order! 🔔"
        content.body = "\(order.slotLabel) — \(order.items.count) item(s)"
        content.sound = .default
        let req = UNNotificationRequest(
            identifier: "order-\(order.id)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
        playOrderSound()
    }

    func playOrderSound() {
        // Use system sound as fallback; replace with bundled sound file
        AudioServicesPlaySystemSound(1322)
    }

    func registerFCMToken(restaurantId: String, token: String) async {
        struct Req: Codable { let fcmToken: String; let restaurantId: String; let platform: String }
        let body = Req(fcmToken: token, restaurantId: restaurantId, platform: "ios")
        let keychain = KeychainService.shared
        guard let authToken = keychain.load(forKey: .staffToken) else { return }
        try? await APIClient.shared.requestVoid(
            "/api/devices/register-direct",
            method: "POST",
            body: body,
            token: authToken
        )
    }
}

// MARK: - Notification Delegate
final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()
    private override init() { super.init() }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }
}

import AudioToolbox
