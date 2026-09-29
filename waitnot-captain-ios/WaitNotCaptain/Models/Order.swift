import Foundation

struct Order: Codable, Identifiable {
    let id: String
    let restaurantId: String
    let orderNumber: Int?
    let tableNumber: Int?
    let roomNumber: Int?
    let orderType: OrderType
    let customerName: String?
    let customerPhone: String?
    let deliveryAddress: String?
    var items: [OrderItem]
    var totalAmount: Double
    let packagingCharge: Double?
    let deliveryCharge: Double?
    var status: OrderStatus
    var paymentStatus: PaymentStatus
    var paymentMethod: PaymentMethod?
    var paymentSubType: String?
    var utrNumber: String?
    let source: String?
    let createdAt: String
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case restaurantId = "restaurantId"
        case orderNumber = "orderNumber"
        case tableNumber, roomNumber, orderType
        case customerName, customerPhone, deliveryAddress
        case items, totalAmount, packagingCharge, deliveryCharge
        case status, paymentStatus, paymentMethod, paymentSubType, utrNumber
        case source, createdAt, updatedAt
    }

    var slotLabel: String {
        switch orderType {
        case .dineIn:
            return tableNumber.map { "Table \($0)" } ?? "Dine-In"
        case .room:
            return roomNumber.map { "Room \($0)" } ?? "Room"
        case .takeaway:
            return "Takeaway"
        case .delivery:
            return "Delivery"
        }
    }
}

struct OrderItem: Codable, Identifiable {
    var id: String { (menuItemId ?? name) + (UUID().uuidString) }
    let menuItemId: String?
    let name: String
    var price: Double
    var quantity: Int
    let complimentary: Bool?

    enum CodingKeys: String, CodingKey {
        case menuItemId, name, price, quantity, complimentary
    }
}

enum OrderType: String, Codable {
    case dineIn = "dine-in"
    case room = "room"
    case takeaway = "takeaway"
    case delivery = "delivery"
}

enum OrderStatus: String, Codable {
    case pending, preparing, ready, completed, cancelled
    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .preparing: return "Preparing"
        case .ready: return "Ready"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        }
    }
}

enum PaymentStatus: String, Codable {
    case pending, paid
}

enum PaymentMethod: String, Codable {
    case cash, online, upi, card
    var displayName: String {
        switch self {
        case .cash: return "Cash"
        case .online: return "Online"
        case .upi: return "UPI"
        case .card: return "Card"
        }
    }
}

// MARK: - Request bodies

struct CreateOrderRequest: Codable {
    let restaurantId: String
    let tableNumber: Int?
    let roomNumber: Int?
    let items: [CreateOrderItem]
    let totalAmount: Double
    let orderType: OrderType
    let customerName: String?
    let customerPhone: String?
    let deliveryAddress: String?
    let packagingCharge: Double?
    let deliveryCharge: Double?
    let source: String
    let status: OrderStatus
    let paymentStatus: PaymentStatus
    let paymentMethod: PaymentMethod
}

struct CreateOrderItem: Codable {
    let menuItemId: String
    let name: String
    let price: Double
    let quantity: Int
}

struct UpdateStatusRequest: Codable {
    let status: OrderStatus
}

struct UpdateItemsRequest: Codable {
    let items: [OrderItem]
    let totalAmount: Double
}

struct UpdatePaymentRequest: Codable {
    let paymentMethod: PaymentMethod
    let paymentSubType: String?
    let utrNumber: String?
    let paymentStatus: PaymentStatus
}

struct MergeCompleteRequest: Codable {
    let orderIds: [String]
    let paymentMethod: PaymentMethod
    let paymentSubType: String?
    let utrNumber: String?
    let restaurantId: String
    let tableNumber: Int?
    let roomNumber: Int?
    let orderType: OrderType
    let customerName: String?
}

struct BatchUpdateRequest: Codable {
    let orderIds: [String]
    let status: OrderStatus?
    let paymentMethod: PaymentMethod?
    let paymentSubType: String?
    let utrNumber: String?
    let paymentStatus: PaymentStatus?
}
