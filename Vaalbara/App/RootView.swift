import SwiftUI
import VaalbaraCore

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ZStack {
            VaalbaraTheme.background.ignoresSafeArea()

            switch appState.screen {
            case .boot: BootView()
            case .cinematic: CinematicView(onDone: appState.openMenu)
            case .menu: MenuView()
            case .faction: FactionSelectView()
            case .matchmaking: MatchmakingView()
            case .battle: BattleView()
            case .results: ResultsView()
            case .duelSetup: DuelSetupView()
            case .duel: DuelView()
            }

            if appState.screen != .boot && appState.screen != .cinematic {
                VStack {
                    HStack {
                        Spacer()
                        Button(action: appState.toggleMute) {
                            Image(systemName: appState.audio.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                                .font(.title3)
                                .foregroundStyle(VaalbaraTheme.inkDim)
                                .padding(12)
                        }
                    }
                    Spacer()
                }
            }
        }
    }
}
