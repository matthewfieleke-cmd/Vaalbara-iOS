import SwiftUI
import VaalbaraCore
import VaalbaraEngine

@MainActor
struct BattleView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var driver = TickDriver()

    var body: some View {
        VStack(spacing: 0) {
            BattleCanvasView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            Text("Battle renderer port in progress")
                .font(.caption)
                .foregroundStyle(VaalbaraTheme.inkDim)
                .padding(8)
        }
        .onAppear {
            guard let config = appState.matchConfig else { return }
            driver.onGameOver = { winner in
                appState.endMatch(winner: winner, seat: config.localSeat)
            }
            driver.start(config: config)
        }
        .onDisappear { driver.stop() }
    }
}
