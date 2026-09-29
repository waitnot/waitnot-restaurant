import SwiftUI

struct TablesView: View {
    @ObservedObject var vm: DashboardViewModel

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading {
                    ProgressView("Loading...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let restaurant = vm.restaurant {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 24) {

                            // Dine-In Tables
                            if restaurant.tables > 0 {
                                SectionHeader(title: "DINE-IN TABLES") {
                                    HStack(spacing: 12) {
                                        LegendDot(color: .green, label: "Free")
                                        LegendDot(color: .brandRed, label: "Occupied")
                                    }
                                }
                                LazyVGrid(columns: Array(repeating: .init(.flexible(), spacing: 10), count: 5), spacing: 10) {
                                    ForEach(1...restaurant.tables, id: \.self) { n in
                                        TableButton(
                                            number: n,
                                            status: vm.tableStatus(n),
                                            total: vm.tableTotal(n)
                                        ) {
                                            vm.selectTable(n)
                                        }
                                    }
                                }
                                .padding(.horizontal)
                            }

                            // Rooms
                            if restaurant.rooms > 0 {
                                SectionHeader(title: "ROOMS")
                                LazyVGrid(columns: Array(repeating: .init(.flexible(), spacing: 10), count: 4), spacing: 10) {
                                    ForEach(1...restaurant.rooms, id: \.self) { n in
                                        let name = restaurant.features?.roomNames?[String(n)] ?? "Room \(n)"
                                        RoomButton(name: name, hasOrders: !vm.ordersForRoom(n).isEmpty) {
                                            vm.selectRoom(n)
                                        }
                                    }
                                }
                                .padding(.horizontal)
                            }

                            // Quick Orders
                            SectionHeader(title: "QUICK ORDER")
                            HStack(spacing: 12) {
                                QuickOrderButton(label: "Takeaway", icon: "🥡", color: .orange) {
                                    vm.selectTakeaway()
                                }
                                QuickOrderButton(label: "Delivery", icon: "🛵", color: .blue) {
                                    vm.selectDelivery()
                                }
                            }
                            .padding(.horizontal)

                            Spacer(minLength: 90) // tab bar clearance
                        }
                        .padding(.top, 8)
                    }
                    .refreshable { await vm.loadData() }
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 44))
                            .foregroundColor(.orange)
                        Text(vm.loadError ?? "Failed to load restaurant data.")
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                        Button("Retry") { Task { await vm.loadData() } }
                            .buttonStyle(.borderedProminent)
                            .tint(.brandRed)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle(vm.restaurant?.name ?? "WaitNot")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await vm.logout() }
                    } label: {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
}

// MARK: - Table Button
struct TableButton: View {
    let number: Int
    let status: TableStatus
    let total: Double
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text("\(number)")
                    .font(.system(size: 18, weight: .bold))
                if status == .occupied {
                    Text("₹\(Int(total))")
                        .font(.system(size: 9))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                } else {
                    Text("Free")
                        .font(.system(size: 10))
                        .foregroundColor(.green)
                }
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(1, contentMode: .fit)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(.systemBackground))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(status == .occupied ? Color.brandRed : Color.green, lineWidth: 1.5)
                    )
            )
            .foregroundColor(status == .occupied ? .brandRed : .primary)
            .overlay(alignment: .topTrailing) {
                if status == .occupied {
                    Circle()
                        .fill(Color.brandRed)
                        .frame(width: 8, height: 8)
                        .padding(4)
                }
            }
        }
    }
}

// MARK: - Room Button
struct RoomButton: View {
    let name: String
    let hasOrders: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: "door.left.hand.open")
                    .font(.system(size: 18))
                Text(name)
                    .font(.system(size: 10, weight: .medium))
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(hasOrders ? Color.brandRed.opacity(0.1) : Color(.systemGray6))
                    .overlay(RoundedRectangle(cornerRadius: 10)
                        .stroke(hasOrders ? Color.brandRed : Color.clear, lineWidth: 1.5))
            )
            .foregroundColor(hasOrders ? .brandRed : .primary)
        }
    }
}

// MARK: - Quick Order Button
struct QuickOrderButton: View {
    let label: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(icon).font(.system(size: 28))
                Text(label).font(.system(size: 16, weight: .semibold))
                    .foregroundColor(color)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(color.opacity(0.08))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(color.opacity(0.3), lineWidth: 1))
            .cornerRadius(14)
        }
    }
}

// MARK: - Helpers
struct SectionHeader<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: () -> Trailing

    init(title: String, @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }) {
        self.title = title
        self.trailing = trailing
    }

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.secondary)
                .tracking(1)
            Spacer()
            trailing()
        }
        .padding(.horizontal)
    }
}

struct LegendDot: View {
    let color: Color
    let label: String
    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label).font(.caption).foregroundColor(.secondary)
        }
    }
}
