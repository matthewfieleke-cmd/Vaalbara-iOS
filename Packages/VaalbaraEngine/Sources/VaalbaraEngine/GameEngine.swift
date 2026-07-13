import Foundation
import VaalbaraCore

/// Deterministic headless simulation — port target for engine.ts (~1,900 lines).
public final class GameEngine: @unchecked Sendable {
    public init() {}

    /// Create a fresh match from seed and faction assignments.
    public func createMatch(seed: UInt32, factions: [FactionId]) -> GameState {
        let p0 = PlayerBoardState(
            faction: factions[0],
            aqua: 5,
            hand: Array(GameData.buildDeck(faction: factions[0]).prefix(WorldConstants.handSize)),
            queue: GameData.buildDeck(faction: factions[0]),
            damageDealt: 0,
            territoryScore: 0,
            blessed: false
        )
        let p1 = PlayerBoardState(
            faction: factions[1],
            aqua: 5,
            hand: Array(GameData.buildDeck(faction: factions[1]).prefix(WorldConstants.handSize)),
            queue: GameData.buildDeck(faction: factions[1]),
            damageDealt: 0,
            territoryScore: 0,
            blessed: false
        )
        return GameState(
            seed: seed,
            cfg: .standard,
            tick: 0,
            phase: .basalt,
            phaseTicksLeft: WorldConstants.phase1Ticks,
            units: [],
            projectiles: [],
            zones: [],
            props: [],
            obelisks: [],
            pendingLava: [],
            players: [p0, p1],
            captureMeter: 0,
            winner: nil,
            dominanceP0: 0
        )
    }

    /// Advance one deterministic tick given queued inputs for this tick.
    public func tick(state: GameState, inputs: [PlayerInput]) -> TickResult {
        var next = state
        next.tick += 1
        next.phaseTicksLeft = max(0, next.phaseTicksLeft - 1)
        if next.phaseTicksLeft == 0 && next.phase == .basalt {
            next.phase = .ended
            next.winner = .tie
        }
        _ = inputs
        return TickResult(state: next, events: [])
    }
}
