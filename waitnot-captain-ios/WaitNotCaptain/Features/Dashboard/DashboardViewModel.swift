import Foundation
import Combine

@MainActor
final class DashboardViewModel: ObservableObject {

    // MARK: - Navigation
    @Published var activeTab: Tab = .tables

    enum Tab: String, CaseIterable {
        case tables, orders, history, sales, profile
        var label: String {
            switch self {
            case .tables:  return "Tables"
            case .orders:  return "Orders"
            case .history: return "History"
            case .sales:   return "Sales"
            case .profile: return "Profile"
            }
        }
        var icon: String {
            switch self {
            case .tables:  return "fork.knife"
            case .orders:  return "list.clipboard"
            case .history: return "clock.arrow.circlepath"
            case .sales:   return "chart.line.uptrend.xyaxis"
            case .profile: return "person"
            }
        }
    }

    // MARK: - Data
    @Published private(set) var restaurant: Restaurant?
    @Published private(set) var activeOrders: [Order] = []
    @Published private(set) var isLoading = true
    @Published private(set) var loadError: String?

    // MARK: - Order Taking
    @Published var selectedTable: SelectedTable?
    @Published var orderCart: [CartItem] = []
    @Published var menuSearch = ""
    @Published var selectedCategory = "All"
    @Published var orderContext = OrderContext()
    @Published var favourites: [String] = []
    @Published var isPlacingOrder = false

    // MARK: - History
    @Published var historyOrders: [Order] = []
    @Published var isLoadingHistory = false
    @Published var historySearch = ""

    // MARK: - Sales
    @Published var salesData: SalesData?
    @Published var isLoadingSales = false
    @Published var salesPeriod: SalesPeriod = .today

    // MARK: - Printer
    @Published var printerConfig: PrinterConfig = PrinterConfigStore.shared.load()

    // MARK: - Auth
    private let authStore: AuthStore
    private var token: String { authStore.token ?? "" }
    private var staff: Staff? { authStore.staff }
    var restaurantId: String { staff?.restaurantId ?? "" }

    // MARK: - Services
    private let socket = SocketService.shared
    private let printService = PrintService.shared
    private let orderRepo = OrderRepository.shared
    private let restaurantRepo = RestaurantRepository.shared
    private var cancellables = Set<AnyCancellable>()
    private var pollTask: Task<Void, Never>?

    init(authStore: AuthStore) {
        self.authStore = authStore
    }

    // MARK: - Bootstrap
    func onAppear() {
        guard !restaurantId.isEmpty else { return }
        favourites = LocalCache.shared.loadFavourites(restaurantId: restaurantId)

        // Show cached restaurant immediately
        if let cached = LocalCache.shared.loadRestaurant(id: restaurantId) {
            restaurant = cached
            isLoading = false
        }

        Task { await loadData() }
        connectSocket()
        startPolling()
        Task { await NotificationService.shared.requestPermission() }
    }

    func onDisappear() {
        socket.disconnect()
        pollTask?.cancel()
    }

    // MARK: - Data loading
    func loadData() async {
        do {
            async let r = restaurantRepo.fetch(id: restaurantId, token: token)
            async let o = orderRepo.fetchActive(restaurantId: restaurantId, token: token)
            let (res, orders) = try await (r, o)
            restaurant = res
            activeOrders = orders
            LocalCache.shared.saveRestaurant(res)
            loadError = nil
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Socket
    private func connectSocket() {
        socket.connect(restaurantId: restaurantId)
        // New Order
        socket.newOrder
            .receive(on: DispatchQueue.main)
            .sink { [weak self] order in self?.handleNewOrder(order) }
            .store(in: &cancellables)
        // Order Updated
        socket.orderUpdated
            .receive(on: DispatchQueue.main)
            .sink { [weak self] order in self?.handleOrderUpdated(order) }
            .store(in: &cancellables)
        // Batch Updated
        socket.ordersUpdated
            .receive(on: DispatchQueue.main)
            .sink { [weak self] batch in self?.handleBatchUpdated(batch) }
            .store(in: &cancellables)
        // Deleted
        socket.orderDeleted
            .receive(on: DispatchQueue.main)
            .sink { [weak self] id in self?.activeOrders.removeAll { $0.id == id } }
            .store(in: &cancellables)
        // Print KOT
        socket.printKOT
            .receive(on: DispatchQueue.main)
            .sink { [weak self] order in
                guard self?.printerConfig.autoPrintKOT == true else { return }
                Task { await self?.autoPrintKOT(order: order) }
            }
            .store(in: &cancellables)
        // Print Bill
        socket.printBill
            .receive(on: DispatchQueue.main)
            .sink { [weak self] payload in
                guard self?.printerConfig.autoPrintBill == true else { return }
                Task { await self?.autoPrintBill(orders: payload.orders) }
            }
            .store(in: &cancellables)
        // Reconnect → refresh
        socket.$isConnected
            .receive(on: DispatchQueue.main)
            .sink { [weak self] connected in
                if connected { Task { await self?.refreshOrders() } }
            }
            .store(in: &cancellables)
    }

    private func handleNewOrder(_ order: Order) {
        if !activeOrders.contains(where: { $0.id == order.id }) {
            activeOrders.insert(order, at: 0)
            NotificationService.shared.showNewOrderNotification(order: order)
            autoKOT(order: order)
        }
    }

    private func handleOrderUpdated(_ order: Order) {
        if order.status == .completed || order.status == .cancelled {
            activeOrders.removeAll { $0.id == order.id }
        } else if let idx = activeOrders.firstIndex(where: { $0.id == order.id }) {
            activeOrders[idx] = order
        } else {
            activeOrders.insert(order, at: 0)
        }
    }

    private func handleBatchUpdated(_ batch: BatchOrderUpdate) {
        if batch.status == .completed || batch.status == .cancelled {
            activeOrders.removeAll { batch.orderIds.contains($0.id) }
        } else {
            for i in activeOrders.indices where batch.orderIds.contains(activeOrders[i].id) {
                if let s  = batch.status        { activeOrders[i].status        = s  }
                if let pm = batch.paymentMethod { activeOrders[i].paymentMethod = pm }
                if let ps = batch.paymentStatus { activeOrders[i].paymentStatus = ps }
            }
        }
    }

    // MARK: - Polling fallback
    private func startPolling() {
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 15_000_000_000)
                guard let self, !Task.isCancelled else { return }
                await self.refreshOrders()
            }
        }
    }

    private func refreshOrders() async {
        guard let newOrders = try? await orderRepo.fetchActive(restaurantId: restaurantId, token: token) else { return }
        let newOnes = newOrders.filter { n in !activeOrders.contains(where: { $0.id == n.id }) }
        newOnes.forEach {
            NotificationService.shared.showNewOrderNotification(order: $0)
        }
        activeOrders = newOrders
    }

    // MARK: - Auto print helpers
    private func autoKOT(order: Order) {
        guard printerConfig.autoPrintKOT else { return }
        Task { await autoPrintKOT(order: order) }
    }

    func autoPrintKOT(order: Order) async {
        let name = restaurant?.name ?? "Restaurant"
        _ = await printService.printKOT(order: order, restaurantName: name, config: printerConfig)
    }

    func autoPrintBill(orders: [Order]) async {
        let name = restaurant?.name ?? "Restaurant"
        _ = await printService.printBill(orders: orders, restaurantName: name,
                                         config: printerConfig, paymentMethod: nil)
    }

    // MARK: - Table helpers
    func tableStatus(_ number: Int) -> TableStatus {
        activeOrders.contains(where: { $0.orderType == .dineIn && $0.tableNumber == number }) ? .occupied : .vacant
    }

    func ordersForTable(_ number: Int) -> [Order] {
        activeOrders.filter { $0.orderType == .dineIn && $0.tableNumber == number }
    }

    func ordersForRoom(_ number: Int) -> [Order] {
        activeOrders.filter { $0.orderType == .room && $0.roomNumber == number }
    }

    func tableTotal(_ number: Int) -> Double {
        ordersForTable(number).reduce(0) { $0 + $1.totalAmount }
    }

    // MARK: - Order taking
    func selectTable(_ number: Int) {
        let label = "Table \(number)"
        selectedTable = SelectedTable(number: number, label: label, type: .dineIn)
        orderContext = OrderContext(orderType: .dineIn, tableNumber: number)
        clearCart()
    }

    func selectRoom(_ number: Int) {
        let name = restaurant?.features?.roomNames?[String(number)] ?? "Room \(number)"
        selectedTable = SelectedTable(number: number, label: name, type: .room)
        orderContext = OrderContext(orderType: .room, roomNumber: number)
        clearCart()
    }

    func selectTakeaway() {
        selectedTable = SelectedTable(number: nil, label: "Takeaway", type: .takeaway)
        orderContext = OrderContext(orderType: .takeaway)
        clearCart()
    }

    func selectDelivery() {
        selectedTable = SelectedTable(number: nil, label: "Delivery", type: .delivery)
        orderContext = OrderContext(orderType: .delivery)
        clearCart()
    }

    func addToCart(_ item: MenuItem) {
        if let idx = orderCart.firstIndex(where: { $0.menuItemId == item.id }) {
            orderCart[idx].quantity += 1
        } else {
            orderCart.append(CartItem(menuItemId: item.id, name: item.name,
                                      price: item.price, quantity: 1))
        }
    }

    func updateCartQty(id: String, qty: Int) {
        if qty <= 0 { orderCart.removeAll { $0.menuItemId == id } }
        else if let idx = orderCart.firstIndex(where: { $0.menuItemId == id }) {
            orderCart[idx].quantity = qty
        }
    }

    func clearCart() {
        orderCart.removeAll()
        menuSearch = ""
        selectedCategory = "All"
    }

    var cartSubtotal: Double {
        orderCart.filter { !$0.complimentary }
            .reduce(0) { $0 + $1.price * Double($1.quantity) }
    }

    var cartTotal: Double {
        cartSubtotal
            + (orderContext.packagingCharge ?? 0)
            + (orderContext.deliveryCharge ?? 0)
    }

    var filteredMenu: [MenuItem] {
        guard let menu = restaurant?.menu else { return [] }
        var items = menu.filter { $0.available }
        if selectedCategory == "⭐ Favourites" {
            items = items.filter { favourites.contains($0.id) }
        } else if selectedCategory != "All" {
            items = items.filter { $0.category == selectedCategory }
        }
        if !menuSearch.isEmpty {
            let q = menuSearch.lowercased()
            items = items.filter {
                $0.name.lowercased().contains(q) ||
                ($0.category?.lowercased().contains(q) ?? false)
            }
        }
        return items
    }

    var menuCategories: [String] {
        let cats = restaurant?.menu
            .compactMap { $0.category }
            .filter { !$0.isEmpty } ?? []
        let unique = Array(Set(cats)).sorted()
        return ["All", "⭐ Favourites"] + unique
    }

    func toggleFavourite(_ id: String) {
        if favourites.contains(id) { favourites.removeAll { $0 == id } }
        else { favourites.append(id) }
        LocalCache.shared.saveFavourites(favourites, restaurantId: restaurantId)
    }

    func placeOrder() async throws {
        guard let table = selectedTable, !orderCart.isEmpty else { return }
        isPlacingOrder = true
        defer { isPlacingOrder = false }

        let req = CreateOrderRequest(
            restaurantId: restaurantId,
            tableNumber: orderContext.tableNumber,
            roomNumber: orderContext.roomNumber,
            items: orderCart.map {
                CreateOrderItem(menuItemId: $0.menuItemId, name: $0.name,
                                price: $0.price, quantity: $0.quantity)
            },
            totalAmount: cartSubtotal + (orderContext.packagingCharge ?? 0) + (orderContext.deliveryCharge ?? 0),
            orderType: orderContext.orderType,
            customerName: orderContext.customerName.isEmpty ? (staff.map { "Waiter \($0.waiterNumber ?? $0.name)" }) : orderContext.customerName,
            customerPhone: orderContext.phone.isEmpty ? nil : orderContext.phone,
            deliveryAddress: orderContext.deliveryAddress.isEmpty ? nil : orderContext.deliveryAddress,
            packagingCharge: orderContext.packagingCharge,
            deliveryCharge: orderContext.deliveryCharge,
            source: "staff",
            status: .pending,
            paymentStatus: .pending,
            paymentMethod: .cash
        )
        let newOrder = try await orderRepo.create(req, token: token)
        if !activeOrders.contains(where: { $0.id == newOrder.id }) {
            activeOrders.insert(newOrder, at: 0)
        }
        clearCart()
        selectedTable = nil
        _ = table  // suppress warning
    }

    // MARK: - Running order ops
    func updateRunningItem(orderId: String, itemName: String, delta: Int) async {
        guard let orderIdx = activeOrders.firstIndex(where: { $0.id == orderId }) else { return }
        var order = activeOrders[orderIdx]
        guard let itemIdx = order.items.firstIndex(where: { $0.name == itemName }) else { return }
        let newQty = order.items[itemIdx].quantity + delta
        if newQty <= 0 {
            order.items.remove(at: itemIdx)
        } else {
            order.items[itemIdx].quantity = newQty
        }
        if order.items.isEmpty {
            try? await orderRepo.delete(orderId: orderId, token: token)
            activeOrders.remove(at: orderIdx)
        } else {
            let total = order.items.reduce(0) { $0 + $1.price * Double($1.quantity) }
            if let updated = try? await orderRepo.updateItems(orderId: orderId, items: order.items, total: total, token: token) {
                activeOrders[orderIdx] = updated
            }
        }
    }

    func deleteRunningItem(orderId: String, at index: Int) async {
        guard let orderIdx = activeOrders.firstIndex(where: { $0.id == orderId }) else { return }
        var order = activeOrders[orderIdx]
        order.items.remove(at: index)
        if order.items.isEmpty {
            try? await orderRepo.delete(orderId: orderId, token: token)
            activeOrders.remove(at: orderIdx)
        } else {
            let total = order.items.reduce(0) { $0 + $1.price * Double($1.quantity) }
            if let updated = try? await orderRepo.updateItems(orderId: orderId, items: order.items, total: total, token: token) {
                activeOrders[orderIdx] = updated
            }
        }
    }

    func cancelOrder(orderId: String) async {
        try? await orderRepo.delete(orderId: orderId, token: token)
        activeOrders.removeAll { $0.id == orderId }
    }

    // MARK: - Clear table
    func clearTable(tableNumber: Int, paymentMethod: PaymentMethod,
                    paymentSubType: String?, utrNumber: String?) async throws {
        let orders = ordersForTable(tableNumber)
        guard !orders.isEmpty else { return }
        let req = MergeCompleteRequest(
            orderIds: orders.map { $0.id },
            paymentMethod: paymentMethod,
            paymentSubType: paymentSubType,
            utrNumber: utrNumber,
            restaurantId: restaurantId,
            tableNumber: tableNumber,
            roomNumber: nil,
            orderType: .dineIn,
            customerName: orders.first?.customerName
        )
        let completed = try await orderRepo.mergeAndComplete(req, token: token)
        activeOrders.removeAll { orders.map { $0.id }.contains($0.id) }
        // Auto-print bill
        if printerConfig.autoPrintBill {
            await autoPrintBill(orders: [completed])
        }
    }

    // MARK: - Print single order
    func printKOT(order: Order) async -> PrintResult {
        await printService.printKOT(
            order: order,
            restaurantName: restaurant?.name ?? "Restaurant",
            config: printerConfig
        )
    }

    func printBill(orders: [Order], paymentMethod: PaymentMethod?) async -> PrintResult {
        await printService.printBill(
            orders: orders,
            restaurantName: restaurant?.name ?? "Restaurant",
            config: printerConfig,
            paymentMethod: paymentMethod
        )
    }

    // MARK: - History
    func loadHistory() async {
        isLoadingHistory = true
        defer { isLoadingHistory = false }
        historyOrders = (try? await orderRepo.fetchCompleted(restaurantId: restaurantId, token: token)) ?? []
    }

    var filteredHistory: [Order] {
        guard !historySearch.isEmpty else { return historyOrders }
        let q = historySearch.lowercased()
        return historyOrders.filter {
            $0.customerName?.lowercased().contains(q) == true ||
            $0.slotLabel.lowercased().contains(q) ||
            $0.id.lowercased().contains(q)
        }
    }

    // MARK: - Sales
    func loadSales() async {
        isLoadingSales = true
        defer { isLoadingSales = false }
        let all = (try? await orderRepo.fetchCompleted(restaurantId: restaurantId, token: token)) ?? []
        salesData = SalesData.compute(from: all, period: salesPeriod)
    }

    // MARK: - Printer config save
    func savePrinterConfig() {
        PrinterConfigStore.shared.save(printerConfig, restaurantId: restaurantId)
    }

    // MARK: - Staff accessors (for UI)
    var staffName: String         { authStore.staff?.name ?? "Staff" }
    var staffRoleDisplay: String  { authStore.staff?.role.displayName ?? "" }
    var staffWaiterNumber: String? { authStore.staff?.waiterNumber }
    var staffEmail: String?       { authStore.staff?.email }
    var staffPhone: String?       { authStore.staff?.phone }

    // MARK: - Logout
    func logout() async {
        socket.disconnect()
        pollTask?.cancel()
        await authStore.logout()
    }

    // MARK: - Computed
    var totalRunningCount: Int { activeOrders.count }

    var runningGrouped: [(label: String, orders: [Order])] {
        var groups: [(String, [Order])] = []
        // Tables
        let tableNums = Array(Set(activeOrders.filter { $0.orderType == .dineIn }.compactMap { $0.tableNumber })).sorted()
        for t in tableNums {
            let orders = activeOrders.filter { $0.orderType == .dineIn && $0.tableNumber == t }
            groups.append(("Table \(t)", orders))
        }
        // Rooms
        let roomNums = Array(Set(activeOrders.filter { $0.orderType == .room }.compactMap { $0.roomNumber })).sorted()
        for r in roomNums {
            let rName = restaurant?.features?.roomNames?[String(r)] ?? "Room \(r)"
            let orders = activeOrders.filter { $0.orderType == .room && $0.roomNumber == r }
            groups.append((rName, orders))
        }
        // Takeaway
        let takeaway = activeOrders.filter { $0.orderType == .takeaway }
        if !takeaway.isEmpty { groups.append(("Takeaway", takeaway)) }
        // Delivery
        let delivery = activeOrders.filter { $0.orderType == .delivery }
        if !delivery.isEmpty { groups.append(("Delivery", delivery)) }
        return groups
    }
}

// MARK: - Supporting Types

struct SelectedTable {
    let number: Int?
    let label: String
    let type: OrderType
}

struct OrderContext {
    var orderType: OrderType = .dineIn
    var tableNumber: Int? = nil
    var roomNumber: Int? = nil
    var customerName: String = ""
    var phone: String = ""
    var deliveryAddress: String = ""
    var packagingCharge: Double? = nil
    var deliveryCharge: Double? = nil
}

struct CartItem: Identifiable {
    var id: String { menuItemId }
    let menuItemId: String
    let name: String
    var price: Double
    var quantity: Int
    var complimentary: Bool = false
}

enum TableStatus { case vacant, occupied }

enum SalesPeriod: String, CaseIterable {
    case today = "Today"
    case week  = "This Week"
    case month = "This Month"
    case all   = "All Time"
}

struct SalesData {
    let totalRevenue: Double
    let totalOrders: Int
    let cashRevenue: Double
    let onlineRevenue: Double
    let cashCount: Int
    let onlineCount: Int
    let topItems: [(name: String, qty: Int, revenue: Double)]
    let typeBreakdown: [(type: String, count: Int, revenue: Double)]

    static func compute(from orders: [Order], period: SalesPeriod) -> SalesData {
        let now = Date()
        let startDate: Date
        switch period {
        case .today:
            startDate = Calendar.current.startOfDay(for: now)
        case .week:
            startDate = now.addingTimeInterval(-7 * 86400)
        case .month:
            let comps = Calendar.current.dateComponents([.year, .month], from: now)
            startDate = Calendar.current.date(from: comps) ?? now.addingTimeInterval(-30 * 86400)
        case .all:
            startDate = Date(timeIntervalSince1970: 0)
        }

        let formatter = ISO8601DateFormatter()
        let filtered = orders.filter {
            guard let d = formatter.date(from: $0.createdAt) else { return false }
            return d >= startDate
        }

        let total = filtered.reduce(0.0) { $0 + $1.totalAmount }
        let cashO  = filtered.filter { $0.paymentMethod == .cash || $0.paymentMethod == nil }
        let onlineO = filtered.filter { $0.paymentMethod != .cash && $0.paymentMethod != nil }

        var itemMap: [String: (qty: Int, rev: Double)] = [:]
        for o in filtered {
            for i in o.items {
                let existing = itemMap[i.name] ?? (0, 0)
                itemMap[i.name] = (existing.qty + i.quantity, existing.rev + i.price * Double(i.quantity))
            }
        }
        let topItems = itemMap.map { (name: $0.key, qty: $0.value.qty, revenue: $0.value.rev) }
            .sorted { $0.qty > $1.qty }
            .prefix(10)
            .map { $0 }

        let types: [OrderType] = [.dineIn, .room, .takeaway, .delivery]
        let typeBreakdown = types.map { t -> (type: String, count: Int, revenue: Double) in
            let t_orders = filtered.filter { $0.orderType == t }
            return (t.displayName, t_orders.count, t_orders.reduce(0) { $0 + $1.totalAmount })
        }.filter { $0.count > 0 }

        return SalesData(
            totalRevenue: total,
            totalOrders: filtered.count,
            cashRevenue: cashO.reduce(0) { $0 + $1.totalAmount },
            onlineRevenue: onlineO.reduce(0) { $0 + $1.totalAmount },
            cashCount: cashO.count,
            onlineCount: onlineO.count,
            topItems: topItems,
            typeBreakdown: typeBreakdown
        )
    }
}
