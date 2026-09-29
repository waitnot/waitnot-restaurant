import SwiftUI
import Combine

/// Global app-level state (toast, network reachability, etc.)
@MainActor
final class AppState: ObservableObject {
    @Published var toast: Toast?
    private var toastTask: Task<Void, Never>?

    func showToast(_ message: String, type: Toast.ToastType = .success) {
        toastTask?.cancel()
        toast = Toast(message: message, type: type)
        toastTask = Task {
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            if !Task.isCancelled { toast = nil }
        }
    }

    func showError(_ message: String) {
        showToast(message, type: .error)
    }
}

struct Toast: Equatable {
    let message: String
    let type: ToastType
    let id = UUID()

    enum ToastType { case success, error, info }

    static func == (lhs: Toast, rhs: Toast) -> Bool { lhs.id == rhs.id }
}
