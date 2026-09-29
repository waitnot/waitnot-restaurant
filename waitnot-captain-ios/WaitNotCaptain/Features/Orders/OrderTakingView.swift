import SwiftUI

struct OrderTakingView: View {
    @ObservedObject var vm: DashboardViewModel
    let table: SelectedTable
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Order context bar
                OrderContextBar(vm: vm, table: table)

                Divider()

                GeometryReader { geo in
                    if geo.size.width > 600 {
                        // iPad / landscape: side by side
                        HStack(spacing: 0) {
                            MenuPanel(vm: vm).frame(width: geo.size.width * 0.58)
                            Divider()
                            OrderPanel(vm: vm, table: table, dismiss: dismiss)
                                .frame(width: geo.size.width * 0.42)
                        }
                    } else {
                        // iPhone: stacked with cart sheet
                        ZStack(alignment: .bottom) {
                            MenuPanel(vm: vm)
                            CartFloatingButton(vm: vm, table: table, dismiss: dismiss)
                        }
                    }
                }
            }
            .navigationTitle(table.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Context Bar
struct OrderContextBar: View {
    @ObservedObject var vm: DashboardViewModel
    let table: SelectedTable

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                Label(table.label, systemImage: tableIcon)
                    .font(.caption).fontWeight(.semibold)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color.brandRed.opacity(0.1))
                    .foregroundColor(.brandRed)
                    .cornerRadius(20)

                if vm.orderContext.orderType == .delivery || vm.orderContext.orderType == .takeaway {
                    TextField("Customer name", text: $vm.orderContext.customerName)
                        .font(.caption)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(Color(.systemGray6))
                        .cornerRadius(20)
                        .frame(minWidth: 130)
                }

                if vm.orderContext.orderType == .delivery {
                    TextField("Phone", text: $vm.orderContext.phone)
                        .keyboardType(.phonePad)
                        .font(.caption)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(Color(.systemGray6))
                        .cornerRadius(20)
                        .frame(minWidth: 120)

                    TextField("Delivery address", text: $vm.orderContext.deliveryAddress)
                        .font(.caption)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(Color(.systemGray6))
                        .cornerRadius(20)
                        .frame(minWidth: 160)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 8)
        }
    }

    var tableIcon: String {
        switch table.type {
        case .dineIn:   return "fork.knife"
        case .room:     return "door.left.hand.open"
        case .takeaway: return "bag"
        case .delivery: return "bicycle"
        }
    }
}

// MARK: - Menu Panel
struct MenuPanel: View {
    @ObservedObject var vm: DashboardViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Search
            HStack {
                Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                TextField("Search menu...", text: $vm.menuSearch)
                    .autocorrectionDisabled()
                if !vm.menuSearch.isEmpty {
                    Button { vm.menuSearch = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                    }
                }
            }
            .padding(10)
            .background(Color(.systemGray6))
            .cornerRadius(12)
            .padding(.horizontal, 12).padding(.top, 10)

            // Category tabs
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(vm.menuCategories, id: \.self) { cat in
                        CategoryChip(title: cat, isSelected: vm.selectedCategory == cat) {
                            vm.selectedCategory = cat
                        }
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
            }

            Divider()

            // Menu grid
            if vm.filteredMenu.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "fork.knife.circle")
                        .font(.system(size: 44))
                        .foregroundColor(.secondary)
                    Text("No items found")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(columns: [.init(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                        ForEach(vm.filteredMenu) { item in
                            MenuItemCard(item: item,
                                         isFavourite: vm.favourites.contains(item.id),
                                         cartQty: vm.orderCart.first(where: { $0.menuItemId == item.id })?.quantity ?? 0,
                                         onAdd: { vm.addToCart(item) },
                                         onToggleFav: { vm.toggleFavourite(item.id) })
                        }
                    }
                    .padding(12)
                    .padding(.bottom, 80)
                }
            }
        }
    }
}

// MARK: - Menu Item Card
struct MenuItemCard: View {
    let item: MenuItem
    let isFavourite: Bool
    let cartQty: Int
    let onAdd: () -> Void
    let onToggleFav: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                // Veg/non-veg indicator
                RoundedRectangle(cornerRadius: 2)
                    .stroke(item.isVeg ? Color.green : Color.red, lineWidth: 1.5)
                    .frame(width: 12, height: 12)
                    .overlay(
                        Circle()
                            .fill(item.isVeg ? Color.green : Color.red)
                            .padding(2)
                    )
                Spacer()
                Button(action: onToggleFav) {
                    Image(systemName: isFavourite ? "star.fill" : "star")
                        .font(.system(size: 13))
                        .foregroundColor(isFavourite ? .yellow : .secondary)
                }
            }

            Text(item.name)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            Text("₹\(item.price, specifier: "%.0f")")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.brandRed)

            Spacer()

            if cartQty > 0 {
                HStack(spacing: 0) {
                    Text("\(cartQty) added")
                        .font(.caption2)
                        .foregroundColor(.brandRed)
                    Spacer()
                    Button(action: onAdd) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.brandRed)
                            .font(.system(size: 22))
                    }
                }
            } else {
                Button(action: onAdd) {
                    Text("Add")
                        .font(.caption).fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(Color.brandRed)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                }
            }
        }
        .padding(10)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
        .opacity(item.available ? 1 : 0.5)
    }
}

// MARK: - Order Panel (iPad)
struct OrderPanel: View {
    @ObservedObject var vm: DashboardViewModel
    let table: SelectedTable
    let dismiss: DismissAction
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            Text("Cart")
                .font(.headline)
                .padding()
            Divider()

            if vm.orderCart.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "cart")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text("Add items to cart")
                        .foregroundColor(.secondary)
                }
                Spacer()
            } else {
                CartItemsList(vm: vm)
                Divider()
                CartSummaryFooter(vm: vm, table: table, dismiss: dismiss)
            }
        }
    }
}

// MARK: - Cart Items List
struct CartItemsList: View {
    @ObservedObject var vm: DashboardViewModel

    var body: some View {
        List {
            ForEach(vm.orderCart) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.name).font(.subheadline).fontWeight(.medium)
                        Text("₹\(item.price, specifier: "%.0f")").font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        Button {
                            vm.updateCartQty(id: item.menuItemId, qty: item.quantity - 1)
                        } label: {
                            Image(systemName: "minus.circle.fill")
                                .foregroundColor(.brandRed)
                                .font(.system(size: 20))
                        }
                        Text("\(item.quantity)")
                            .font(.subheadline).fontWeight(.bold)
                            .frame(width: 24, alignment: .center)
                        Button {
                            vm.updateCartQty(id: item.menuItemId, qty: item.quantity + 1)
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(.brandRed)
                                .font(.system(size: 20))
                        }
                    }
                }
            }
            .onDelete { idx in
                idx.forEach { vm.orderCart.remove(at: $0) }
            }
        }
        .listStyle(.plain)
    }
}

// MARK: - Cart Summary Footer
struct CartSummaryFooter: View {
    @ObservedObject var vm: DashboardViewModel
    let table: SelectedTable
    let dismiss: DismissAction
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Subtotal")
                Spacer()
                Text("₹\(vm.cartSubtotal, specifier: "%.0f")").fontWeight(.semibold)
            }
            HStack {
                Text("Total").fontWeight(.bold)
                Spacer()
                Text("₹\(vm.cartTotal, specifier: "%.0f")").font(.title3).fontWeight(.bold).foregroundColor(.brandRed)
            }

            Button {
                Task {
                    do {
                        try await vm.placeOrder()
                        appState.showToast("Order placed!")
                        dismiss()
                    } catch {
                        appState.showError(error.localizedDescription)
                    }
                }
            } label: {
                HStack {
                    if vm.isPlacingOrder { ProgressView().tint(.white) }
                    Text(vm.isPlacingOrder ? "Placing..." : "Place Order")
                        .fontWeight(.bold)
                }
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(vm.orderCart.isEmpty ? Color.gray : Color.brandRed)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(vm.orderCart.isEmpty || vm.isPlacingOrder)
        }
        .padding()
    }
}

// MARK: - Cart Floating Button (iPhone)
struct CartFloatingButton: View {
    @ObservedObject var vm: DashboardViewModel
    let table: SelectedTable
    let dismiss: DismissAction
    @State private var showCart = false

    var body: some View {
        VStack {
            Spacer()
            if !vm.orderCart.isEmpty {
                Button { showCart = true } label: {
                    HStack {
                        Image(systemName: "cart.fill")
                        Text("\(vm.orderCart.count) items — ₹\(vm.cartTotal, specifier: "%.0f")")
                            .fontWeight(.semibold)
                        Spacer()
                        Image(systemName: "chevron.up")
                    }
                    .padding()
                    .background(Color.brandRed)
                    .foregroundColor(.white)
                    .cornerRadius(16)
                    .shadow(radius: 8)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                }
                .sheet(isPresented: $showCart) {
                    CartSheetView(vm: vm, table: table, dismiss: dismiss)
                }
            }
        }
    }
}

struct CartSheetView: View {
    @ObservedObject var vm: DashboardViewModel
    let table: SelectedTable
    let dismiss: DismissAction
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                CartItemsList(vm: vm)
                Divider()
                CartSummaryFooter(vm: vm, table: table, dismiss: dismiss)
            }
            .navigationTitle("Cart — \(table.label)")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
    }
}

// MARK: - Category Chip
struct CategoryChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption).fontWeight(.medium)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(isSelected ? Color.brandRed : Color(.systemGray6))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}
