import Foundation
import Combine

// MARK: - Payload Types
struct BatchOrderUpdate {
    let orderIds: [String]
    let status: OrderStatus?
    let paymentMethod: PaymentMethod?
    let paymentStatus: PaymentStatus?
}

struct PrintBillPayload {
    let orders: [Order]
    let order: Order
}

// MARK: - SocketService
/// Native Socket.IO v4 client using URLSessionWebSocketTask.
/// Zero external dependencies. Implements Engine.IO + Socket.IO protocols manually.
@MainActor
final class SocketService: ObservableObject {
    static let shared = SocketService()

    // Published subjects — subscribers observe these
    let newOrder      = PassthroughSubject<Order, Never>()
    let orderUpdated  = PassthroughSubject<Order, Never>()
    let ordersUpdated = PassthroughSubject<BatchOrderUpdate, Never>()
    let orderDeleted  = PassthroughSubject<String, Never>()
    let printKOT      = PassthroughSubject<Order, Never>()
    let printBill     = PassthroughSubject<PrintBillPayload, Never>()

    @Published private(set) var isConnected = false

    private let baseURL = "wss://waitnot-restaurant.onrender.com/socket.io/?EIO=4&transport=websocket"
    private var wsTask: URLSessionWebSocketTask?
    private var restaurantId: String?
    private var isIntentionalDisconnect = false
    private var pingTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private let decoder = JSONDecoder()

    private init() {}

    // MARK: - Connect / Disconnect

    func connect(restaurantId: String) {
        self.restaurantId = restaurantId
        isIntentionalDisconnect = false
        openWebSocket()
    }

    func disconnect() {
        isIntentionalDisconnect = true
        pingTask?.cancel()
        reconnectTask?.cancel()
        wsTask?.cancel(with: .normalClosure, reason: nil)
        wsTask = nil
        isConnected = false
    }

    func emitJoinRoom() {
        guard let rid = restaurantId else { return }
        emit(event: "join-restaurant", value: rid)
    }

    func emitLeaveRoom() {
        guard let rid = restaurantId else { return }
        emit(event: "leave-restaurant", value: rid)
    }

    // MARK: - WebSocket Lifecycle

    private func openWebSocket() {
        guard let url = URL(string: baseURL) else { return }
        let session = URLSession(configuration: .default)
        wsTask = session.webSocketTask(with: url)
        wsTask?.resume()
        startReceiving()
    }

    private func startReceiving() {
        Task { [weak self] in
            guard let self else { return }
            while !isIntentionalDisconnect {
                guard let task = wsTask else { break }
                do {
                    let msg = try await task.receive()
                    switch msg {
                    case .string(let text): handlePacket(text)
                    case .data(let d):
                        if let text = String(data: d, encoding: .utf8) { handlePacket(text) }
                    @unknown default: break
                    }
                } catch {
                    if !isIntentionalDisconnect {
                        isConnected = false
                        scheduleReconnect()
                        break
                    }
                }
            }
        }
    }

    // MARK: - Engine.IO / Socket.IO Packet Parsing

    private func handlePacket(_ text: String) {
        // Engine.IO: "0{...}" = open/handshake
        if text.hasPrefix("0") {
            // Respond with "40" to connect to default namespace
            send(raw: "40")
            return
        }
        // Engine.IO ping "2" → pong "3"
        if text == "2" { send(raw: "3"); return }

        // Socket.IO message starts with "42" (Engine.IO type 4 = message, Socket.IO type 2 = event)
        if text.hasPrefix("42") {
            parseEvent(String(text.dropFirst(2)))
            return
        }

        // Socket.IO connected "40"
        if text == "40" {
            isConnected = true
            emitJoinRoom()
            startPing()
            return
        }
    }

    private func parseEvent(_ jsonStr: String) {
        guard let data = jsonStr.data(using: .utf8),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [Any],
              let eventName = arr.first as? String
        else { return }

        let payload = arr.count > 1 ? arr[1] : nil

        switch eventName {

        case "new-order":
            if let order = decodeOrder(payload) { newOrder.send(order) }

        case "order-updated":
            if let order = decodeOrder(payload) { orderUpdated.send(order) }

        case "orders-updated":
            guard let dict = payload as? [String: Any],
                  let ids = dict["orderIds"] as? [String],
                  let update = dict["updateData"] as? [String: Any]
            else { return }
            let batch = BatchOrderUpdate(
                orderIds: ids,
                status:        (update["status"]         as? String).flatMap { OrderStatus(rawValue: $0) },
                paymentMethod: (update["payment_method"] as? String).flatMap { PaymentMethod(rawValue: $0) },
                paymentStatus: (update["payment_status"] as? String).flatMap { PaymentStatus(rawValue: $0) }
            )
            ordersUpdated.send(batch)

        case "order-deleted":
            if let dict = payload as? [String: Any],
               let id = dict["orderId"] as? String {
                orderDeleted.send(id)
            }

        case "print-kot":
            if let dict = payload as? [String: Any],
               let order = decodeOrder(dict["order"]) {
                printKOT.send(order)
            }

        case "print-bill":
            if let dict = payload as? [String: Any] {
                let orders: [Order] = decodeOrderArray(dict["orders"])
                if let order = decodeOrder(dict["order"]) {
                    printBill.send(PrintBillPayload(orders: orders, order: order))
                }
            }

        default: break
        }
    }

    // MARK: - Emit

    func emit(event: String, value: Any) {
        let arr: [Any] = [event, value]
        guard let data = try? JSONSerialization.data(withJSONObject: arr),
              let str = String(data: data, encoding: .utf8)
        else { return }
        send(raw: "42\(str)")
    }

    private func send(raw text: String) {
        wsTask?.send(.string(text)) { _ in }
    }

    // MARK: - Ping

    private func startPing() {
        pingTask?.cancel()
        pingTask = Task {
            while !isIntentionalDisconnect {
                try? await Task.sleep(nanoseconds: 25_000_000_000)
                send(raw: "2")
            }
        }
    }

    // MARK: - Reconnect

    private func scheduleReconnect() {
        guard !isIntentionalDisconnect else { return }
        reconnectTask?.cancel()
        reconnectTask = Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !isIntentionalDisconnect, let rid = restaurantId else { return }
            connect(restaurantId: rid)
        }
    }

    // MARK: - Decode helpers

    private func decodeOrder(_ payload: Any?) -> Order? {
        guard let payload,
              let data = try? JSONSerialization.data(withJSONObject: payload)
        else { return nil }
        return try? decoder.decode(Order.self, from: data)
    }

    private func decodeOrderArray(_ payload: Any?) -> [Order] {
        guard let payload,
              let data = try? JSONSerialization.data(withJSONObject: payload)
        else { return [] }
        return (try? decoder.decode([Order].self, from: data)) ?? []
    }
}
