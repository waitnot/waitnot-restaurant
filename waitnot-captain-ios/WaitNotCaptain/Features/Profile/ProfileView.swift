import SwiftUI

struct ProfileView: View {
    @ObservedObject var vm: DashboardViewModel
    @EnvironmentObject var appState: AppState
    @State private var showLogoutAlert = false
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            List {
                // Avatar + name
                Section {
                    HStack(spacing: 16) {
                        AvatarView(name: vm.staffName, size: 60)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(vm.staffName)
                                .font(.title3).fontWeight(.bold)
                            Text(vm.staffRoleDisplay)
                                .font(.subheadline).foregroundColor(.secondary)
                            if let wn = vm.staffWaiterNumber {
                                Text(wn)
                                    .font(.caption)
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Color.brandRed.opacity(0.1))
                                    .foregroundColor(.brandRed)
                                    .cornerRadius(6)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }

                // Restaurant info
                if let restaurant = vm.restaurant {
                    Section("Restaurant") {
                        ProfileRow(icon: "fork.knife",     label: "Name",    value: restaurant.name)
                        if let phone = restaurant.phone {
                            ProfileRow(icon: "phone",          label: "Phone",   value: phone)
                        }
                        if let address = restaurant.address {
                            ProfileRow(icon: "mappin",         label: "Address", value: address)
                        }
                        ProfileRow(icon: "table.furniture",label: "Tables",  value: "\(restaurant.tables)")
                        if restaurant.rooms > 0 {
                            ProfileRow(icon: "door.left.hand.open", label: "Rooms", value: "\(restaurant.rooms)")
                        }
                    }
                }

                // Account
                Section("Account") {
                    if let email = vm.staffEmail {
                        ProfileRow(icon: "envelope", label: "Email", value: email)
                    }
                    if let phone = vm.staffPhone {
                        ProfileRow(icon: "phone", label: "Phone", value: phone)
                    }
                    ProfileRow(icon: "number", label: "Restaurant ID",
                               value: String(vm.restaurantId.prefix(12)) + "...")
                }

                // Printer settings shortcut
                Section {
                    Button {
                        showSettings = true
                    } label: {
                        HStack {
                            Image(systemName: "printer")
                                .foregroundColor(.brandRed)
                            Text("Printer Settings")
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                    .buttonStyle(.plain)
                }

                // Sign out
                Section {
                    Button(role: .destructive) {
                        showLogoutAlert = true
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Sign Out")
                        }
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Sign Out?", isPresented: $showLogoutAlert) {
                Button("Sign Out", role: .destructive) {
                    Task { await vm.logout() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You'll need to sign in again to access your dashboard.")
            }
            .sheet(isPresented: $showSettings) {
                SettingsView(vm: vm)
                    .environmentObject(appState)
            }
        }
    }
}

struct ProfileRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .frame(width: 20)
                .foregroundColor(.brandRed)
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .multilineTextAlignment(.trailing)
                .lineLimit(2)
        }
    }
}

struct AvatarView: View {
    let name: String
    let size: CGFloat

    var initials: String {
        let parts = name.split(separator: " ")
        let first = parts.first?.first.map(String.init) ?? "?"
        let second = parts.dropFirst().first?.first.map(String.init) ?? ""
        return (first + second).uppercased()
    }

    var body: some View {
        ZStack {
            Circle().fill(Color.brandRed)
            Text(initials)
                .font(.system(size: size * 0.35, weight: .bold))
                .foregroundColor(.white)
        }
        .frame(width: size, height: size)
    }
}
