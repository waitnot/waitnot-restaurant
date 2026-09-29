import Foundation

// MARK: - ESC/POS Commands
enum ESC {
    static let INIT:       [UInt8] = [0x1B, 0x40]
    static let BOLD_ON:    [UInt8] = [0x1B, 0x45, 0x01]
    static let BOLD_OFF:   [UInt8] = [0x1B, 0x45, 0x00]
    static let CENTER:     [UInt8] = [0x1B, 0x61, 0x01]
    static let LEFT:       [UInt8] = [0x1B, 0x61, 0x00]
    static let DOUBLE_ON:  [UInt8] = [0x1B, 0x21, 0x30]
    static let DOUBLE_OFF: [UInt8] = [0x1B, 0x21, 0x00]
    static let CUT:        [UInt8] = [0x1D, 0x56, 0x42, 0x00]
    static let LF:         [UInt8] = [0x0A]
    static let DASH32 = String(repeating: "-", count: 32)
    static let EQ32   = String(repeating: "=", count: 32)
}

// MARK: - ESC/POS Builder
struct ESCPOSBuilder {

    /// Build KOT (Kitchen Order Ticket) bytes
    static func buildKOT(
        restaurantName: String,
        slotLabel: String,
        orderId: String,
        orderType: OrderType,
        customerName: String?,
        deliveryAddress: String?,
        items: [(name: String, quantity: Int)],
        date: Date = Date()
    ) -> Data {
        var bytes: [UInt8] = []

        let df = DateFormatter()
        df.dateFormat = "dd/MM/yyyy"
        let tf = DateFormatter()
        tf.dateFormat = "HH:mm"
        let dateStr = df.string(from: date)
        let timeStr = tf.string(from: date)

        // Header
        bytes += ESC.INIT
        bytes += ESC.CENTER
        bytes += ESC.DOUBLE_ON
        bytes += ESC.BOLD_ON
        bytes += textBytes(restaurantName.prefix(16).uppercased())
        bytes += ESC.LF
        bytes += ESC.DOUBLE_OFF
        bytes += textBytes("KITCHEN ORDER TICKET")
        bytes += ESC.LF
        bytes += textBytes(orderType.displayName.uppercased())
        bytes += ESC.LF
        bytes += ESC.BOLD_OFF
        bytes += textBytes(ESC.EQ32)
        bytes += ESC.LF

        // Details
        bytes += ESC.LEFT
        bytes += textBytes("SLOT : \(slotLabel.uppercased())")
        bytes += ESC.LF
        bytes += textBytes("DATE : \(dateStr)")
        bytes += ESC.LF
        bytes += textBytes("TIME : \(timeStr)")
        bytes += ESC.LF
        bytes += textBytes("REF  : \(String(orderId.prefix(12)))")
        bytes += ESC.LF
        if let name = customerName, !name.isEmpty {
            bytes += textBytes("NAME : \(name)")
            bytes += ESC.LF
        }
        if let addr = deliveryAddress, !addr.isEmpty {
            bytes += textBytes("ADDR : \(addr.prefix(28))")
            bytes += ESC.LF
        }
        bytes += textBytes(ESC.EQ32)
        bytes += ESC.LF

        // Items header
        bytes += ESC.CENTER
        bytes += ESC.BOLD_ON
        bytes += textBytes("-- ITEMS TO PREPARE --")
        bytes += ESC.LF
        bytes += ESC.BOLD_OFF
        bytes += textBytes(ESC.EQ32)
        bytes += ESC.LF

        // Items
        bytes += ESC.LEFT
        for item in items {
            let nameStr = item.name.prefix(22)
            let qtyStr = "x\(item.quantity)"
            let padding = String(repeating: " ", count: max(1, 32 - nameStr.count - qtyStr.count))
            bytes += textBytes("\(nameStr)\(padding)\(qtyStr)")
            bytes += ESC.LF
        }

        bytes += textBytes(ESC.EQ32)
        bytes += ESC.LF

        // Footer
        bytes += ESC.CENTER
        bytes += ESC.BOLD_ON
        bytes += textBytes("--- PREPARE WITH CARE ---")
        bytes += ESC.LF
        bytes += ESC.BOLD_OFF
        bytes += ESC.LF

        // Cut
        bytes += ESC.CUT

        return Data(bytes)
    }

    /// Build Bill/Receipt bytes
    static func buildBill(
        restaurantName: String,
        slotLabel: String,
        orderType: OrderType,
        customerName: String?,
        customerPhone: String?,
        deliveryAddress: String?,
        items: [(name: String, quantity: Int, price: Double, complimentary: Bool)],
        packagingCharge: Double?,
        deliveryCharge: Double?,
        paymentMethod: PaymentMethod?,
        date: Date = Date()
    ) -> Data {
        var bytes: [UInt8] = []

        let df = DateFormatter()
        df.dateFormat = "dd/MM/yyyy"
        let tf = DateFormatter()
        tf.dateFormat = "HH:mm"

        let title: String
        switch orderType {
        case .dineIn:   title = "DINE-IN RECEIPT"
        case .room:     title = "ROOM RECEIPT"
        case .takeaway: title = "TAKEAWAY RECEIPT"
        case .delivery: title = "DELIVERY RECEIPT"
        }

        bytes += ESC.INIT
        bytes += ESC.CENTER
        bytes += ESC.DOUBLE_ON
        bytes += ESC.BOLD_ON
        bytes += textBytes(restaurantName.prefix(16).uppercased())
        bytes += ESC.LF
        bytes += ESC.DOUBLE_OFF
        bytes += textBytes(title)
        bytes += ESC.LF
        bytes += ESC.BOLD_OFF
        bytes += textBytes(ESC.EQ32)
        bytes += ESC.LF

        bytes += ESC.LEFT
        bytes += textBytes("SLOT  : \(slotLabel.uppercased())")
        bytes += ESC.LF
        bytes += textBytes("DATE  : \(df.string(from: date))")
        bytes += ESC.LF
        bytes += textBytes("TIME  : \(tf.string(from: date))")
        bytes += ESC.LF
        if let name = customerName, !name.isEmpty {
            bytes += textBytes("NAME  : \(name)")
            bytes += ESC.LF
        }
        if let phone = customerPhone, !phone.isEmpty {
            bytes += textBytes("PHONE : \(phone)")
            bytes += ESC.LF
        }
        if let addr = deliveryAddress, !addr.isEmpty {
            bytes += textBytes("ADDR  : \(addr.prefix(26))")
            bytes += ESC.LF
        }
        bytes += textBytes("PAY   : \(paymentMethod?.displayName.uppercased() ?? "CASH")")
        bytes += ESC.LF
        bytes += textBytes(ESC.EQ32)
        bytes += ESC.LF

        // Column headers
        bytes += textBytes(padded("ITEM", 18) + padded("QTY", 4) + padded("AMT", 10, right: true))
        bytes += ESC.LF
        bytes += textBytes(ESC.DASH32)
        bytes += ESC.LF

        var subtotal: Double = 0
        for item in items {
            if item.complimentary {
                bytes += textBytes(padded(String(item.name.prefix(16)), 18) + padded("\(item.quantity)", 4) + padded("COMP", 10, right: true))
            } else {
                let amt = item.price * Double(item.quantity)
                subtotal += amt
                bytes += textBytes(padded(String(item.name.prefix(16)), 18) + padded("\(item.quantity)", 4) + padded(formatCurrency(amt), 10, right: true))
            }
            bytes += ESC.LF
        }
        bytes += textBytes(ESC.DASH32)
        bytes += ESC.LF

        // Charges
        var total = subtotal
        if let pc = packagingCharge, pc > 0 {
            total += pc
            bytes += textBytes("Packaging:           \(formatCurrency(pc))")
            bytes += ESC.LF
        }
        if let dc = deliveryCharge, dc > 0 {
            total += dc
            bytes += textBytes("Delivery:            \(formatCurrency(dc))")
            bytes += ESC.LF
        }

        bytes += textBytes(ESC.EQ32)
        bytes += ESC.LF
        bytes += ESC.CENTER
        bytes += ESC.DOUBLE_ON
        bytes += ESC.BOLD_ON
        bytes += textBytes("TOTAL: \(formatCurrency(total))")
        bytes += ESC.LF
        bytes += ESC.DOUBLE_OFF
        bytes += ESC.BOLD_OFF
        bytes += textBytes(ESC.EQ32)
        bytes += ESC.LF
        bytes += textBytes("  THANK YOU! VISIT AGAIN  ")
        bytes += ESC.LF
        bytes += textBytes("      * * * * *      ")
        bytes += ESC.LF
        bytes += ESC.LF
        bytes += ESC.CUT

        return Data(bytes)
    }

    // MARK: - Helpers
    private static func textBytes(_ text: String) -> [UInt8] {
        return Array(text.utf8)
    }

    private static func padded(_ s: String, _ width: Int, right: Bool = false) -> String {
        if s.count >= width { return String(s.prefix(width)) }
        let pad = String(repeating: " ", count: width - s.count)
        return right ? (pad + s) : (s + pad)
    }

    private static func formatCurrency(_ amount: Double) -> String {
        return String(format: "%.2f", amount)
    }
}

extension OrderType {
    var displayName: String {
        switch self {
        case .dineIn:   return "Dine-In"
        case .room:     return "Room"
        case .takeaway: return "Takeaway"
        case .delivery: return "Delivery"
        }
    }
}
