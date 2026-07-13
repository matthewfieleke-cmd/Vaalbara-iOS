// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VaalbaraCore",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "VaalbaraCore", targets: ["VaalbaraCore"]),
    ],
    targets: [
        .target(name: "VaalbaraCore"),
        .testTarget(name: "VaalbaraCoreTests", dependencies: ["VaalbaraCore"]),
    ]
)
