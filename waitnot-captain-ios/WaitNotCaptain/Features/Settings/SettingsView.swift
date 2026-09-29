import SwiftUI

struct SettingsView: View {
    @ObservedObject var vm: DashboardViewModel
    @EnvironmentObject var appState: AppState
    @StateObject private var btService = BluetoothPrinterService.shared
    @State private var isScanning = false
    @State private var isTesting = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                // Bluetooth status
                Section {
                    HStack {
                        Image(systemName: btService.bluetoothEnabled ? "bluetooth" : "bluetooth.slash")
                            .foregroundColor(btService.bluetoothEnabled ? .blue : .secondary)
                        Text(btService.bluetoothEnabled ? "Bluetooth On" : "Bluetooth Off")
                        Spacer()
                        if !btService.bluetoothEnabled {
                            Link("Settings", destination: URL(string: UIApplication.openSettingsURLString)!)
                                .font(.caption)
                        }
                    }
                } header: {
                    Text("Bluetooth")
                }

                // Printer discovery
                Section {
                    Button {
                        Task { await scan() }
                    } label: {
                        HStack {
                            if isScanning { ProgressView().scaleEffect(0.8) }
                            Text(isScanning ? "Scanning..." : "Find Printers")
                            Spacer()
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .disabled(isScanning || !btService.bluetoothEnabled)

                    ForEach(btService.discoveredDevices) { device in
                        PrinterDeviceRow(
                            device: device,
                            isConnected: btService.connectedAddresses.contains(device.id),
                            isTesting: isTesting == device.id,
                            onConnect: { Task { await connect(device) } },
                            onDisconnect: { btService.disconnect(from: device.id) },
                            onSelect: { role in
                                switch role {
                                case .kitchen: vm.printerConfig.kitchenPrinterAddress = device.id
                                case .bill:    vm.printerConfig.billPrinterAddress = device.id
                                }
                            },
                            isKitchen: vm.printerConfig.kitchenPrinterAddress == device.id,
                            isBill: vm.printerConfig.billPrinterAddress == device.id
                        )
                    }
                } header: {
                    Text("Printer Discovery")
                } footer: {
                    Text("Tap a printer to set it as Kitchen or Bill printer. Make sure printer is powered on and discoverable.")
                }

                // Kitchen printer
                Section {
                    PrinterAddressRow(
                        label: "Kitchen Printer",
                        address: $vm.printerConfig.kitchenPrinterAddress,
                        isConnected: btService.connectedAddresses.contains(vm.printerConfig.kitchenPrinterAddress)
                    )
                    if !vm.printerConfig.kitchenPrinterAddress.isEmpty {
                        Button { Task { await testPrint(vm.printerConfig.kitchenPrinterAddress) } } label: {
                            HStack {
                                if isTesting == vm.printerConfig.kitchenPrinterAddress { ProgressView().scaleEffect(0.8) }
                                Text("Test Kitchen Printer")
                                    .foregroundColor(.brandRed)
                            }
                        }
                    }
                    Toggle("Auto-Print KOT", isOn: $vm.printerConfig.autoPrintKOT)
                } header: {
                    Text("Kitchen Printer")
                }

                // Bill printer
                Section {
                    PrinterAddressRow(
                        label: "Bill Printer",
                        address: $vm.printerConfig.billPrinterAddress,
                        isConnected: btService.connectedAddresses.contains(vm.printerConfig.billPrinterAddress)
                    )
                    if !vm.printerConfig.billPrinterAddress.isEmpty {
                        Button { Task { await testPrint(vm.printerConfig.billPrinterAddress) } } label: {
                            HStack {
                                if isTesting == vm.printerConfig.billPrinterAddress { ProgressView().scaleEffect(0.8) }
                                Text("Test Bill Printer")
                                    .foregroundColor(.brandRed)
                            }
                        }
                    }
                    Toggle("Auto-Print Bill", isOn: $vm.printerConfig.autoPrintBill)
                } header: {
                    Text("Bill Printer")
                }

                // WiFi printer
                Section {
                    HStack {
                        Text("IP Address")
                        Spacer()
                        TextField("192.168.1.100", text: $vm.printerConfig.wifiPrinterIP)
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.numbersAndPunctuation)
                            .frame(width: 160)
                    }
                    HStack {
                        Text("Port")
                        Spacer()
                        TextField("9100", value: $vm.printerConfig.wifiPrinterPort, format: .number)
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.numberPad)
                            .frame(width: 80)
                    }
                } header: {
                    Text("WiFi Printer (Fallback)")
                } footer: {
                    Text("Used when Bluetooth is unavailable. Standard thermal printer port is 9100.")
                }

                // Save
                Section {
                    Button {
                        vm.savePrinterConfig()
                        appState.showToast("Settings saved")
                    } label: {
                        HStack {
                            if isSaving { ProgressView().scaleEffect(0.8) }
                            Text("Save Settings")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .foregroundColor(.brandRed)
                        }
                    }
                }
            }
            .navigationTitle("Printer Settings")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func scan() async {
        isScanning = true
        _ = try? await btService.scanForPrinters(timeout: 10)
        isScanning = false
    }

    private func connect(_ device: PrinterDevice) async {
        do {
            try await btService.connect(to: device.id)
            appState.showToast("Connected to \(device.name)")
        } catch {
            appState.showError(error.localizedDescription)
        }
    }

    private func testPrint(_ address: String) async {
        isTesting = address
        let result = await PrintService.shared.testPrint(address: address, config: vm.printerConfig)
        isTesting = ""
        switch result {
        case .success: appState.showToast("Test print sent!")
        case .failure(let e): appState.showError(e.errorDescription ?? "Print failed")
        }
    }
}

enum PrinterRole { case kitchen, bill }

struct PrinterDeviceRow: View {
    let device: PrinterDevice
    let isConnected: Bool
    let isTesting: Bool
    let onConnect: () -> Void
    let onDisconnect: () -> Void
    let onSelect: (PrinterRole) -> Void
    let isKitchen: Bool
    let isBill: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(device.name).font(.subheadline).fontWeight(.medium)
                    Text(device.id).font(.caption2).foregroundColor(.secondary).lineLimit(1)
                }
                Spacer()
                Circle()
                    .fill(isConnected ? Color.green : Color.gray.opacity(0.4))
                    .frame(width: 8, height: 8)
                Button(isConnected ? "Disconnect" : "Connect", action: isConnected ? onDisconnect : onConnect)
                    .font(.caption).fontWeight(.semibold)
                    .foregroundColor(isConnected ? .secondary : .brandRed)
            }
            if isConnected {
                HStack(spacing: 8) {
                    RoleButton(label: "Kitchen", isActive: isKitchen) { onSelect(.kitchen) }
                    RoleButton(label: "Bill",    isActive: isBill)    { onSelect(.bill) }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct RoleButton: View {
    let label: String; let isActive: Bool; let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption2).fontWeight(.semibold)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(isActive ? Color.brandRed : Color(.systemGray5))
                .foregroundColor(isActive ? .white : .primary)
                .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }
}

struct PrinterAddressRow: View {
    let label: String
    @Binding var address: String
    let isConnected: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                if !address.isEmpty {
                    Text(address)
                        .font(.caption).foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            if address.isEmpty {
                Text("Not set").foregroundColor(.secondary).font(.caption)
            } else {
                HStack(spacing: 4) {
                    Circle().fill(isConnected ? Color.green : Color.orange).frame(width: 7, height: 7)
                    Text(isConnected ? "Connected" : "Not connected").font(.caption)
                        .foregroundColor(isConnected ? .green : .orange)
                }
                Button { address = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                }
                .padding(.leading, 4)
            }
        }
    }
}
