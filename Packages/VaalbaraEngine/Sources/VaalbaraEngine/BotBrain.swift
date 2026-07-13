import Foundation
import VaalbaraCore

/// Scripted opponent for offline v1 — port target for BotBrain in engine.ts.
public struct BotBrain: Sendable {
    public let seat: PlayerId

    public init(seat: PlayerId) {
        self.seat = seat
    }

    public func decide(state: GameState) -> PlayerAction? {
        nil // Port in progress
    }
}
