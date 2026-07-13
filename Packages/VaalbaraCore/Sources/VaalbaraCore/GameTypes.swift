import Foundation

// MARK: - Tick & world

public typealias Tick = Int
public typealias PlayerId = Int // 0 or 1
public typealias DuelSide = Int // 0 or 1

public enum FactionId: String, Codable, CaseIterable, Sendable {
    case magma
    case oasis
}

public enum GamePhase: String, Codable, Sendable {
    case basalt
    case transition
    case oasis
    case ended
}

public enum SpeciesId: String, Codable, CaseIterable, Sendable {
    case trex, lion, eagle, honeybadger, scorpion, fireants
    case bear, bighorn, bees, wolves, porcupine, beetles
}

public enum SpellId: String, Codable, Sendable {
    case sulfur, thicket, lavarain
}

public enum CardId: Hashable, Codable, Sendable {
    case species(SpeciesId)
    case phaseSpell
    case lavaRain
}

public enum MatchMode: String, Codable, Sendable {
    case local
    case onlineHost
    case onlineGuest
}

public enum AppScreen: Hashable, Sendable {
    case boot
    case cinematic
    case menu
    case faction
    case matchmaking
    case battle
    case results
    case duelSetup
    case duel
}

// MARK: - Constants (mirrors types.ts)

public enum WorldConstants {
    public static let tickMS = 300
    public static let worldW = 9.0
    public static let worldH = 15.0
    public static let phase1Ticks = 1000
    public static let transitionTicks = 20
    public static let phase2Ticks = 500
    public static let deployDepth = 3.0
    public static let fortArchHalfW = 0.48
    public static let bridgeHalfW = 0.6
    public static let fortWingR = 0.85
    public static let rubbleVisibleDepth = 0.06
    public static let aquaMax = 10.0
    public static let aquaPerTickP1 = 0.08
    public static let aquaPerTickP2 = 0.16
    public static let handSize = 4
    public static let maxArmy = 8
    public static let armyBaseCap = 6
    public static let laneSoftCap = 4
    public static let captureRate = 1.0
    public static let obeliskHP = 2050
    public static let obeliskRadius = 0.55
    public static let aggroRange = 2.15
    public static let ventDmg = 2
    public static let acidDmg = 1
    public static let lotusHealPct = 0.15
    public static let blessingMult = 1.1

    public static let fortLanes: [PlayerId: [Double]] = [
        0: [1.75, 6.5],
        1: [2.6, 7.28],
    ]

    public static let fortWallFront: [PlayerId: Double] = [
        0: 11.65,
        1: 3.35,
    ]

    public static let fortWingY: [PlayerId: Double] = [
        0: 12.4,
        1: 2.6,
    ]

    public static let fortPadY: [PlayerId: Double] = [
        0: 14.55,
        1: 0.45,
    ]

    public static let fortSpawnY: [PlayerId: Double] = [
        0: 14.7,
        1: 0.55,
    ]

    public static func riverBand(for player: PlayerId) -> (y0: Double, y1: Double) {
        switch player {
        case 0: return (9.35, 10.7)
        default: return (fortWallFront[1] ?? 3.35, 5.35)
        }
    }

    public static func inWorld(x: Double, y: Double) -> Bool {
        x >= 0 && x < worldW && y >= 0 && y < worldH
    }

    public static func inDeployBand(player: PlayerId, y: Double) -> Bool {
        player == 0 ? y >= worldH - deployDepth : y < deployDepth
    }

    public static func fortPads(seat: PlayerId) -> [(x: Double, y: Double)] {
        (fortLanes[seat] ?? []).map { ($0, fortPadY[seat] ?? 0) }
    }

    public static func armyCap(phase: GamePhase, basaltElapsedSec: Double = 0) -> Int {
        guard phase == .basalt else { return maxArmy }
        if basaltElapsedSec < 180 { return armyBaseCap }
        if basaltElapsedSec < 240 { return 7 }
        return maxArmy
    }
}

// MARK: - Geometry

public struct Vec2: Codable, Hashable, Sendable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

// MARK: - Cards & units

public struct UnitStats: Codable, Sendable {
    public var hp: Int
    public var dmg: Int
    public var speed: Double
    public var atkCd: Int
    public var range: Double
    public var ranged: Bool
    public var flying: Bool
    public var canHitAir: Bool
    public var heavy: Bool
    public var colossal: Bool
    public var radius: Double
    public var reflectPct: Double
    public var count: Int
    public var formation: Formation

    public enum Formation: String, Codable, Sendable {
        case single, line, pair
    }
}

public struct CardDef: Sendable {
    public let id: CardId
    public let name: String
    public let title: String
    public let cost: Int
    public let kind: Kind
    public let species: SpeciesId?
    public let stats: UnitStats?
    public let blurb: String
    public let hue: Double

    public enum Kind: String, Sendable {
        case unit, spell
    }
}

public struct UnitBuffs: Codable, Sendable {
    public var stun: Int
    public var slowTicks: Int
    public var slowMult: Double
    public var burnStacks: Int
    public var burnTicks: Int
    public var rangeCapTicks: Int
    public var blessed: Bool
    public var berserk: Bool

    public init(
        stun: Int = 0,
        slowTicks: Int = 0,
        slowMult: Double = 1,
        burnStacks: Int = 0,
        burnTicks: Int = 0,
        rangeCapTicks: Int = 0,
        blessed: Bool = false,
        berserk: Bool = false
    ) {
        self.stun = stun
        self.slowTicks = slowTicks
        self.slowMult = slowMult
        self.burnStacks = burnStacks
        self.burnTicks = burnTicks
        self.rangeCapTicks = rangeCapTicks
        self.blessed = blessed
        self.berserk = berserk
    }
}

public struct UnitState: Codable, Sendable {
    public let id: Int
    public let owner: PlayerId
    public let species: SpeciesId
    public var x: Double
    public var y: Double
    public var px: Double
    public var py: Double
    public var hp: Int
    public var maxHp: Int
    public var facing: Int
    public var atkTimer: Int
    public var traveled: Double
    public var stompBank: Double
    public var struckTargets: [Int]
    public var waypoint: Vec2?
    public var stall: Int
    public var stallRef: Double
    public var unstick: Int
    public var buffs: UnitBuffs
    public var stealthed: Bool
    public var action: UnitAction
    public var targetId: Int?
    public var homeWing: Int

    public enum UnitAction: String, Codable, Sendable {
        case idle, move, attack, spawn
    }
}

public struct ProjectileState: Codable, Sendable {
    public let id: Int
    public let owner: PlayerId
    public let kind: ProjectileKind
    public var x: Double
    public var y: Double
    public var px: Double
    public var py: Double
    public var vx: Double
    public var vy: Double
    public var dmg: Int
    public var ticksLeft: Int
    public var targetId: Int?

    public enum ProjectileKind: String, Codable, Sendable {
        case acid
    }
}

public enum ZoneKind: String, Codable, Sendable {
    case sulfur, thicket, acidpool, healmist
}

public struct ZoneState: Codable, Sendable {
    public let id: Int
    public let kind: ZoneKind
    public let owner: PlayerId
    public let x: Double
    public let y: Double
    public let r: Double
    public var ticksLeft: Int
}

public struct PropState: Codable, Sendable {
    public let kind: PropKind
    public let x: Double
    public let y: Double
    public let r: Double
    public var destroyed: Bool

    public enum PropKind: String, Codable, Sendable {
        case vent, reeds, lotus
    }
}

public struct ObeliskState: Codable, Sendable {
    public let owner: PlayerId
    public let wing: Int
    public var hp: Int
    public var maxHp: Int
    public let x: Double
    public let y: Double
    public let r: Double
}

// MARK: - Player board

public struct PlayerBoardState: Codable, Sendable {
    public let faction: FactionId
    public var aqua: Double
    public var hand: [CardId]
    public var queue: [CardId]
    public var damageDealt: Double
    public var territoryScore: Double
    public var blessed: Bool
}

// MARK: - Inputs

public enum PlayerAction: Codable, Sendable {
    case deploy(card: CardId, x: Double, y: Double, dirX: Double, dirY: Double)
    case spell(card: CardId, x: Double, y: Double)
}

public struct PlayerInput: Codable, Sendable {
    public let seq: Int
    public let player: PlayerId
    public let tick: Tick
    public let action: PlayerAction
}

// MARK: - Events

public enum GameEvent: Sendable {
    case spawn(unitId: Int, species: SpeciesId, owner: PlayerId, x: Double, y: Double)
    case attack(unitId: Int, species: SpeciesId, owner: PlayerId, x: Double, y: Double, tx: Double, ty: Double, crit: Bool, air: Bool)
    case hit(unitId: Int, x: Double, y: Double, amount: Int, kind: HitKind)
    case death(unitId: Int, species: SpeciesId, owner: PlayerId, x: Double, y: Double)
    case heal(x: Double, y: Double, amount: Int)
    case roar(species: SpeciesId, x: Double, y: Double)
    case stomp(x: Double, y: Double)
    case charge(unitId: Int, x: Double, y: Double)
    case shoot(unitId: Int, x: Double, y: Double, tx: Double, ty: Double)
    case splash(x: Double, y: Double)
    case spellCast(spell: SpellId, owner: PlayerId, x: Double, y: Double)
    case lavaTelegraph(x: Double, y: Double)
    case lavaStrike(x: Double, y: Double)
    case lotusBurst(x: Double, y: Double)
    case obeliskHit(owner: PlayerId, amount: Int, x: Double, y: Double)
    case obeliskDown(owner: PlayerId, x: Double, y: Double)
    case pondClaimed(player: PlayerId)
    case phaseChange(phase: GamePhase)
    case blessing(player: PlayerId)
    case gameOver(winner: MatchWinner)

    public enum HitKind: String, Sendable {
        case melee, ranged, burn, vent, lava, reflect, stomp
    }
}

public enum MatchWinner: Codable, Hashable, Sendable {
    case player(PlayerId)
    case tie
}

// MARK: - Game state

public struct PhaseConfig: Codable, Sendable {
    public let phase1Ticks: Int
    public let phase2Ticks: Int

    public static let standard = PhaseConfig(
        phase1Ticks: WorldConstants.phase1Ticks,
        phase2Ticks: WorldConstants.phase2Ticks
    )
}

public struct PendingLavaRain: Codable, Sendable {
    public let owner: PlayerId
    public let x: Double
    public let y: Double
    public let resolveTick: Tick
}

public struct GameState: Codable, Sendable {
    public let seed: UInt32
    public let cfg: PhaseConfig
    public var tick: Tick
    public var phase: GamePhase
    public var phaseTicksLeft: Int
    public var units: [UnitState]
    public var projectiles: [ProjectileState]
    public var zones: [ZoneState]
    public var props: [PropState]
    public var obelisks: [ObeliskState]
    public var pendingLava: [PendingLavaRain]
    public var players: [PlayerBoardState]
    public var captureMeter: Double
    public var winner: MatchWinner?
    public var dominanceP0: Double
}

public struct TickResult: Sendable {
    public let state: GameState
    public let events: [GameEvent]
}

// MARK: - Meta

public struct Profile: Codable, Sendable {
    public var name: String
    public var wins: Int
    public var losses: Int
    public var ties: Int
    public var games: Int
    public var favouriteFaction: FactionId

    public static func defaultProfile() -> Profile {
        Profile(
            name: "Wanderer-\(Int.random(in: 1000...9999))",
            wins: 0,
            losses: 0,
            ties: 0,
            games: 0,
            favouriteFaction: .magma
        )
    }
}

public struct MatchConfig: Sendable {
    public let mode: MatchMode
    public let seed: UInt32
    public let localSeat: PlayerId
    public let factions: [FactionId]
    public let roomId: String?

    public init(
        mode: MatchMode,
        seed: UInt32,
        localSeat: PlayerId,
        factions: [FactionId],
        roomId: String? = nil
    ) {
        self.mode = mode
        self.seed = seed
        self.localSeat = localSeat
        self.factions = factions
        self.roomId = roomId
    }
}

public enum MatchOutcome: Sendable {
    case win, loss, tie
}

// MARK: - Duel mode

public enum DuelIntent: String, Codable, CaseIterable, Sendable {
    case strike, guard, special
}

public struct DuelSpecial: Sendable {
    public let name: String
    public let blurb: String
}

public struct DuelStatDef: Sendable {
    public let hp: Int
    public let atk: Int
    public let def: Int
    public let spd: Int
    public let special: DuelSpecial
    public let passive: String?
}

public struct DuelFighter: Codable, Sendable {
    public let species: SpeciesId
    public var hp: Int
    public var maxHp: Int
    public var fury: Int
    public var debuffs: [String]
}

public struct DuelState: Codable, Sendable {
    public let seed: UInt32
    public var exchange: Int
    public var active: [DuelFighter?]
    public var benches: [[SpeciesId]]
    public var log: [String]
    public var winner: DuelSide?
    public var awaitingIntent: Bool
}

public struct DuelSetup: Sendable {
    public let faction: FactionId
    public let order: [SpeciesId]
}

// MARK: - CardId helpers

extension CardId {
    public var speciesId: SpeciesId? {
        if case .species(let id) = self { return id }
        return nil
    }
}

extension CardId: CustomStringConvertible {
    public var description: String {
        switch self {
        case .species(let id): return id.rawValue
        case .phaseSpell: return "phase-spell"
        case .lavaRain: return "lavarain"
        }
    }
}
