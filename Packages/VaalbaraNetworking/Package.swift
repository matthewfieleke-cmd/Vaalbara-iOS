// swift-tools-version: 5.9
import PackageDescription

/// Networking layer stub — v1 is offline-only; protocols are ready for Firebase or Game Center RT later.
let package = Package(
    name: "VaalbaraNetworking",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "VaalbaraNetworking", targets: ["VaalbaraNetworking"]),
    ],
    dependencies: [
        .package(path: "../VaalbaraCore"),
    ],
    targets: [
        .target(
            name: "VaalbaraNetworking",
            dependencies: ["VaalbaraCore"]
        ),
    ]
)
