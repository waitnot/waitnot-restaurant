import Foundation

final class OrderRepository {
    static let shared = OrderRepository()
    private init() {}

    func fetchActive(restaurantId: String, token: String) async throws -> [Order] {
        let orders: [Order] = try await APIClient.shared.request(
            "/api/orders/restaurant/\(restaurantId)?status=active",
            token: token
        )
        return orders
    }

    func fetchCompleted(restaurantId: String, token: String) async throws -> [Order] {
        let orders: [Order] = try await APIClient.shared.request(
            "/api/orders/restaurant/\(restaurantId)?status=completed",
            token: token
        )
        return orders
    }

    func create(_ req: CreateOrderRequest, token: String) async throws -> Order {
        return try await APIClient.shared.request(
            "/api/orders",
            method: "POST",
            body: req,
            token: token
        )
    }

    func updateStatus(orderId: String, status: OrderStatus, token: String) async throws -> Order {
        return try await APIClient.shared.request(
            "/api/orders/\(orderId)/status",
            method: "PATCH",
            body: UpdateStatusRequest(status: status),
            token: token
        )
    }

    func updateItems(orderId: String, items: [OrderItem], total: Double, token: String) async throws -> Order {
        return try await APIClient.shared.request(
            "/api/orders/\(orderId)/items",
            method: "PATCH",
            body: UpdateItemsRequest(items: items, totalAmount: total),
            token: token
        )
    }

    func updatePayment(orderId: String, req: UpdatePaymentRequest, token: String) async throws -> Order {
        return try await APIClient.shared.request(
            "/api/orders/\(orderId)/payment",
            method: "PATCH",
            body: req,
            token: token
        )
    }

    func mergeAndComplete(_ req: MergeCompleteRequest, token: String) async throws -> Order {
        struct Resp: Decodable { let order: Order }
        let resp: Resp = try await APIClient.shared.request(
            "/api/orders/merge-and-complete",
            method: "POST",
            body: req,
            token: token
        )
        return resp.order
    }

    func delete(orderId: String, token: String) async throws {
        try await APIClient.shared.requestVoid(
            "/api/orders/\(orderId)",
            method: "DELETE",
            token: token
        )
    }
}
