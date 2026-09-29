import Foundation
import Network

enum PrintType { case kot, bill }

enum PrintResult {
    case success(method: String)
    case failure(PrinterError)
}

@MainActor
final class PrintService: ObservableObject {
    static let shared = PrintService()
    private let bt = BluetoothPrinterService.shared
    private init() {}

    // MARK: - Print KOT
    func printKOT(order: Order, restaurantName: String, config: PrinterConfig) async -> PrintResult {
        let items = order.items.map { (name: $0.name, quantity: $0.quantity) }
        let data = ESCPOSBuilder.buildKOT(
            restaurantName: restaurantName,
            slotLabel: order.slotLabel,
            orderId: order.id,
            orderType: order.orderType,
            customerName: order.customerName,
            deliveryAddress: order.deliveryAddress,
            items: items
        )
        return await send(data: data, address: config.kitchenPrinterAddress,
                          wifiIP: config.wifiPrinterIP, wifiPort: config.wifiPrinterPort,
                          label: "KOT")
    }

    // MARK: - Print Bill
    func printBill(orders: [Order], restaurantName: String, config: PrinterConfig,
                   paymentMethod: PaymentMethod?) async -> PrintResult {
        // Merge items from all orders
        var merged: [(name: String, quantity: Int, price: Double, complimentary: Bool)] = []
        for o in orders {
            for item in o.items {
                if let idx = merged.firstIndex(where: { $0.name == item.name && $0.price == item.price }) {
                    let existing = merged[idx]
                    merged[idx] = (existing.name, existing.quantity + item.quantity, existing.price, existing.complimentary)
                } else {
                    merged.append((item.name, item.quantity, item.price, item.complimentary ?? false))
                }
            }
        }
        let first = orders.first
        let data = ESCPOSBuilder.buildBill(
            restaurantName: restaurantName,
            slotLabel: first?.slotLabel ?? "",
            orderType: first?.orderType ?? .dineIn,
            customerName: first?.customerName,
            customerPhone: first?.customerPhone,
            deliveryAddress: first?.deliveryAddress,
            items: merged,
            packagingCharge: first?.packagingCharge,
            deliveryCharge: first?.deliveryCharge,
            paymentMethod: paymentMethod ?? first?.paymentMethod
        )
        return await send(data: data, address: config.billPrinterAddress,
                          wifiIP: config.wifiPrinterIP, wifiPort: config.wifiPrinterPort,
                          label: "Bill")
    }

    // MARK: - Test print
    func testPrint(address: String, config: PrinterConfig) async -> PrintResult {
        let testData = ESCPOSBuilder.buildKOT(
            restaurantName: "TEST PRINT",
            slotLabel: "TABLE 1",
            orderId: "TEST-001",
            orderType: .dineIn,
            customerName: "Test Customer",
            deliveryAddress: nil,
            items: [("Test Item", 2), ("Another Item", 1)]
        )
        return await send(data: testData, address: address,
                          wifiIP: config.wifiPrinterIP, wifiPort: config.wifiPrinterPort,
                          label: "Test")
    }

    // MARK: - Core send
    private func send(data: Data, address: String, wifiIP: String, wifiPort: Int, label: String) async -> PrintResult {
        // Try Bluetooth first
        if !address.isEmpty {
            do {
                try await bt.print(address: address, data: data)
                return .success(method: "bluetooth-\(label)")
            } catch {
                print("[\(label)] BT failed: \(error.localizedDescription)")
            }
        }
        // Try WiFi TCP fallback
        if !wifiIP.isEmpty {
            do {
                try await wifiTCPSend(ip: wifiIP, port: wifiPort, data: data)
                return .success(method: "wifi-tcp-\(label)")
            } catch {
                return .failure(PrinterError.printFailed)
            }
        }
        return .failure(PrinterError.notConnected)
    }

    // MARK: - WiFi TCP
    private func wifiTCPSend(ip: String, port: Int, data: Data) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            let conn = NWConnection(
                host: NWEndpoint.Host(ip),
                port: NWEndpoint.Port(integerLiteral: UInt16(port)),
                using: .tcp
            )
            conn.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    conn.send(content: data, completion: .contentProcessed { err in
                        conn.cancel()
                        if let err { cont.resume(throwing: err) }
                        else { cont.resume() }
                    })
                case .failed(let err):
                    cont.resume(throwing: err)
                default: break
                }
            }
            conn.start(queue: .global())
            // Timeout
            DispatchQueue.global().asyncAfter(deadline: .now() + 10) {
                if conn.state != .ready { conn.cancel(); cont.resume(throwing: PrinterError.connectionTimeout) }
            }
        }
    }
}
