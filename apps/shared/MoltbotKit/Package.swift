// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "MrBeanBotKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "MrBeanBotProtocol", targets: ["MrBeanBotProtocol"]),
        .library(name: "MrBeanBotKit", targets: ["MrBeanBotKit"]),
        .library(name: "MrBeanBotChatUI", targets: ["MrBeanBotChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "MrBeanBotProtocol",
            path: "Sources/MrBeanBotProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MrBeanBotKit",
            dependencies: [
                "MrBeanBotProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/MrBeanBotKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MrBeanBotChatUI",
            dependencies: [
                "MrBeanBotKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/MrBeanBotChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "MrBeanBotKitTests",
            dependencies: ["MrBeanBotKit", "MrBeanBotChatUI"],
            path: "Tests/MrBeanBotKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
