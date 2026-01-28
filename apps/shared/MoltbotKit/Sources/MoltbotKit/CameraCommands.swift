import Foundation

public enum MrBeanBotCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum MrBeanBotCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum MrBeanBotCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum MrBeanBotCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct MrBeanBotCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: MrBeanBotCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: MrBeanBotCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: MrBeanBotCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: MrBeanBotCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct MrBeanBotCameraClipParams: Codable, Sendable, Equatable {
    public var facing: MrBeanBotCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: MrBeanBotCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: MrBeanBotCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: MrBeanBotCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
