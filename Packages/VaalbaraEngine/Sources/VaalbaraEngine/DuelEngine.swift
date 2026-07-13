import Foundation
import VaalbaraCore

/// Pokémon-style champion duel engine — port target for duel.ts.
public enum DuelEngine {
    public static func create(seed: UInt32, playerFaction: FactionId, playerOrder: [SpeciesId]) -> DuelState {
        let botFaction: FactionId = playerFaction == .magma ? .oasis : .magma
        let botOrder = GameData.factions[botFaction]?.cards.compactMap(\.species) ?? []
        return DuelState(
            seed: seed,
            exchange: 0,
            active: [nil, nil],
            benches: [playerOrder, botOrder],
            log: ["Choose your opening move."],
            winner: nil,
            awaitingIntent: true
        )
    }

    public static func resolve(state: DuelState, playerIntent: DuelIntent, botIntent: DuelIntent) -> DuelState {
        var next = state
        next.exchange += 1
        next.log.append("Exchange \(next.exchange): \(playerIntent.webIntent) vs \(botIntent.webIntent)")
        next.awaitingIntent = true
        return next
    }
}
