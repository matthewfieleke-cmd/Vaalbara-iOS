import Foundation
import VaalbaraCore

/// Abstraction for matchmaking and input relay. v1 uses LocalMatchTransport only.
public protocol MatchTransport: Sendable {
    func createLocalSession(config: MatchConfig) async throws -> LocalMatchSession
}

public struct LocalMatchSession: Sendable {
    public let config: MatchConfig
    public let localSeat: PlayerId

    public init(config: MatchConfig) {
        self.config = config
        self.localSeat = config.localSeat
    }
}

/// Offline guest mode — mirrors net.ts local path.
public struct LocalMatchTransport: MatchTransport {
    public init() {}

    public func createLocalSession(config: MatchConfig) async throws -> LocalMatchSession {
        LocalMatchSession(config: config)
    }
}

/// Future: Firebase Realtime Database transport (port of net.ts online path).
public struct FirebaseMatchTransport: MatchTransport {
    public struct Keys: Sendable {
        public let apiKey: String
        public let databaseURL: String
    }

    public let keys: Keys

    public init(keys: Keys) {
        self.keys = keys
    }

    public func createLocalSession(config: MatchConfig) async throws -> LocalMatchSession {
        throw MatchTransportError.notImplemented("Firebase transport ships in a future update")
    }
}

public enum MatchTransportError: Error, LocalizedError {
    case notImplemented(String)

    public var errorDescription: String? {
        switch self {
        case .notImplemented(let detail): return detail
        }
    }
}
