// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "CapApp-SPM",
  platforms: [.iOS(.v15)],
  products: [
    .library(name: "CapApp-SPM", targets: ["CapApp-SPM"])
  ],
  dependencies: [
    .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.0"),
    .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "11.0.0")
  ],
  targets: [
    .target(
      name: "CapApp-SPM",
      dependencies: [
        .product(name: "Capacitor", package: "capacitor-swift-pm"),
        .product(name: "Cordova", package: "capacitor-swift-pm"),
        .product(name: "FirebaseMessaging", package: "firebase-ios-sdk"),
        .product(name: "FirebaseCore", package: "firebase-ios-sdk")
      ],
      path: "Sources/CapApp-SPM"
    )
  ]
)
