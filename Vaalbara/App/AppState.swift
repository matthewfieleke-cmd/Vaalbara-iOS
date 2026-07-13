import SwiftUI
import VaalbaraCore
import VaalbaraAudio
import VaalbaraNetworking

@MainActor
final class AppState: ObservableObject {
    @Published var screen: AppScreen = .boot
    @Published var profile: Profile
    @Published var faction: FactionId = .magma
    @Published var matchConfig: MatchConfig?
    @Published var duelSetup: DuelSetup?
    @Published var lastResult: (winner: MatchWinner, seat: PlayerId)?

    let profileStore: ProfileStore
    let audio: ProceduralScoreEngine
    let matchTransport: LocalMatchTransport

    init(
        profileStore: ProfileStore,
        audio: ProceduralScoreEngine,
        matchTransport: LocalMatchTransport = LocalMatchTransport()
    ) {
        self.profileStore = profileStore
        self.profile = profileStore.profile
        self.audio = audio
        self.matchTransport = matchTransport
    }

    func finishBoot() {
        screen = .cinematic
    }

    func openMenu() {
        audio.start()
        audio.setMode(.menu)
        screen = .menu
    }

    func startBattleFlow() {
        audio.setMode(.menu)
        screen = .faction
    }

    func startDuelFlow() {
        audio.setMode(.menu)
        screen = .duelSetup
    }

    func confirmFaction(_ faction: FactionId) {
        self.faction = faction
        screen = .matchmaking
    }

    func beginLocalMatch() async {
        let seed = UInt32.random(in: 1...UInt32.max)
        let botFaction: FactionId = faction == .magma ? .oasis : .magma
        let config = MatchConfig(mode: .local, seed: seed, localSeat: 0, factions: [faction, botFaction])
        _ = try? await matchTransport.createLocalSession(config: config)
        matchConfig = config
        audio.setMode(.battleBasalt)
        screen = .battle
    }

    func beginDuel(_ setup: DuelSetup) {
        duelSetup = setup
        audio.setMode(.duel)
        screen = .duel
    }

    func endMatch(winner: MatchWinner, seat: PlayerId) {
        lastResult = (winner, seat)
        let outcome: MatchOutcome
        switch winner {
        case .tie: outcome = .tie
        case .player(let id): outcome = id == seat ? .win : .loss
        }
        profileStore.recordResult(outcome: outcome, faction: faction)
        profile = profileStore.profile
        audio.playResult(won: outcome == .win)
        if outcome == .win { GameCenterService.shared.submitWin(isDuel: false) }
        else if outcome == .loss { GameCenterService.shared.submitLoss() }
        screen = .results
    }

    func toggleMute() {
        audio.setMuted(!audio.isMuted)
    }
}
