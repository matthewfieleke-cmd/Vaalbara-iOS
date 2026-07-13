import Foundation

/// Faction rosters, deck matrix, and balance numbers — faithful port of data.ts.
public enum GameData {
    private static func unit(
        _ base: (hp: Int, dmg: Int, speed: Double, atkCd: Int),
        range: Double = 0.95,
        ranged: Bool = false,
        flying: Bool = false,
        canHitAir: Bool = false,
        heavy: Bool = false,
        colossal: Bool = false,
        radius: Double = 0.34,
        reflectPct: Double = 0,
        count: Int = 1,
        formation: UnitStats.Formation = .single
    ) -> UnitStats {
        UnitStats(
            hp: base.hp, dmg: base.dmg, speed: base.speed, atkCd: base.atkCd,
            range: range, ranged: ranged, flying: flying, canHitAir: canHitAir,
            heavy: heavy, colossal: colossal, radius: radius, reflectPct: reflectPct,
            count: count, formation: formation
        )
    }

    public static let magmaCards: [CardDef] = [
        CardDef(id: .species(.trex), name: "T-Rex", title: "Tyrant of the Ashfall", cost: 6, kind: .unit, species: .trex,
                stats: unit((530, 50, 0.095, 8), range: 1.1, canHitAir: true, heavy: true, colossal: true, radius: 0.55),
                blurb: "Colossal tank. Every few strides stamps the ground, chipping nearby foes. Chomps flyers from the sky.", hue: 8),
        CardDef(id: .species(.lion), name: "Lion", title: "Ember-Maned Commander", cost: 4, kind: .unit, species: .lion,
                stats: unit((240, 35, 0.17, 4), radius: 0.4),
                blurb: "High-damage commander. His deployment roar freezes nearby enemies solid.", hue: 35),
        CardDef(id: .species(.eagle), name: "Eagle", title: "Cinder Talon", cost: 3, kind: .unit, species: .eagle,
                stats: unit((108, 29, 0.27, 4), flying: true, canHitAir: true, radius: 0.32),
                blurb: "High-speed air assassin. Soars over lava and blockers, hunting the weakest heart on the field.", hue: 20),
        CardDef(id: .species(.honeybadger), name: "Honey Badger", title: "The Unkillable Grudge", cost: 3, kind: .unit, species: .honeybadger,
                stats: unit((180, 23, 0.21, 4), radius: 0.32),
                blurb: "Fast berserker. Below 30% HP it snaps: double attack speed and total immunity to crowd control.", hue: 45),
        CardDef(id: .species(.scorpion), name: "Scorpion", title: "Obsidian Flanker", cost: 3, kind: .unit, species: .scorpion,
                stats: unit((150, 26, 0.17, 4), range: 1.05, radius: 0.36),
                blurb: "A circling flanker whose first sting on every victim stuns them cold.", hue: 285),
        CardDef(id: .species(.fireants), name: "Fire Ants", title: "The Crawling Pyre", cost: 2, kind: .unit, species: .fireants,
                stats: unit((54, 9, 0.2, 4), radius: 0.24, count: 3, formation: .line),
                blurb: "Cheap swarm deployed as three ants, each with its own life. Bites stack a burning acid debuff.", hue: 15),
    ]

    public static let oasisCards: [CardDef] = [
        CardDef(id: .species(.bear), name: "Bear", title: "Warden of the Shallows", cost: 6, kind: .unit, species: .bear,
                stats: unit((555, 55, 0.1, 8), range: 1.1, canHitAir: true, heavy: true, radius: 0.52),
                blurb: "Heavy sweeping tank. Each swipe rakes everything beside its target.", hue: 140),
        CardDef(id: .species(.bighorn), name: "Bighorn Sheep", title: "The Emerald Comet", cost: 4, kind: .unit, species: .bighorn,
                stats: unit((255, 33, 0.22, 4), heavy: true, radius: 0.42),
                blurb: "A charger. After 3+ unbroken strides, its first strike lands triple damage and hurls the victim back.", hue: 90),
        CardDef(id: .species(.bees), name: "Swarm of Bees", title: "The Humming Veil", cost: 3, kind: .unit, species: .bees,
                stats: unit((110, 18, 0.26, 4), flying: true, canHitAir: true, radius: 0.34),
                blurb: "Air support that smothers victims until they can barely reach past their own nose.", hue: 50),
        CardDef(id: .species(.wolves), name: "Pack of Wolves", title: "Twin Fang Doctrine", cost: 3, kind: .unit, species: .wolves,
                stats: unit((152, 25, 0.27, 4), radius: 0.34, count: 2, formation: .pair),
                blurb: "Skirmish pair. Wolves fighting side by side feed off each other for +15% damage.", hue: 210),
        CardDef(id: .species(.porcupine), name: "Porcupine", title: "The Thousand Needles", cost: 3, kind: .unit, species: .porcupine,
                stats: unit((285, 19, 0.14, 4), radius: 0.38, reflectPct: 0.16),
                blurb: "Defensive tank. A share of every melee blow is returned to the attacker.", hue: 160),
        CardDef(id: .species(.beetles), name: "Bombardier Beetles", title: "Chemical Artillery", cost: 5, kind: .unit, species: .beetles,
                stats: unit((125, 16, 0.14, 8), range: 2.4, ranged: true, canHitAir: true, radius: 0.36),
                blurb: "Anti-air artillery. Fires boiling acid that bursts into a caustic, slowing pool.", hue: 130),
    ]

    public static let phaseSpellSulfur = CardDef(
        id: .phaseSpell, name: "Sulfur Cloud", title: "Volcanic Sulfur Cloud", cost: 3, kind: .spell,
        species: nil, stats: nil, blurb: "A choking fog. Enemies inside crawl at half speed.", hue: 55)

    public static let phaseSpellThicket = CardDef(
        id: .phaseSpell, name: "Thicket", title: "Whispering Thicket", cost: 3, kind: .spell,
        species: nil, stats: nil, blurb: "Friendly units vanish into camouflage; enemies wade through at half pace.", hue: 110)

    public static let lavaRainCard = CardDef(
        id: .lavaRain, name: "Lava Rain", title: "Judgement of Old Vaalbara", cost: 5, kind: .spell,
        species: nil, stats: nil, blurb: "A 1.2 s shadow warns the sky is falling. Enemies only.", hue: 12)

    public struct LavaRainBalance: Sendable {
        public static let telegraphTicks = 4
        public static let centerDmg = 130
        public static let flyerCenterMult = 1.6
        public static let midDmg = 65
        public static let rimDmg = 25
        public static let centerR = 0.8
        public static let midR = 1.7
        public static let rimR = 2.6
    }

    public struct SpellBalance: Sendable {
        public static let sulfur = (duration: 33, slowMult: 0.5, chip: 1, radius: 1.5)
        public static let thicket = (duration: 40, slowMult: 0.5, radius: 1.5)
        public static let acidpool = (duration: 10, slowMult: 0.72, radius: 0.75)
        public static let healmist = (duration: 1, radius: 1.4)
    }

    public struct Mechanics: Sendable {
        public static let trexStompDmg = 6
        public static let trexStompRadius = 1.8
        public static let trexStompStride = 1.0
        public static let lionFreezeTicks = 4
        public static let lionRoarRadius = 1.4
        public static let badgerThreshold = 0.3
        public static let scorpionStunTicks = 4
        public static let bearSweepRadius = 0.85
        public static let bighornChargeDist = 3.2
        public static let bighornChargeMult = 2.6
        public static let bighornKnockback = 1.0
        public static let beesRangeCapTicks = 8
        public static let beesRangeCap = 0.95
        public static let wolvesAdjacencyBonus = 0.12
        public static let wolvesAdjacencyRadius = 1.3
        public static let acidBurnTicks = 12
        public static let acidMaxStacks = 4
        public static let acidJetSpeed = 1.4
        public static let acidSplashRadius = 0.8
    }

    public struct FactionInfo: Sendable {
        public let name: String
        public let tagline: String
        public let hue: Double
        public let cards: [CardDef]
    }

    public static let factions: [FactionId: FactionInfo] = [
        .magma: FactionInfo(name: "The Magma Vanguard", tagline: "Forged in the fissures. Tempered in fire.", hue: 14, cards: magmaCards),
        .oasis: FactionInfo(name: "The Oasis Syndicate", tagline: "Water remembers. Water collects.", hue: 165, cards: oasisCards),
    ]

    private static let cardIndex: [SpeciesId: CardDef] = {
        var map: [SpeciesId: CardDef] = [:]
        for card in magmaCards + oasisCards {
            if let species = card.species { map[species] = card }
        }
        return map
    }()

    public static func cardDef(_ id: CardId, phase: GamePhase) -> CardDef {
        switch id {
        case .lavaRain: return lavaRainCard
        case .phaseSpell: return phase == .oasis || phase == .ended ? phaseSpellThicket : phaseSpellSulfur
        case .species(let species):
            guard let def = cardIndex[species] else { fatalError("Unknown card: \(species)") }
            return def
        }
    }

    public static func speciesDef(_ id: SpeciesId) -> CardDef {
        guard let def = cardIndex[id] else { fatalError("Unknown species: \(id)") }
        return def
    }

    public static func buildDeck(faction: FactionId) -> [CardId] {
        let unitCards = factions[faction]?.cards.map(\.id) ?? []
        return unitCards + [.phaseSpell, .lavaRain]
    }

    public static let duelStats: [SpeciesId: DuelStatDef] = [
        .trex: DuelStatDef(hp: 530, atk: 98, def: 30, spd: 3, special: DuelSpecial(name: "Tyrant Chomp", blurb: "210% damage ignoring defense."), passive: nil),
        .lion: DuelStatDef(hp: 340, atk: 66, def: 16, spd: 6, special: DuelSpecial(name: "Ember Roar", blurb: "100% damage + stun."), passive: nil),
        .eagle: DuelStatDef(hp: 240, atk: 58, def: 8, spd: 9, special: DuelSpecial(name: "Sky Dive", blurb: "Evade then 170% damage."), passive: nil),
        .honeybadger: DuelStatDef(hp: 300, atk: 56, def: 18, spd: 5, special: DuelSpecial(name: "Grudge Frenzy", blurb: "Three snaps at 75% each."), passive: "Below 35% HP attacks hit 40% harder."),
        .scorpion: DuelStatDef(hp: 285, atk: 56, def: 14, spd: 7, special: DuelSpecial(name: "Venom Sting", blurb: "110% + bleed 6% max HP for 3 exchanges."), passive: nil),
        .fireants: DuelStatDef(hp: 270, atk: 48, def: 6, spd: 6, special: DuelSpecial(name: "Crawling Pyre", blurb: "90% + burn 5% max HP over 4 exchanges."), passive: nil),
        .bear: DuelStatDef(hp: 540, atk: 90, def: 32, spd: 3, special: DuelSpecial(name: "Crushing Swat", blurb: "170% haymaker + stagger."), passive: nil),
        .bighorn: DuelStatDef(hp: 360, atk: 64, def: 18, spd: 8, special: DuelSpecial(name: "Comet Charge", blurb: "240% damage."), passive: "First strike after entering hits 50% harder."),
        .bees: DuelStatDef(hp: 230, atk: 46, def: 4, spd: 10, special: DuelSpecial(name: "Humming Veil", blurb: "Evade, 110% damage, drain 30 Fury."), passive: nil),
        .wolves: DuelStatDef(hp: 310, atk: 60, def: 12, spd: 8, special: DuelSpecial(name: "Twin Fang", blurb: "Two hits at 115% each."), passive: nil),
        .porcupine: DuelStatDef(hp: 380, atk: 46, def: 28, spd: 4, special: DuelSpecial(name: "Quill Nova", blurb: "120% + reflect debuff."), passive: "Reflects 12% melee damage."),
        .beetles: DuelStatDef(hp: 270, atk: 62, def: 10, spd: 5, special: DuelSpecial(name: "Acid Volley", blurb: "110% + melt 18 DEF."), passive: nil),
    ]
}
