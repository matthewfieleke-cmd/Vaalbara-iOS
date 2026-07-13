import Foundation
import VaalbaraCore

/// Deterministic headless simulation — port target for engine.ts (~1,900 lines).
public final class GameEngine: @unchecked Sendable {
    public init() {}

    /// Create a fresh match from seed and faction assignments.
    public func createMatch(seed: UInt32, factions: [FactionId]) -> GameState {
        fatalError("GameEngine.createMatch — port in progress from engine.ts")
    }

    /// Advance one deterministic tick given queued inputs for this tick.
    public func tick(state: GameState, inputs: [PlayerInput]) -> TickResult {
        fatalError("GameEngine.tick — port in progress from engine.ts")
    }
}
