import Foundation

final class RestaurantRepository {
    static let shared = RestaurantRepository()
    private init() {}

    func fetch(id: String, token: String) async throws -> Restaurant {
        return try await APIClient.shared.request(
            "/api/restaurants/\(id)",
            token: token
        )
    }
}
