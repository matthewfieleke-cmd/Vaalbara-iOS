import Foundation
import VaalbaraCore

/// Terrain collision baked from arena paintings — port target for navmask.ts + navmask-data.ts.
public enum NavMask {
    public enum WorldId: String, Sendable { case basalt, oasis }

    public static let cellSize = 0.15

    public static func walkable(world: WorldId, x: Double, y: Double, flying: Bool) -> Bool {
        !flying // Placeholder until navmask data is bundled
    }

    public static func isWater(world: WorldId, x: Double, y: Double) -> Bool { false }
    public static func isDeep(world: WorldId, x: Double, y: Double) -> Bool { false }
}
