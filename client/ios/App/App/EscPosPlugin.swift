import Foundation
import Capacitor
import CoreBluetooth

/**
 * EscPosPlugin for iOS
 * Bluetooth Low Energy (BLE) Thermal Printer Management for WaitNot Captain.
 * Fully compatible with the Android EscPos plugin interface.
 */
@objc(EscPosPlugin)
public class EscPosPlugin: CAPPlugin, CBCentralManagerDelegate, CBPeripheralDelegate {

    private var centralManager: CBCentralManager!
    private var discoveredPeripherals: [String: CBPeripheral] = [:]
    private var activePeripherals: [String: CBPeripheral] = [:]
    private var writeCharacteristics: [String: CBCharacteristic] = [:]
    private var connectionCalls: [String: CAPPluginCall] = [:]
    private var pendingPrintHex: [String: String] = [:]

    private var pendingScanCall: CAPPluginCall?
    private var savedScanCallId: String?
    private var isScanning = false

    override public func load() {
        super.load()
        centralManager = CBCentralManager(delegate: self, queue: DispatchQueue.main)
    }

    // MARK: - CBCentralManagerDelegate

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state != .poweredOn {
            print("[EscPosPlugin] Bluetooth state changed: \(central.state.rawValue)")
        }
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        let uuid = peripheral.identifier.uuidString
        discoveredPeripherals[uuid] = peripheral

        let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? "Unknown Printer"

        let deviceObj: [String: Any] = [
            "name": name,
            "address": uuid,
            "paired": false,
            "connected": (peripheral.state == .connected),
            "rssi": RSSI.intValue
        ]

        let devicesList = Array(discoveredPeripherals.values).map { p -> [String: Any] in
            let pName = p.name ?? "Unknown Printer"
            return [
                "name": pName,
                "address": p.identifier.uuidString,
                "paired": false,
                "connected": (p.state == .connected)
            ]
        }

        let eventData: [String: Any] = [
            "devices": devicesList,
            "scanning": isScanning,
            "device": deviceObj
        ]

        notifyListeners("scanResult", data: eventData)
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        let uuid = peripheral.identifier.uuidString
        activePeripherals[uuid] = peripheral
        peripheral.delegate = self
        peripheral.discoverServices(nil)
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        let uuid = peripheral.identifier.uuidString
        pendingPrintHex.removeValue(forKey: uuid)
        if let call = connectionCalls.removeValue(forKey: uuid) {
            call.reject("Failed to connect to \(uuid): \(error?.localizedDescription ?? "Unknown error")")
        }
        notifyConnectionState(address: uuid, state: "disconnected")
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        let uuid = peripheral.identifier.uuidString
        activePeripherals.removeValue(forKey: uuid)
        writeCharacteristics.removeValue(forKey: uuid)
        pendingPrintHex.removeValue(forKey: uuid)
        notifyConnectionState(address: uuid, state: "disconnected")
    }

    // MARK: - CBPeripheralDelegate

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services, error == nil else {
            let uuid = peripheral.identifier.uuidString
            pendingPrintHex.removeValue(forKey: uuid)
            if let call = connectionCalls.removeValue(forKey: uuid) {
                call.reject("Service discovery failed: \(error?.localizedDescription ?? "No services")")
            }
            return
        }

        for service in services {
            peripheral.discoverCharacteristics(nil, for: service)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        let uuid = peripheral.identifier.uuidString
        guard let characteristics = service.characteristics, error == nil else {
            return
        }

        for characteristic in characteristics {
            let props = characteristic.properties
            if props.contains(.write) || props.contains(.writeWithoutResponse) {
                writeCharacteristics[uuid] = characteristic
                break
            }
        }

        if writeCharacteristics[uuid] != nil {
            if let call = connectionCalls.removeValue(forKey: uuid) {
                if let hex = pendingPrintHex.removeValue(forKey: uuid) {
                    guard let connPeripheral = activePeripherals[uuid],
                          let char = writeCharacteristics[uuid],
                          let data = hexToData(hex) else {
                        call.reject("Failed to obtain write characteristic after connection")
                        return
                    }
                    sendBytesInChunks(peripheral: connPeripheral, characteristic: char, data: data, call: call)
                } else {
                    call.resolve(["connected": true, "address": uuid])
                }
            }
            notifyConnectionState(address: uuid, state: "connected")
        }
    }

    // MARK: - Plugin Methods

    @objc func getPairedDevices(_ call: CAPPluginCall) {
        guard centralManager.state == .poweredOn else {
            call.reject("Bluetooth is not enabled")
            return
        }

        var list: [[String: Any]] = []

        for (uuid, peripheral) in discoveredPeripherals {
            list.append([
                "name": peripheral.name ?? "Unknown Printer",
                "address": uuid,
                "paired": true,
                "connected": (peripheral.state == .connected)
            ])
        }

        for (uuid, peripheral) in activePeripherals {
            if !discoveredPeripherals.keys.contains(uuid) {
                list.append([
                    "name": peripheral.name ?? "Unknown Printer",
                    "address": uuid,
                    "paired": true,
                    "connected": true
                ])
            }
        }

        call.resolve(["devices": list])
    }

    @objc func scanDevices(_ call: CAPPluginCall) {
        guard centralManager.state == .poweredOn else {
            call.reject("Bluetooth is not enabled")
            return
        }

        discoveredPeripherals.removeAll()
        isScanning = true
        centralManager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])

        call.keepAlive = true  // keep call alive so we can resolve later via pendingScanCall
        pendingScanCall = call

        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
            self?.stopScanInternal()
        }
    }

    @objc func stopScan(_ call: CAPPluginCall) {
        stopScanInternal()
        call.resolve()
    }

    private func stopScanInternal() {
        if isScanning {
            centralManager.stopScan()
            isScanning = false

            let list = Array(discoveredPeripherals.values).map { p -> [String: Any] in
                return [
                    "name": p.name ?? "Unknown Printer",
                    "address": p.identifier.uuidString,
                    "paired": false,
                    "connected": (p.state == .connected)
                ]
            }

            if let call = pendingScanCall {
                call.resolve(["devices": list, "scanning": false])
                pendingScanCall = nil
            }
        }
    }

    @objc func requestPairing(_ call: CAPPluginCall) {
        guard let address = call.getString("address"), !address.isEmpty else {
            call.reject("address required")
            return
        }
        connect(call)
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let address = call.getString("address"), !address.isEmpty else {
            call.reject("address required")
            return
        }

        guard centralManager.state == .poweredOn else {
            call.reject("Bluetooth is off")
            return
        }

        if let p = activePeripherals[address], p.state == .connected, writeCharacteristics[address] != nil {
            call.resolve(["connected": true, "address": address])
            return
        }

        var peripheral = discoveredPeripherals[address] ?? activePeripherals[address]

        if peripheral == nil {
            if let uuid = UUID(uuidString: address) {
                let known = centralManager.retrievePeripherals(withIdentifiers: [uuid])
                peripheral = known.first
            }
        }

        guard let target = peripheral else {
            call.reject("Device not found with address \(address)")
            return
        }

        connectionCalls[address] = call
        centralManager.connect(target, options: nil)

        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
            if let pending = self?.connectionCalls.removeValue(forKey: address) {
                pending.reject("Connection timeout to \(address)")
            }
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        guard let address = call.getString("address"), !address.isEmpty else {
            call.reject("address required")
            return
        }

        if let peripheral = activePeripherals[address] {
            centralManager.cancelPeripheralConnection(peripheral)
        }
        activePeripherals.removeValue(forKey: address)
        writeCharacteristics.removeValue(forKey: address)
        pendingPrintHex.removeValue(forKey: address)
        notifyConnectionState(address: address, state: "disconnected")
        call.resolve()
    }

    @objc func getConnectionState(_ call: CAPPluginCall) {
        let address = call.getString("address")
        if let addr = address {
            let isConn = (activePeripherals[addr]?.state == .connected) && (writeCharacteristics[addr] != nil)
            call.resolve(["address": addr, "state": isConn ? "connected" : "disconnected"])
        } else {
            var arr: [[String: Any]] = []
            for (addr, p) in activePeripherals {
                arr.append([
                    "address": addr,
                    "state": (p.state == .connected && writeCharacteristics[addr] != nil) ? "connected" : "disconnected"
                ])
            }
            call.resolve(["connections": arr])
        }
    }

    @objc func printHex(_ call: CAPPluginCall) {
        guard let address = call.getString("address"), !address.isEmpty else {
            call.reject("address required")
            return
        }

        guard let hex = call.getString("hex"), !hex.isEmpty else {
            call.reject("hex required")
            return
        }

        guard let data = hexToData(hex) else {
            call.reject("Invalid hex data")
            return
        }

        guard let peripheral = activePeripherals[address], peripheral.state == .connected,
              let characteristic = writeCharacteristics[address] else {
            autoConnectAndPrint(address: address, hex: hex, call: call)
            return
        }

        sendBytesInChunks(peripheral: peripheral, characteristic: characteristic, data: data, call: call)
    }

    private func autoConnectAndPrint(address: String, hex: String, call: CAPPluginCall) {
        var peripheral = discoveredPeripherals[address] ?? activePeripherals[address]
        if peripheral == nil {
            if let uuid = UUID(uuidString: address) {
                peripheral = centralManager.retrievePeripherals(withIdentifiers: [uuid]).first
            }
        }

        guard let target = peripheral else {
            call.reject("Printer not connected or found: \(address)")
            return
        }

        connectionCalls[address] = call
        pendingPrintHex[address] = hex

        centralManager.connect(target, options: nil)

        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
            if let pending = self?.connectionCalls.removeValue(forKey: address) {
                self?.pendingPrintHex.removeValue(forKey: address)
                pending.reject("Auto-connect timeout to \(address)")
            }
        }
    }

    private func sendBytesInChunks(peripheral: CBPeripheral, characteristic: CBCharacteristic, data: Data, call: CAPPluginCall) {
        let writeType: CBCharacteristicWriteType = characteristic.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse
        let maxChunkSize = 120

        DispatchQueue.global(qos: .userInitiated).async {
            var offset = 0
            while offset < data.count {
                let chunkSize = min(maxChunkSize, data.count - offset)
                let chunk = data.subdata(in: offset..<(offset + chunkSize))
                peripheral.writeValue(chunk, for: characteristic, type: writeType)
                offset += chunkSize
                Thread.sleep(forTimeInterval: 0.03)
            }

            DispatchQueue.main.async {
                call.resolve(["success": true])
            }
        }
    }

    private func notifyConnectionState(address: String, state: String) {
        notifyListeners("connectionState", data: ["address": address, "state": state])
    }

    private func hexToData(_ hex: String) -> Data? {
        let cleanHex = hex.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "\n", with: "")
        var data = Data()
        var i = cleanHex.startIndex
        while i < cleanHex.endIndex {
            let next = cleanHex.index(i, offsetBy: 2, limitedBy: cleanHex.endIndex) ?? cleanHex.endIndex
            guard let byte = UInt8(cleanHex[i..<next], radix: 16) else { return nil }
            data.append(byte)
            i = next
        }
        return data.isEmpty ? nil : data
    }
}
