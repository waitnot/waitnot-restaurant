import Foundation

struct Staff: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
    let phone: String?
    let role: StaffRole
    let waiterNumber: String?
    let restaurantId: String
    let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name, email, phone, role
        case waiterNumber = "waiter_number"
        case restaurantId = "restaurant_id"
        case isActive = "is_active"
    }
}

enum StaffRole: String, Codable {
    case manager, waiter, kitchen
    var displayName: String {
        switch self {
        case .manager: return "Manager"
        case .waiter: return "Waiter"
        case .kitchen: return "Kitchen Staff"
        }
    }
}

struct LoginResponse: Codable {
    let token: String
    let staff: Staff
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}
