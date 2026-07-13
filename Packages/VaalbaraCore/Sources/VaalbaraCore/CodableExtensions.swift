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
