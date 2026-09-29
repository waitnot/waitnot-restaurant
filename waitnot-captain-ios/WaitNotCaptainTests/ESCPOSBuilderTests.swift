import XCTest
@testable import WaitNotCaptain

final class ESCPOSBuilderTests: XCTestCase {

    func testKOTDataIsNotEmpty() {
        let data = ESCPOSBuilder.buildKOT(
            restaurantName: "Test Restaurant",
            slotLabel: "Table 5",
            orderId: "abc123",
            orderType: .dineIn,
            customerName: "John",
            deliveryAddress: nil,
            items: [("Burger", 2), ("Fries", 1)]
        )
        XCTAssertFalse(data.isEmpty)
    }

    func testBillDataIsNotEmpty() {
        let data = ESCPOSBuilder.buildBill(
            restaurantName: "Test Restaurant",
            slotLabel: "Table 5",
            orderType: .dineIn,
            customerName: "John",
            customerPhone: nil,
            deliveryAddress: nil,
            items: [("Burger", 2, 150.0, false)],
            packagingCharge: nil,
            deliveryCharge: nil,
            paymentMethod: .cash
        )
        XCTAssertFalse(data.isEmpty)
    }

    func testKOTContainsESCInit() {
        let data = ESCPOSBuilder.buildKOT(
            restaurantName: "R", slotLabel: "T1", orderId: "x",
            orderType: .dineIn, customerName: nil, deliveryAddress: nil, items: []
        )
        let bytes = [UInt8](data)
        // First two bytes should be ESC INIT (0x1B, 0x40)
        XCTAssertEqual(bytes[0], 0x1B)
        XCTAssertEqual(bytes[1], 0x40)
    }

    func testBillContainsCutCommand() {
        let data = ESCPOSBuilder.buildBill(
            restaurantName: "R", slotLabel: "T1", orderType: .dineIn,
            customerName: nil, customerPhone: nil, deliveryAddress: nil,
            items: [], packagingCharge: nil, deliveryCharge: nil, paymentMethod: nil
        )
        let bytes = [UInt8](data)
        // CUT command: 0x1D 0x56 0x42 0x00
        let cutFound = bytes.windows(ofCount: 4).contains { Array($0) == [0x1D, 0x56, 0x42, 0x00] }
        XCTAssertTrue(cutFound)
    }
}

// Helper extension for sliding windows
extension Collection {
    func windows(ofCount count: Int) -> [[Element]] {
        guard count > 0, self.count >= count else { return [] }
        var result: [[Element]] = []
        var index = startIndex
        while self.distance(from: index, to: endIndex) >= count {
            let end = self.index(index, offsetBy: count)
            result.append(Array(self[index..<end]))
            index = self.index(after: index)
        }
        return result
    }
}
