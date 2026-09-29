import SwiftUI

struct RunningOrdersView: View {
    @ObservedObject var vm: DashboardViewModel
    @EnvironmentObject var appState: AppState
    @State private var clearTableTarget: ClearTableTarget?
    @State private var confirmDelete: Order?

    var body: some View {
        NavigationStack {
            Group {
                if vm.activeOrders.isEmpty {
                    EmptyStateView(
                        icon: "list.clipboard",
                        title: "No Active Orders",
                        subtitle: "New orders will appear here in real-time."
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            ForEach(vm.runningGrouped, id: \.label) { group in
                                OrderGroupCard(
                                    label: group.label,
                                    orders: group.orders,
                                    vm: vm,
                                    onClearTable: { tableNum in
                                        clearTableTarget = ClearTableTarget(tableNumber: tableNum, orders: group.orders)
                                    },
                                    onCancel: { order in confirmDelete = order }
                                )
                            }
                        }
                        .padding(16)
                        .padding(.bottom, 90)
                    }
                    .refreshable { await vm.loadData() }
                }
            }
            .navigationTitle("Running Orders")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $clearTableTarget) { target in
                ClearTableSheet(target: target, vm: vm) { method, subType, utr in
                    clearTableTarget = nil
                    Task {
                        do {
                            try await vm.clearTable(
                                tableNumber: target.tableNumber,
                                paymentMethod: method,
                                paymentSubType: subType,
                                utrNumber: utr
                            )
                            appState.showToast("Table cleared!")
                        } catch {
                            appState.showError(error.localizedDescription)
                        }
                    }
                }
            }
            .alert("Cancel Order?", isPresented: .constant(confirmDelete != nil), presenting: confirmDelete) { order in
                Button("Cancel Order", role: .destructive) {
                    Task {
                        await vm.cancelOrder(orderId: order.id)
                        appState.showToast("Order cancelled")
                    }
                    confirmDelete = nil
                }
                Button("Keep", role: .cancel) { confirmDelete = nil }
            } message: { order in
                Text("This will remove the entire order for \(order.slotLabel).")
            }
        }
    }
}

// MARK: - Order Group Card
struct OrderGroupCard: View {
    let label: String
    let orders: [Order]
    @ObservedObject var vm: DashboardViewModel
    let onClearTable: (Int) -> Void
    let onCancel: (Order) -> Void
    @EnvironmentObject var appState: AppState
    @State private var isPrintingKOT = false
    @State private var isPrintingBill = false

    var totalAmount: Double { orders.reduce(0) { $0 + $1.totalAmount } }
    var isDineIn: Bool { orders.first?.orderType == .dineIn }
    var tableNumber: Int? { orders.first?.tableNumber }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.headline)
                    Text("\(orders.count) order(s)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("₹\(totalAmount, specifier: "%.0f")")
                    .font(.title3).fontWeight(.bold)
                    .foregroundColor(.brandRed)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(Color(.systemGray6))

            // Items per order
            ForEach(orders) { order in
                VStack(alignment: .leading, spacing: 0) {
                    // Order header
                    HStack {
                        Text("Order #\(order.orderNumber ?? 0)")
                            .font(.caption).fontWeight(.semibold)
                            .foregroundColor(.secondary)
                        Spacer()
                        StatusBadge(status: order.status)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(Color(.systemBackground))

                    // Items
                    ForEach(Array(order.items.enumerated()), id: \.offset) { idx, item in
                        HStack {
                            Text(item.name)
                                .font(.subheadline)
                            Spacer()
                            // Qty controls
                            HStack(spacing: 4) {
                                Button {
                                    Task { await vm.updateRunningItem(orderId: order.id, itemName: item.name, delta: -1) }
                                } label: {
                                    Image(systemName: "minus.circle")
                                        .foregroundColor(.brandRed)
                                }
                                Text("\(item.quantity)")
                                    .font(.subheadline).fontWeight(.bold)
                                    .frame(width: 24, alignment: .center)
                                Button {
                                    Task { await vm.updateRunningItem(orderId: order.id, itemName: item.name, delta: 1) }
                                } label: {
                                    Image(systemName: "plus.circle")
                                        .foregroundColor(.brandRed)
                                }
                                Button {
                                    Task { await vm.deleteRunningItem(orderId: order.id, at: idx) }
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .padding(.horizontal, 16).padding(.vertical, 6)
                        if idx < order.items.count - 1 { Divider().padding(.leading, 16) }
                    }

                    // Per-order actions
                    HStack(spacing: 10) {
                        ActionButton(label: "KOT", icon: "printer", loading: isPrintingKOT) {
                            isPrintingKOT = true
                            let result = await vm.printKOT(order: order)
                            isPrintingKOT = false
                            if case .failure(let e) = result { appState.showError(e.errorDescription ?? "Print failed") }
                            else { appState.showToast("KOT printed") }
                        }
                        ActionButton(label: "Bill", icon: "doc.text", loading: isPrintingBill) {
                            isPrintingBill = true
                            let result = await vm.printBill(orders: [order], paymentMethod: nil)
                            isPrintingBill = false
                            if case .failure(let e) = result { appState.showError(e.errorDescription ?? "Print failed") }
                            else { appState.showToast("Bill printed") }
                        }
                        ActionButton(label: "Cancel", icon: "trash", tint: .secondary) {
                            onCancel(order)
                        }
                    }
                    .padding(.horizontal, 12).padding(.vertical, 10)
                }
                .background(Color(.systemBackground))
                if order.id != orders.last?.id { Divider() }
            }

            // Footer: Clear table (dine-in only)
            if isDineIn, let tableNum = tableNumber {
                Divider()
                Button {
                    onClearTable(tableNum)
                } label: {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Clear Table & Pay")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .background(Color.brandRed)
                    .foregroundColor(.white)
                }
            }
        }
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 2)
    }
}

// MARK: - Clear Table Sheet
struct ClearTableTarget: Identifiable {
    let id = UUID()
    let tableNumber: Int
    let orders: [Order]
}

struct ClearTableSheet: View {
    let target: ClearTableTarget
    let vm: DashboardViewModel
    let onConfirm: (PaymentMethod, String?, String?) -> Void
    @Environment(\.dismiss) var dismiss
    @State private var step: Step = .chooseMethod
    @State private var onlineType: OnlineType = .upi
    @State private var utrNumber = ""

    enum Step { case chooseMethod, enterUTR }
    enum OnlineType: String, CaseIterable { case upi = "UPI", card = "Card" }

    var totalAmount: Double { target.orders.reduce(0) { $0 + $1.totalAmount } }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Handle bar
                Capsule().fill(Color(.systemGray4))
                    .frame(width: 36, height: 4)
                    .padding(.top, 12)

                VStack(spacing: 20) {
                    VStack(spacing: 4) {
                        Text("Clear Table \(target.tableNumber)")
                            .font(.title3).fontWeight(.bold)
                        Text("Total: ₹\(totalAmount, specifier: "%.0f")")
                            .font(.headline).foregroundColor(.brandRed)
                    }
                    .padding(.top, 16)

                    if step == .chooseMethod {
                        VStack(spacing: 12) {
                            PaymentMethodRow(icon: "📱", title: "Online Payment", subtitle: "UPI / Card") {
                                step = .enterUTR
                            }
                            PaymentMethodRow(icon: "💵", title: "Cash", subtitle: "Paid at table") {
                                onConfirm(.cash, nil, nil)
                                dismiss()
                            }
                        }
                    } else {
                        VStack(spacing: 16) {
                            Button { step = .chooseMethod } label: {
                                HStack {
                                    Image(systemName: "chevron.left")
                                    Text("Back")
                                }
                                .foregroundColor(.brandRed)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            // Method picker
                            HStack(spacing: 8) {
                                ForEach(OnlineType.allCases, id: \.self) { t in
                                    Button { onlineType = t } label: {
                                        Text(t.rawValue)
                                            .fontWeight(.semibold)
                                            .frame(maxWidth: .infinity)
                                            .padding(10)
                                            .background(onlineType == t ? Color.brandRed : Color(.systemGray6))
                                            .foregroundColor(onlineType == t ? .white : .primary)
                                            .cornerRadius(10)
                                    }
                                }
                            }

                            TextField("UTR / Reference (optional)", text: $utrNumber)
                                .padding(12)
                                .background(Color(.systemGray6))
                                .cornerRadius(10)

                            Button {
                                let method: PaymentMethod = onlineType == .upi ? .upi : .card
                                onConfirm(method, onlineType.rawValue, utrNumber.isEmpty ? nil : utrNumber)
                                dismiss()
                            } label: {
                                Text("Confirm Payment")
                                    .fontWeight(.bold)
                                    .frame(maxWidth: .infinity)
                                    .padding(14)
                                    .background(Color.brandRed)
                                    .foregroundColor(.white)
                                    .cornerRadius(12)
                            }
                        }
                    }

                    Button("Cancel") { dismiss() }
                        .foregroundColor(.secondary)
                }
                .padding(20)
            }
        }
        .presentationDetents([.medium])
    }
}

struct PaymentMethodRow: View {
    let icon: String; let title: String; let subtitle: String; let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Text(icon).font(.system(size: 28))
                VStack(alignment: .leading) {
                    Text(title).fontWeight(.semibold)
                    Text(subtitle).font(.caption).foregroundColor(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundColor(.secondary)
            }
            .padding(14)
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Supporting Views
struct StatusBadge: View {
    let status: OrderStatus
    var body: some View {
        Text(status.displayName)
            .font(.caption2).fontWeight(.semibold)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(statusColor.opacity(0.15))
            .foregroundColor(statusColor)
            .cornerRadius(6)
    }
    var statusColor: Color {
        switch status {
        case .pending:   return .orange
        case .preparing: return .blue
        case .ready:     return .green
        case .completed: return .secondary
        case .cancelled: return .red
        }
    }
}

struct ActionButton: View {
    let label: String
    let icon: String
    var loading: Bool = false
    var tint: Color = .brandRed
    let action: () async -> Void

    var body: some View {
        Button { Task { await action() } } label: {
            HStack(spacing: 4) {
                if loading { ProgressView().scaleEffect(0.7) }
                else { Image(systemName: icon).font(.system(size: 12)) }
                Text(label).font(.caption).fontWeight(.medium)
            }
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(tint.opacity(0.1))
            .foregroundColor(tint)
            .cornerRadius(8)
        }
    }
}
