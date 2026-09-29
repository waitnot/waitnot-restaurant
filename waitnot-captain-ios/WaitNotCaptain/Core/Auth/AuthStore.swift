import Foundation
import Combine

@MainActor
final class AuthStore: ObservableObject {
    @Published var staff: Staff?
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private let keychain = KeychainService.shared

    init() {
        // Restore session from Keychain on launch
        if let saved = keychain.staffData, keychain.token != nil {
            staff = saved
            isAuthenticated = true
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let res: LoginResponse = try await api.execute(
                "/api/staff/login",
                method: "POST",
                body: LoginRequest(email: email, password: password)
            )
            keychain.token = res.token
            keychain.staffData = res.staff
            staff = res.staff
            isAuthenticated = true
        } catch APIError.unauthorized {
            error = "Invalid email or password."
        } catch APIError.serverError(_, let msg) {
            error = msg
        } catch APIError.timeout {
            error = "Server is starting up. Please try again in a moment."
        } catch {
            self.error = error.localizedDescription
        }
    }

    func logout() async {
        // Best-effort server logout
        try? await api.executeVoid("/api/staff/logout", method: "POST")
        keychain.clearAll()
        staff = nil
        isAuthenticated = false
    }
}
