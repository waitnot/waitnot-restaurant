# WaitNot Captain — Native iOS App

A fully independent, production-ready native iOS app for WaitNot restaurant staff (Captain/Waiter).  
Built with **SwiftUI + Swift 5.9**, targeting **iOS 16+**.  
**Zero external dependencies** — only Apple frameworks.

---

## Architecture

```
WaitNotCaptain/
├── App/                    # Entry point, RootView, AppState
├── Models/                 # Staff, Restaurant, MenuItem, Order (Codable)
├── Core/
│   ├── Network/            # APIClient (URLSession + async/await)
│   ├── Auth/               # AuthStore (Keychain-backed JWT session)
│   ├── Storage/            # KeychainService, LocalCache (UserDefaults)
│   └── Extensions/         # Color+Brand, View+Toast
├── Services/
│   ├── Socket/             # SocketService (native WebSocket, Socket.IO v4)
│   ├── Bluetooth/          # BluetoothPrinterService (CoreBluetooth)
│   ├── Printing/           # PrintService, ESCPOSBuilder, PrinterConfig
│   ├── Notifications/      # NotificationService (UNUserNotificationCenter)
│   ├── OrderRepository.swift
│   └── RestaurantRepository.swift
└── Features/
    ├── Login/              # LoginView
    ├── Dashboard/          # DashboardView + DashboardViewModel
    ├── Tables/             # TablesView (floor plan, table grid)
    ├── Orders/             # OrderTakingView, RunningOrdersView
    ├── History/            # HistoryView
    ├── Sales/              # SalesView
    ├── Profile/            # ProfileView
    └── Settings/           # SettingsView (Bluetooth + WiFi printer config)
```

---

## Features

| Feature | Status |
|---|---|
| Staff login / logout | ✅ |
| JWT session (Keychain) | ✅ |
| Dine-in table floor plan | ✅ |
| Room management | ✅ |
| Takeaway + Delivery orders | ✅ |
| Menu browsing (search + category filter) | ✅ |
| Favourites | ✅ |
| Cart + place order | ✅ |
| Running orders (real-time) | ✅ |
| Socket.IO live updates | ✅ |
| 15s polling fallback | ✅ |
| Edit/remove running items | ✅ |
| Clear table + payment | ✅ |
| Merge & complete (bill generation) | ✅ |
| Order history | ✅ |
| Sales analytics (today/week/month/all) | ✅ |
| Bluetooth printer (CoreBluetooth BLE) | ✅ |
| WiFi TCP printer fallback | ✅ |
| ESC/POS KOT printing | ✅ |
| ESC/POS Bill printing | ✅ |
| Auto-print KOT on new order | ✅ |
| Auto-print Bill on table clear | ✅ |
| Printer scan + connect + test | ✅ |
| Push notifications (APNs) | ✅ |
| Local notifications (new order) | ✅ |
| Restaurant data caching | ✅ |
| Offline-first (cached data) | ✅ |
| Toast messages | ✅ |
| Empty / error states | ✅ |
| iPad support (split layout) | ✅ |

---

## Backend API

The iOS app communicates **directly** with the backend:

```
iOS App → https://waitnot-restaurant.onrender.com
```

No Android dependency whatsoever.

### Endpoints used

| Method | Path | Purpose |
|---|---|---|
| POST | /api/staff/login | Authenticate |
| POST | /api/staff/logout | End session |
| GET | /api/restaurants/:id | Restaurant + menu |
| GET | /api/orders/restaurant/:id?status=active | Active orders |
| GET | /api/orders/restaurant/:id?status=completed | History |
| POST | /api/orders | Create order |
| PATCH | /api/orders/:id/status | Update status |
| PATCH | /api/orders/:id/items | Edit items |
| PATCH | /api/orders/:id/payment | Update payment |
| POST | /api/orders/merge-and-complete | Clear table |
| DELETE | /api/orders/:id | Cancel order |
| POST | /api/devices/register-direct | Register FCM token |

### Socket.IO events (WebSocket)

| Event | Direction | Purpose |
|---|---|---|
| join-restaurant | emit | Join restaurant room |
| new-order | receive | New order created |
| order-updated | receive | Order status/items changed |
| orders-updated | receive | Batch order update |
| order-deleted | receive | Order cancelled |
| print-kot | receive | Auto-print KOT trigger |
| print-bill | receive | Auto-print Bill trigger |

---

## Building

### Requirements
- macOS 14+
- Xcode 15.4+
- iOS 16+ simulator or device

### Steps

```bash
# Open in Xcode
open waitnot-captain-ios/WaitNotCaptain.xcodeproj

# Or build from command line
cd waitnot-captain-ios
xcodebuild build \
  -scheme WaitNotCaptain \
  -destination "platform=iOS Simulator,name=iPhone 15,OS=latest" \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO
```

### Run tests

```bash
xcodebuild test \
  -scheme WaitNotCaptain \
  -destination "platform=iOS Simulator,name=iPhone 15,OS=latest" \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO
```

---

## Signing for device / TestFlight

1. Open `WaitNotCaptain.xcodeproj` in Xcode
2. Select the `WaitNotCaptain` target → Signing & Capabilities
3. Set your **Team** and **Bundle Identifier** (`com.waitnot.captain` or your own)
4. Add **Bluetooth** capability
5. Add **Push Notifications** capability
6. Build → Run on device

---

## Bluetooth Printing

The app uses **CoreBluetooth BLE** to communicate with thermal printers directly.

1. Go to **Profile → Printer Settings**
2. Tap **Find Printers** to scan
3. Connect to your printer
4. Assign it as Kitchen or Bill printer
5. Enable **Auto-Print KOT** / **Auto-Print Bill** toggles
6. Use **Test Print** to verify

The app sends **ESC/POS** bytes over BLE write characteristic.  
Compatible with 80mm thermal printers (SUNMI, Epson, Generic).

WiFi TCP fallback is also available (port 9100).

---

## Independence from Android

This app has **no connection** to the Android app at runtime or build time:

- ✅ No Kotlin / Java code
- ✅ No Capacitor / Cordova
- ✅ No WebView
- ✅ No Android Bluetooth libraries
- ✅ Communicates directly with the backend API
- ✅ Uses Keychain (not Android SharedPreferences)
- ✅ Uses CoreBluetooth (not Android BluetoothAdapter)
- ✅ Uses URLSession WebSocket (not Socket.IO JS library)
- ✅ Uses UNUserNotificationCenter (not Firebase Android SDK)
