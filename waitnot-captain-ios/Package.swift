// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "WaitNotCaptain",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "WaitNotCaptain", targets: ["WaitNotCaptain"])
    ],
    dependencies: [],  // Zero external dependencies — all Apple frameworks
    targets: [
        .target(
            name: "WaitNotCaptain",
            path: "WaitNotCaptain",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "WaitNotCaptainTests",
            dependencies: ["WaitNotCaptain"],
            path: "WaitNotCaptainTests"
        )
    ]
)
