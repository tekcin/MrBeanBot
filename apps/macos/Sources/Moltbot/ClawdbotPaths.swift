import Foundation

enum MrBeanBotEnv {
    static func path(_ key: String) -> String? {
        // Normalize env overrides once so UI + file IO stay consistent.
        guard let raw = getenv(key) else { return nil }
        let value = String(cString: raw).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty
        else {
            return nil
        }
        return value
    }
}

enum MrBeanBotPaths {
    private static let configPathEnv = "MRBEANBOT_CONFIG_PATH"
    private static let stateDirEnv = "MRBEANBOT_STATE_DIR"

    static var stateDirURL: URL {
        if let override = MrBeanBotEnv.path(self.stateDirEnv) {
            return URL(fileURLWithPath: override, isDirectory: true)
        }
        return FileManager().homeDirectoryForCurrentUser
            .appendingPathComponent(".MrBeanBot", isDirectory: true)
    }

    static var configURL: URL {
        if let override = MrBeanBotEnv.path(self.configPathEnv) {
            return URL(fileURLWithPath: override)
        }
        return self.stateDirURL.appendingPathComponent("MrBeanBot.json")
    }

    static var workspaceURL: URL {
        self.stateDirURL.appendingPathComponent("workspace", isDirectory: true)
    }
}
