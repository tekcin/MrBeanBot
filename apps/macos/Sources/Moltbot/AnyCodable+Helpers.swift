import MrBeanBotKit
import MrBeanBotProtocol
import Foundation

// Prefer the MrBeanBotKit wrapper to keep gateway request payloads consistent.
typealias AnyCodable = MrBeanBotKit.AnyCodable
typealias InstanceIdentity = MrBeanBotKit.InstanceIdentity

extension AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: AnyCodable]? { self.value as? [String: AnyCodable] }
    var arrayValue: [AnyCodable]? { self.value as? [AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}

extension MrBeanBotProtocol.AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: MrBeanBotProtocol.AnyCodable]? { self.value as? [String: MrBeanBotProtocol.AnyCodable] }
    var arrayValue: [MrBeanBotProtocol.AnyCodable]? { self.value as? [MrBeanBotProtocol.AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: MrBeanBotProtocol.AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [MrBeanBotProtocol.AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}
