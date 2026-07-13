import SwiftUI
import VaalbaraCore

struct ResultsView: View {
    @EnvironmentObject private var appState: AppState

    private var headline: String {
        guard let result = appState.lastResult else { return "Match Complete" }
        switch result.winner {
        case .tie: return "Official Tie"
        case .player(let id): return id == result.seat ? "Victory" : "Defeat"
        }
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text(headline)
                .font(.system(size: 40, weight: .bold, design: .serif))
                .foregroundStyle(VaalbaraTheme.ink)
            Button("Rematch") { appState.screen = .matchmaking }
                .buttonStyle(VaalbaraPrimaryButtonStyle())
            Button("Menu") {
                appState.matchConfig = nil
                appState.screen = .menu
            }
            .foregroundStyle(VaalbaraTheme.inkDim)
            Spacer()
        }
        .padding()
    }
}
