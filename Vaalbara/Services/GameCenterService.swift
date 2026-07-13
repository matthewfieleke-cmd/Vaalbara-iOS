import Combine
import Foundation
import GameKit

/// Game Center: leaderboards + achievements for discoverability. Works fully offline in v1.
@MainActor
public final class GameCenterService: ObservableObject {
    public static let shared = GameCenterService()

    public enum Leaderboard: String {
        case totalWins = "vaalbara.total_wins"
        case duelWins = "vaalbara.duel_wins"
        case winStreak = "vaalbara.win_streak"
    }

    public enum Achievement: String {
        case firstVictory = "vaalbara.first_victory"
        case oasisChampion = "vaalbara.oasis_champion"
        case magmaWarlord = "vaalbara.magma_warlord"
        case duelMaster = "vaalbara.duel_master"
        case perfectMatch = "vaalbara.perfect_match"
    }

    @Published public private(set) var isAuthenticated = false
    @Published public private(set) var localPlayerName: String?

    private var currentStreak = 0
    private var cachedScores: [Leaderboard: Int] = [:]

    private init() {}

    public func authenticate() {
        GKLocalPlayer.local.authenticateHandler = { [weak self] _, error in
            Task { @MainActor in
                guard error == nil, GKLocalPlayer.local.isAuthenticated else {
                    self?.isAuthenticated = false
                    return
                }
                self?.isAuthenticated = true
                self?.localPlayerName = GKLocalPlayer.local.displayName
            }
        }
    }

    public func submitWin(isDuel: Bool) {
        guard isAuthenticated else { return }
        currentStreak += 1
        submit(score(for: .totalWins) + 1, to: .totalWins)
        if isDuel { submit(score(for: .duelWins) + 1, to: .duelWins) }
        submit(currentStreak, to: .winStreak)
        cachedScores[.totalWins] = score(for: .totalWins) + 1
        if isDuel { cachedScores[.duelWins] = score(for: .duelWins) + 1 }
        cachedScores[.winStreak] = currentStreak
        unlock(.firstVictory, percent: 100)
    }

    public func submitLoss() {
        currentStreak = 0
        cachedScores[.winStreak] = 0
        guard isAuthenticated else { return }
        submit(0, to: .winStreak)
    }

    public func unlock(_ achievement: Achievement, percent: Double = 100) {
        guard isAuthenticated else { return }
        let ach = GKAchievement(identifier: achievement.rawValue)
        ach.percentComplete = percent
        ach.showsCompletionBanner = true
        GKAchievement.report([ach]) { _ in }
    }

    private func score(for board: Leaderboard) -> Int {
        cachedScores[board, default: 0]
    }

    private func submit(_ value: Int, to board: Leaderboard) {
        GKLeaderboard.submitScore(
            value,
            context: 0,
            player: GKLocalPlayer.local,
            leaderboardIDs: [board.rawValue]
        ) { _ in }
    }
}
