import SwiftUI

struct HistoryView: View {
    @ObservedObject var vm: DashboardViewModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                HStack {
                    Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                    TextField("Search by name, table, order ID...", text: $vm.historySearch)
                        .autocorrectionDisabled()
                    if !vm.historySearch.isEmpty {
                        Button { vm.historySearch = "" } label: {
                            Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                        }
                    }
                }
                .padding(10)
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .padding(.horizontal, 16).padding(.vertical, 10)

                Divider()

                Group {
                    if vm.isLoadingHistory {
                        ProgressView("Loading history...")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if vm.filteredHistory.isEmpty {
                        EmptyStateView(
                            icon: "clock.arrow.circlepath",
                            title: "No Orders Found",
                            subtitle: vm.historySearch.isEmpty ? "Completed orders will appear here." : "No orders match your search."
                        )
                    } else {
                        List(vm.filteredHistory) { order in
                            HistoryOrderRow(order: order)
                                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                                .listRowSeparator(.hidden)
                        }
                        .listStyle(.plain)
                    }
                }
            }
            .navigationTitle("Order History")
            .navigationBarTitleDisplayMode(.inline)
            .task { await vm.loadHistory() }
            .refreshable { await vm.loadHistory() }
        }
    }
}

struct HistoryOrderRow: View {
    let order: Order
    var formattedDate: String {
        order.createdAt.formattedDate()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(order.slotLabel)
                    .font(.subheadline).fontWeight(.semibold)
                Spacer()
                Text("₹\(order.totalAmount, specifier: "%.0f")")
                    .font(.subheadline).fontWeight(.bold)
                    .foregroundColor(.brandRed)
            }

            HStack {
                if let name = order.customerName, !name.isEmpty {
                    Label(name, systemImage: "person")
                        .font(.caption).foregroundColor(.secondary)
                }
                Spacer()
                Label(formattedDate, systemImage: "clock")
                    .font(.caption).foregroundColor(.secondary)
            }

            // Items summary
            let itemSummary = order.items.prefix(3).map { "\($0.name) ×\($0.quantity)" }.joined(separator: ", ")
            Text(itemSummary + (order.items.count > 3 ? "..." : ""))
                .font(.caption).foregroundColor(.secondary)
                .lineLimit(2)

            HStack(spacing: 8) {
                if let method = order.paymentMethod {
                    Label(method.displayName, systemImage: "creditcard")
                        .font(.caption2).fontWeight(.medium)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.green.opacity(0.1))
                        .foregroundColor(.green)
                        .cornerRadius(6)
                }
                Label(order.orderType.displayName, systemImage: "tag")
                    .font(.caption2)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Color(.systemGray6))
                    .cornerRadius(6)
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.04), radius: 4, x: 0, y: 2)
    }
}
