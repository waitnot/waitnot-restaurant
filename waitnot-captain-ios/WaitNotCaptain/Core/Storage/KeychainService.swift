import Foundation
import Security

final class KeychainService {
    static let shared = KeychainService()
    private init() {}

    enum Key: String {
        case staffToken    = "com.waitnot.captain.staffToken"
        case staffData     = "com.waitnot.captain.staffData"
        case printerConfig = "com.waitnot.captain.printerConfig"
    }

    func save(_ value: String, forKey key: Key) {
        guard let data = value.data(using: .utf8) else { return }
        saveData(data, forKey: key)
    }

    func saveData(_ data: Data, forKey key: Key) {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue,
            kSecValueData:   data
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    func load(forKey key: Key) -> String? {
        guard let data = loadData(forKey: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func loadData(forKey key: Key) -> Data? {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue,
            kSecReturnData:  true,
            kSecMatchLimit:  kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    func delete(forKey key: Key) {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue
        ]
        SecItemDelete(query as CFDictionary)
    }
}
