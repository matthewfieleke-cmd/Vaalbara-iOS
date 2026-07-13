import XCTest
@testable import VaalbaraCore

final class GameDataTests: XCTestCase {
    func testDeckSize() {
        XCTAssertEqual(GameData.buildDeck(faction: .magma).count, 8)
        XCTAssertEqual(GameData.buildDeck(faction: .oasis).count, 8)
    }

    func testDuelStatsCoverage() {
        for species in SpeciesId.allCases {
            XCTAssertNotNil(GameData.duelStats[species], "Missing duel stats for \(species)")
        }
    }

    func testPhaseSpellResolution() {
        let basalt = GameData.cardDef(.phaseSpell, phase: .basalt)
        XCTAssertEqual(basalt.name, "Sulfur Cloud")
        let oasis = GameData.cardDef(.phaseSpell, phase: .oasis)
        XCTAssertEqual(oasis.name, "Thicket")
    }
}
