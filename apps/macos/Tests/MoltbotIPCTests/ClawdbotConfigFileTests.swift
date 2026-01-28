import Foundation
import Testing
@testable import MrBeanBot

@Suite(.serialized)
struct MrBeanBotConfigFileTests {
    @Test
    func configPathRespectsEnvOverride() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("MrBeanBot-config-\(UUID().uuidString)")
            .appendingPathComponent("MrBeanBot.json")
            .path

        await TestIsolation.withEnvValues(["MRBEANBOT_CONFIG_PATH": override]) {
            #expect(MrBeanBotConfigFile.url().path == override)
        }
    }

    @MainActor
    @Test
    func remoteGatewayPortParsesAndMatchesHost() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("MrBeanBot-config-\(UUID().uuidString)")
            .appendingPathComponent("MrBeanBot.json")
            .path

        await TestIsolation.withEnvValues(["MRBEANBOT_CONFIG_PATH": override]) {
            MrBeanBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "ws://gateway.ts.net:19999",
                    ],
                ],
            ])
            #expect(MrBeanBotConfigFile.remoteGatewayPort() == 19999)
            #expect(MrBeanBotConfigFile.remoteGatewayPort(matchingHost: "gateway.ts.net") == 19999)
            #expect(MrBeanBotConfigFile.remoteGatewayPort(matchingHost: "gateway") == 19999)
            #expect(MrBeanBotConfigFile.remoteGatewayPort(matchingHost: "other.ts.net") == nil)
        }
    }

    @MainActor
    @Test
    func setRemoteGatewayUrlPreservesScheme() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("MrBeanBot-config-\(UUID().uuidString)")
            .appendingPathComponent("MrBeanBot.json")
            .path

        await TestIsolation.withEnvValues(["MRBEANBOT_CONFIG_PATH": override]) {
            MrBeanBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "wss://old-host:111",
                    ],
                ],
            ])
            MrBeanBotConfigFile.setRemoteGatewayUrl(host: "new-host", port: 2222)
            let root = MrBeanBotConfigFile.loadDict()
            let url = ((root["gateway"] as? [String: Any])?["remote"] as? [String: Any])?["url"] as? String
            #expect(url == "wss://new-host:2222")
        }
    }

    @Test
    func stateDirOverrideSetsConfigPath() async {
        let dir = FileManager().temporaryDirectory
            .appendingPathComponent("MrBeanBot-state-\(UUID().uuidString)", isDirectory: true)
            .path

        await TestIsolation.withEnvValues([
            "MRBEANBOT_CONFIG_PATH": nil,
            "MRBEANBOT_STATE_DIR": dir,
        ]) {
            #expect(MrBeanBotConfigFile.stateDirURL().path == dir)
            #expect(MrBeanBotConfigFile.url().path == "\(dir)/MrBeanBot.json")
        }
    }
}
