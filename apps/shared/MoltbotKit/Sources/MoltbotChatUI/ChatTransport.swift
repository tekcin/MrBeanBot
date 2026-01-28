import Foundation

public enum MrBeanBotChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(MrBeanBotChatEventPayload)
    case agent(MrBeanBotAgentEventPayload)
    case seqGap
}

public protocol MrBeanBotChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> MrBeanBotChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [MrBeanBotChatAttachmentPayload]) async throws -> MrBeanBotChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> MrBeanBotChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<MrBeanBotChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension MrBeanBotChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "MrBeanBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> MrBeanBotChatSessionsListResponse {
        throw NSError(
            domain: "MrBeanBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
