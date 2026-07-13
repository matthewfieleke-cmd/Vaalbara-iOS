import Foundation

/// Codable support for CardId and MatchWinner.
extension CardId {
    private enum CodingKeys: String, CodingKey { case type, species }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "species":
            self = .species(try container.decode(SpeciesId.self, forKey: .species))
        case "phaseSpell": self = .phaseSpell
        case "lavaRain": self = .lavaRain
        default: throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: type)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .species(let id):
            try container.encode("species", forKey: .type)
            try container.encode(id, forKey: .species)
        case .phaseSpell:
            try container.encode("phaseSpell", forKey: .type)
        case .lavaRain:
            try container.encode("lavaRain", forKey: .type)
        }
    }
}

extension MatchWinner {
    private enum CodingKeys: String, CodingKey { case type, player }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "player": self = .player(try container.decode(PlayerId.self, forKey: .player))
        case "tie": self = .tie
        default: throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: type)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .player(let id):
            try container.encode("player", forKey: .type)
            try container.encode(id, forKey: .player)
        case .tie:
            try container.encode("tie", forKey: .type)
        }
    }
}

extension PlayerAction {
    private enum CodingKeys: String, CodingKey {
        case type, card, x, y, dirX, dirY
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "deploy":
            self = .deploy(
                card: try container.decode(CardId.self, forKey: .card),
                x: try container.decode(Double.self, forKey: .x),
                y: try container.decode(Double.self, forKey: .y),
                dirX: try container.decode(Double.self, forKey: .dirX),
                dirY: try container.decode(Double.self, forKey: .dirY)
            )
        case "spell":
            self = .spell(
                card: try container.decode(CardId.self, forKey: .card),
                x: try container.decode(Double.self, forKey: .x),
                y: try container.decode(Double.self, forKey: .y)
            )
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: type)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .deploy(let card, let x, let y, let dirX, let dirY):
            try container.encode("deploy", forKey: .type)
            try container.encode(card, forKey: .card)
            try container.encode(x, forKey: .x)
            try container.encode(y, forKey: .y)
            try container.encode(dirX, forKey: .dirX)
            try container.encode(dirY, forKey: .dirY)
        case .spell(let card, let x, let y):
            try container.encode("spell", forKey: .type)
            try container.encode(card, forKey: .card)
            try container.encode(x, forKey: .x)
            try container.encode(y, forKey: .y)
        }
    }
}
