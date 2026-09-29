import XCTest
@testable import WaitNotCaptain

final class SalesDataTests: XCTestCase {

    func testComputeWithEmptyOrders() {
        let result = SalesData.compute(from: [], period: .today)
        XCTAssertEqual(result.totalOrders, 0)
        XCTAssertEqual(result.totalRevenue, 0)
        XCTAssertTrue(result.topItems.isEmpty)
    }

    func testComputeTotalsCorrectly() {
        let orders = [
            makeOrder(amount: 200, method: .cash),
            makeOrder(amount: 350, method: .upi),
            makeOrder(amount: 150, method: .cash)
        ]
        let result = SalesData.compute(from: orders, period: .all)
        XCTAssertEqual(result.totalOrders, 3)
        XCTAssertEqual(result.totalRevenue, 700, accuracy: 0.01)
        XCTAssertEqual(result.cashRevenue, 350, accuracy: 0.01)
        XCTAssertEqual(result.onlineRevenue, 350, accuracy: 0.01)
    }

    private func makeOrder(amount: Double, method: PaymentMethod) -> Order {
        Order(
            id: UUID().uuidString,
            restaurantId: "r1",
            orderNumber: 1,
            tableNumber: 1,
            roomNumber: nil,
            orderType: .dineIn,
            customerName: "Test",
            customerPhone: nil,
            deliveryAddress: nil,
            items: [],
            totalAmount: amount,
            packagingCharge: nil,
            deliveryCharge: nil,
            status: .completed,
            paymentStatus: .paid,
            paymentMethod: method,
            paymentSubType: nil,
            utrNumber: nil,
            source: "staff",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: nil
        )
    }
}
