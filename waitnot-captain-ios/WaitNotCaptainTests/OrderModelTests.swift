import XCTest
@testable import WaitNotCaptain

final class OrderModelTests: XCTestCase {

    func testSlotLabelDineIn() {
        let order = makeOrder(type: .dineIn, table: 3)
        XCTAssertEqual(order.slotLabel, "Table 3")
    }

    func testSlotLabelRoom() {
        let order = makeOrder(type: .room, room: 2)
        XCTAssertEqual(order.slotLabel, "Room 2")
    }

    func testSlotLabelTakeaway() {
        let order = makeOrder(type: .takeaway)
        XCTAssertEqual(order.slotLabel, "Takeaway")
    }

    func testSlotLabelDelivery() {
        let order = makeOrder(type: .delivery)
        XCTAssertEqual(order.slotLabel, "Delivery")
    }

    func testOrderDecoding() throws {
        let json = """
        {
            "_id": "abc123",
            "restaurantId": "rest1",
            "orderType": "dine-in",
            "tableNumber": 5,
            "items": [],
            "totalAmount": 450.0,
            "status": "pending",
            "paymentStatus": "pending",
            "createdAt": "2024-01-01T12:00:00.000Z"
        }
        """.data(using: .utf8)!
        let order = try JSONDecoder().decode(Order.self, from: json)
        XCTAssertEqual(order.id, "abc123")
        XCTAssertEqual(order.tableNumber, 5)
        XCTAssertEqual(order.status, .pending)
        XCTAssertEqual(order.orderType, .dineIn)
    }

    private func makeOrder(type: OrderType, table: Int? = nil, room: Int? = nil) -> Order {
        Order(
            id: "x", restaurantId: "r",
            orderNumber: nil, tableNumber: table, roomNumber: room,
            orderType: type, customerName: nil, customerPhone: nil,
            deliveryAddress: nil, items: [], totalAmount: 0,
            packagingCharge: nil, deliveryCharge: nil,
            status: .pending, paymentStatus: .pending,
            paymentMethod: nil, paymentSubType: nil, utrNumber: nil,
            source: nil, createdAt: "", updatedAt: nil
        )
    }
}
