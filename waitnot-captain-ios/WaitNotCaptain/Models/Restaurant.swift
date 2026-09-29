import Foundation

struct Restaurant: Codable, Identifiable {
    let id: String
    let name: String
    let email: String?
    let phone: String?
    let address: String?
    let tables: Int
    let rooms: Int
    let logo: String?
    let menu: [MenuItem]
    let features: RestaurantFeatures?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name, email, phone, address, tables, rooms, logo, menu, features
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        email = try c.decodeIfPresent(String.self, forKey: .email)
        phone = try c.decodeIfPresent(String.self, forKey: .phone)
        address = try c.decodeIfPresent(String.self, forKey: .address)
        tables = (try? c.decode(Int.self, forKey: .tables)) ?? 0
        rooms = (try? c.decode(Int.self, forKey: .rooms)) ?? 0
        logo = try c.decodeIfPresent(String.self, forKey: .logo)
        menu = (try? c.decode([MenuItem].self, forKey: .menu)) ?? []
        features = try c.decodeIfPresent(RestaurantFeatures.self, forKey: .features)
    }
}

struct RestaurantFeatures: Codable {
    let roomNames: [String: String]?
    let enableQROrdering: Bool?
    let enableDelivery: Bool?
}

struct MenuItem: Codable, Identifiable {
    let id: String
    let restaurantId: String?
    let name: String
    let category: String?
    let price: Double
    let description: String?
    let image: String?
    let isVeg: Bool
    let available: Bool

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case restaurantId = "restaurant_id"
        case name, category, price, description, image
        case isVeg = "is_veg"
        case available
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        restaurantId = try c.decodeIfPresent(String.self, forKey: .restaurantId)
        name = try c.decode(String.self, forKey: .name)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        price = try c.decode(Double.self, forKey: .price)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        image = try c.decodeIfPresent(String.self, forKey: .image)
        isVeg = (try? c.decode(Bool.self, forKey: .isVeg)) ?? true
        available = (try? c.decode(Bool.self, forKey: .available)) ?? true
    }
}
