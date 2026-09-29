import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var appState: AppState

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var showPassword = false
    @State private var errorMessage: String?
    @State private var serverWaking = false

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                Spacer(minLength: 60)

                // Logo
                VStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(Color.brandRed)
                            .frame(width: 72, height: 72)
                        Image(systemName: "person.2.fill")
                            .font(.system(size: 30))
                            .foregroundColor(.white)
                    }
                    Text("Staff Login")
                        .font(.system(size: 28, weight: .bold))
                    Text("Access your staff dashboard")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                // Form card
                VStack(spacing: 20) {
                    if let err = errorMessage {
                        HStack {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(.red)
                            Text(err)
                                .font(.subheadline)
                                .foregroundColor(.red)
                        }
                        .padding(12)
                        .background(Color.red.opacity(0.08))
                        .cornerRadius(10)
                    }

                    if serverWaking && !isLoading {
                        HStack(spacing: 8) {
                            ProgressView().scaleEffect(0.8)
                            Text("Server is starting up, please wait...")
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                        .padding(12)
                        .background(Color.orange.opacity(0.08))
                        .cornerRadius(10)
                    }

                    // Email field
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email Address")
                            .font(.subheadline).fontWeight(.medium)
                        HStack {
                            Image(systemName: "envelope")
                                .foregroundColor(.secondary)
                                .frame(width: 20)
                            TextField("Enter your email", text: $email)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .onChange(of: email) { _ in errorMessage = nil }
                        }
                        .padding(14)
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                    }

                    // Password field
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Password")
                            .font(.subheadline).fontWeight(.medium)
                        HStack {
                            Image(systemName: "lock")
                                .foregroundColor(.secondary)
                                .frame(width: 20)
                            if showPassword {
                                TextField("Enter your password", text: $password)
                                    .onChange(of: password) { _ in errorMessage = nil }
                            } else {
                                SecureField("Enter your password", text: $password)
                                    .onChange(of: password) { _ in errorMessage = nil }
                            }
                            Button(action: { showPassword.toggle() }) {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(14)
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                    }

                    // Sign In button
                    Button(action: { Task { await login() } }) {
                        HStack(spacing: 8) {
                            if isLoading { ProgressView().tint(.white) }
                            Text(isLoading ? (serverWaking ? "Server starting..." : "Signing In...") : "Sign In")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(16)
                        .background(isLoading ? Color.brandRed.opacity(0.7) : Color.brandRed)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                }
                .padding(24)
                .background(Color(.systemBackground))
                .cornerRadius(20)
                .shadow(color: .black.opacity(0.07), radius: 12, x: 0, y: 4)

                Text("Staff Portal — WaitNot Restaurant Management System")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)

                Spacer(minLength: 40)
            }
            .padding(.horizontal, 24)
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .task { await pingServer() }
    }

    // MARK: - Actions
    private func login() async {
        guard !email.isEmpty, !password.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await authStore.login(email: email, password: password)
        } catch let err as APIError {
            if case .unauthorized = err {
                errorMessage = "Invalid email or password."
            } else {
                errorMessage = err.errorDescription ?? "Login failed."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func pingServer() async {
        guard let url = URL(string: "https://waitnot-restaurant.onrender.com/health") else { return }
        do {
            let (_, resp) = try await URLSession.shared.data(from: url)
            if (resp as? HTTPURLResponse)?.statusCode != 200 { throw URLError(.badServerResponse) }
        } catch {
            serverWaking = true
            // retry once
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            _ = try? await URLSession.shared.data(from: url)
            serverWaking = false
        }
    }
}
