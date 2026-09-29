import Foundation

struct PrinterConfig: Codable, Equatable {
    var kitchenPrinterAddress: String  = ""
    var billPrinterAddress: String     = ""
    var wifiPrinterIP: String          = ""
    var wifiPrinterPort: Int           = 9100
    var autoPrintKOT: Bool             = false
    var autoPrintBill: Bool            = false
    var paperWidth: PaperWidth         = .mm80

    var hasKitchenPrinter: Bool { !kitchenPrinterAddress.isEmpty || !wifiPrinterIP.isEmpty }
    var hasBillPrinter:    Bool { !billPrinterAddress.isEmpty    || !wifiPrinterIP.isEmpty }

    enum PaperWidth: String, Codable, CaseIterable {
        case mm58 = "58mm"
        case mm80 = "80mm"
        var charsPerLine: Int { self == .mm58 ? 32 : 48 }
    }
}

final class PrinterConfigStore {
    static let shared = PrinterConfigStore()
    private let keychain = KeychainService.shared
    private init() {}

    func save(_ config: PrinterConfig, restaurantId: String) {
        if let data = try? JSONEncoder().encode(config) {
            keychain.saveData(data, forKey: .printerConfig)
            UserDefaults.standard.set(restaurantId, forKey: "printerConfigRestaurantId")
        }
    }

    func load() -> PrinterConfig {
        guard let data = keychain.loadData(forKey: .printerConfig),
              let config = try? JSONDecoder().decode(PrinterConfig.self, from: data)
        else { return PrinterConfig() }
        return config
    }
}
