// swift-tools-version: 6.2
// Package manifest for the MrBeanBot macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "MrBeanBot",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "MrBeanBotIPC", targets: ["MrBeanBotIPC"]),
        .library(name: "MrBeanBotDiscovery", targets: ["MrBeanBotDiscovery"]),
        .executable(name: "MrBeanBot", targets: ["MrBeanBot"]),
        .executable(name: "mrbeanbot-mac", targets: ["MrBeanBotMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/MrBeanBotKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "MrBeanBotIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MrBeanBotDiscovery",
            dependencies: [
                .product(name: "MrBeanBotKit", package: "MrBeanBotKit"),
            ],
            path: "Sources/MrBeanBotDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MrBeanBot",
            dependencies: [
                "MrBeanBotIPC",
                "MrBeanBotDiscovery",
                .product(name: "MrBeanBotKit", package: "MrBeanBotKit"),
                .product(name: "MrBeanBotChatUI", package: "MrBeanBotKit"),
                .product(name: "MrBeanBotProtocol", package: "MrBeanBotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/MrBeanBot.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MrBeanBotMacCLI",
            dependencies: [
                "MrBeanBotDiscovery",
                .product(name: "MrBeanBotKit", package: "MrBeanBotKit"),
                .product(name: "MrBeanBotProtocol", package: "MrBeanBotKit"),
            ],
            path: "Sources/MrBeanBotMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "MrBeanBotIPCTests",
            dependencies: [
                "MrBeanBotIPC",
                "MrBeanBot",
                "MrBeanBotDiscovery",
                .product(name: "MrBeanBotProtocol", package: "MrBeanBotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
