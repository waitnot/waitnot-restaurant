import Foundation

/// Lightweight UserDefaults-backed cache for restaurant data
final class LocalCache {
    static let shared = LocalCache()
    private let defaults = UserDefaults.standard
    private init() {}

    func saveRestaurant(_ restaurant: Restaurant) {
        let key = "restaurant_cache_\(restaurant.id)"
        if let data = try? JSONEncoder().encode(restaurant) {
            defaults.set(data, forKey: key)
        }
    }

    func loadRestaurant(id: String) -> Restaurant? {
        let key = "restaurant_cache_\(id)"
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(Restaurant.self, from: data)
    }

    func saveFavourites(_ ids: [String], restaurantId: String) {
        defaults.set(ids, forKey: "favourites_\(restaurantId)")
    }

    func loadFavourites(restaurantId: String) -> [String] {
        return defaults.stringArray(forKey: "favourites_\(restaurantId)") ?? []
    }
}
