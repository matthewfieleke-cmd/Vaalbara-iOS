// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VaalbaraEngine",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "VaalbaraEngine", targets: ["VaalbaraEngine"]),
    ],
    dependencies: [
        .package(path: "../VaalbaraCore"),
    ],
    targets: [
        .target(
            name: "VaalbaraEngine",
            dependencies: ["VaalbaraCore"]
        ),
    ]
)
