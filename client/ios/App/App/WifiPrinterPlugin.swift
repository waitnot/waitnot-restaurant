import Foundation
import Capacitor

/// WifiPrinterPlugin
/// Sends raw ESC/POS bytes to a WiFi/TCP thermal printer from iOS.
/// Registered via CAPPlugin — no additional Podfile entry needed.
@objc(WifiPrinterPlugin)
public class WifiPrinterPlugin: CAPPlugin {

    /// print(options) — sends ESC/POS hex bytes to printer via TCP socket
    /// options: { host: String, port: Int, hex: String }
    @objc func print(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), !host.isEmpty else {
            call.reject("host is required")
            return
        }
        let port = UInt32(call.getInt("port") ?? 9100)
        guard let hex = call.getString("hex"), !hex.isEmpty else {
            call.reject("hex is required")
            return
        }
        guard let data = hexToData(hex) else {
            call.reject("Invalid hex string")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            self.sendTCP(host: host, port: port, data: data) { success, error in
                DispatchQueue.main.async {
                    if success {
                        call.resolve(["success": true])
                    } else {
                        call.reject(error ?? "Print failed")
                    }
                }
            }
        }
    }

    /// testConnection(options) — sends a test page to confirm printer is reachable
    /// options: { host: String, port: Int }
    @objc func testConnection(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), !host.isEmpty else {
            call.reject("host is required")
            return
        }
        let port = UInt32(call.getInt("port") ?? 9100)

        let testBytes: [UInt8] = [
            0x1B, 0x40,
            0x1B, 0x61, 0x01,
            0x1B, 0x45, 0x01
        ] + Array("WIFI PRINTER TEST\n".utf8) + [
            0x1B, 0x45, 0x00
        ] + Array("WaitNot POS\n".utf8) + Array("Connection OK\n".utf8) + [
            0x0A, 0x0A, 0x0A,
            0x1D, 0x56, 0x42, 0x03
        ]

        let data = Data(testBytes)
        DispatchQueue.global(qos: .userInitiated).async {
            self.sendTCP(host: host, port: port, data: data) { success, error in
                DispatchQueue.main.async {
                    if success {
                        call.resolve(["success": true, "connected": true])
                    } else {
                        call.reject(error ?? "Connection failed")
                    }
                }
            }
        }
    }

    // MARK: - TCP

    private func sendTCP(host: String, port: UInt32, data: Data, completion: @escaping (Bool, String?) -> Void) {
        var readStream: Unmanaged<CFReadStream>?
        var writeStream: Unmanaged<CFWriteStream>?

        CFStreamCreatePairWithSocketToHost(kCFAllocatorDefault, host as CFString, port, &readStream, &writeStream)

        guard let outputStream = writeStream?.takeRetainedValue() as? OutputStream else {
            completion(false, "Could not create output stream to \(host):\(port)")
            return
        }

        outputStream.open()

        let deadline = Date().addingTimeInterval(8)
        while outputStream.streamStatus == .opening && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.05)
        }

        guard outputStream.streamStatus == .open else {
            outputStream.close()
            completion(false, "Connection failed to \(host):\(port) (status \(outputStream.streamStatus.rawValue))")
            return
        }

        let bytes = [UInt8](data)
        var totalWritten = 0
        let timeout = Date().addingTimeInterval(15)

        while totalWritten < bytes.count && Date() < timeout {
            let remaining = bytes.count - totalWritten
            let written = bytes.withUnsafeBufferPointer { ptr in
                outputStream.write(ptr.baseAddress! + totalWritten, maxLength: remaining)
            }
            if written > 0 {
                totalWritten += written
            } else if written < 0 {
                outputStream.close()
                completion(false, outputStream.streamError?.localizedDescription ?? "Write error")
                return
            } else {
                Thread.sleep(forTimeInterval: 0.01)
            }
        }

        Thread.sleep(forTimeInterval: 0.3)
        outputStream.close()

        if totalWritten >= bytes.count {
            completion(true, nil)
        } else {
            completion(false, "Write timeout — sent \(totalWritten)/\(bytes.count) bytes")
        }
    }

    private func hexToData(_ hex: String) -> Data? {
        var data = Data()
        var i = hex.startIndex
        while i < hex.endIndex {
            let next = hex.index(i, offsetBy: 2, limitedBy: hex.endIndex) ?? hex.endIndex
            guard let byte = UInt8(hex[i..<next], radix: 16) else { return nil }
            data.append(byte)
            i = next
        }
        return data.isEmpty ? nil : data
    }
}
