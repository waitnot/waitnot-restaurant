import Foundation
import CoreBluetooth
import Combine

// MARK: - Printer Device
struct PrinterDevice: Identifiable, Hashable {
    let id: String
    let name: String
    var isConnected: Bool = false
}

// MARK: - Bluetooth Printer Service
@MainActor
final class BluetoothPrinterService: NSObject, ObservableObject {
    static let shared = BluetoothPrinterService()

    @Published var discoveredDevices: [PrinterDevice] = []
    @Published var scanStatus: ScanStatus = .idle
    @Published var connectedAddresses: Set<String> = []
    @Published var bluetoothEnabled = false

    enum ScanStatus { case idle, scanning, done, error(String) }

    private var centralManager: CBCentralManager!
    private var peripherals: [String: CBPeripheral] = [:]
    private var writeCharacteristics: [String: CBCharacteristic] = [:]
    private var pendingPrintData: [String: Data] = [:]
    private var connectionContinuations: [String: CheckedContinuation<Void, Error>] = [:]
    private var printContinuations: [String: CheckedContinuation<Void, Error>] = [:]
    private var scanContinuation: CheckedContinuation<[PrinterDevice], Error>?

    private override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: .main)
    }

    // MARK: - Scan
    func scanForPrinters(timeout: TimeInterval = 10) async throws -> [PrinterDevice] {
        guard centralManager.state == .poweredOn else {
            throw PrinterError.bluetoothOff
        }
        discoveredDevices.removeAll()
        peripherals.removeAll()
        scanStatus = .scanning

        return try await withCheckedThrowingContinuation { continuation in
            scanContinuation = continuation
            centralManager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
            Task {
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                self.stopScan()
            }
        }
    }

    func stopScan() {
        centralManager.stopScan()
        scanStatus = .done
        scanContinuation?.resume(returning: discoveredDevices)
        scanContinuation = nil
    }

    // MARK: - Connect
    func connect(to address: String) async throws {
        if connectedAddresses.contains(address) { return }
        guard let peripheral = peripherals[address] else {
            throw PrinterError.deviceNotFound(address)
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connectionContinuations[address] = continuation
            centralManager.connect(peripheral, options: nil)

            Task {
                try? await Task.sleep(nanoseconds: 10_000_000_000)
                if let cont = self.connectionContinuations.removeValue(forKey: address) {
                    cont.resume(throwing: PrinterError.connectionTimeout)
                }
            }
        }
    }

    func disconnect(from address: String) {
        if let peripheral = peripherals[address] {
            centralManager.cancelPeripheralConnection(peripheral)
        }
        connectedAddresses.remove(address)
        writeCharacteristics.removeValue(forKey: address)
    }

    // MARK: - Print
    func print(address: String, data: Data) async throws {
        guard connectedAddresses.contains(address),
              let peripheral = peripherals[address],
              let characteristic = writeCharacteristics[address] else {
            // Auto-connect and retry
            try await connect(to: address)
            guard let peripheral = peripherals[address],
                  let characteristic = writeCharacteristics[address] else {
                throw PrinterError.notConnected
            }
            try await sendData(peripheral: peripheral, characteristic: characteristic, data: data)
            return
        }
        try await sendData(peripheral: peripheral, characteristic: characteristic, data: data)
    }

    private func sendData(peripheral: CBPeripheral, characteristic: CBCharacteristic, data: Data) async throws {
        let chunkSize = 120
        let writeType: CBCharacteristicWriteType = characteristic.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            printContinuations[peripheral.identifier.uuidString] = cont
            Task {
                var offset = 0
                while offset < data.count {
                    let end = min(offset + chunkSize, data.count)
                    let chunk = data.subdata(in: offset..<end)
                    peripheral.writeValue(chunk, for: characteristic, type: writeType)
                    offset += chunkSize
                    try? await Task.sleep(nanoseconds: 30_000_000)
                }
                self.printContinuations.removeValue(forKey: peripheral.identifier.uuidString)?.resume()
            }
        }
    }
}

// MARK: - CBCentralManagerDelegate
extension BluetoothPrinterService: CBCentralManagerDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        Task { @MainActor in
            self.bluetoothEnabled = central.state == .poweredOn
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        Task { @MainActor in
            let id = peripheral.identifier.uuidString
            guard !peripherals.keys.contains(id) else { return }
            peripherals[id] = peripheral
            let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? "Unknown Printer"
            let device = PrinterDevice(id: id, name: name)
            if !discoveredDevices.contains(where: { $0.id == id }) {
                discoveredDevices.append(device)
            }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        Task { @MainActor in
            let id = peripheral.identifier.uuidString
            peripheral.delegate = self
            peripheral.discoverServices(nil)
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        Task { @MainActor in
            let id = peripheral.identifier.uuidString
            connectionContinuations.removeValue(forKey: id)?.resume(throwing: error ?? PrinterError.connectionFailed)
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        Task { @MainActor in
            let id = peripheral.identifier.uuidString
            connectedAddresses.remove(id)
            writeCharacteristics.removeValue(forKey: id)
        }
    }
}

// MARK: - CBPeripheralDelegate
extension BluetoothPrinterService: CBPeripheralDelegate {
    nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        Task { @MainActor in
            guard let services = peripheral.services, error == nil else { return }
            for service in services {
                peripheral.discoverCharacteristics(nil, for: service)
            }
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        Task { @MainActor in
            let id = peripheral.identifier.uuidString
            guard let chars = service.characteristics, error == nil else { return }
            for char in chars {
                if char.properties.contains(.write) || char.properties.contains(.writeWithoutResponse) {
                    writeCharacteristics[id] = char
                    connectedAddresses.insert(id)
                    connectionContinuations.removeValue(forKey: id)?.resume()
                    return
                }
            }
        }
    }
}

// MARK: - Errors
enum PrinterError: LocalizedError {
    case bluetoothOff
    case deviceNotFound(String)
    case notConnected
    case connectionTimeout
    case connectionFailed
    case printFailed

    var errorDescription: String? {
        switch self {
        case .bluetoothOff:          return "Bluetooth is turned off. Please enable it in Settings."
        case .deviceNotFound(let a): return "Printer not found: \(a)"
        case .notConnected:          return "Printer is not connected."
        case .connectionTimeout:     return "Connection timed out. Make sure printer is on."
        case .connectionFailed:      return "Failed to connect to printer."
        case .printFailed:           return "Print failed."
        }
    }
}
