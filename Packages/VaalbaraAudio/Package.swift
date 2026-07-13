// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VaalbaraAudio",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "VaalbaraAudio", targets: ["VaalbaraAudio"]),
    ],
    dependencies: [
        .package(path: "../VaalbaraCore"),
    ],
    targets: [
        .target(
            name: "VaalbaraAudio",
            dependencies: ["VaalbaraCore"]
        ),
    ]
)
