import SwiftUI
import VaalbaraCore
import VaalbaraEngine

struct DuelView: View {
    @EnvironmentObject private var appState: AppState
    @State private var state: DuelState?
    @State private var botIntent: DuelIntent = .strike

    var body: some View {
        VStack(spacing: 16) {
            Text("Champion Duel")
                .font(.title2.weight(.bold))
                .foregroundStyle(VaalbaraTheme.ink)

            if let state {
                Text("Exchange \(state.exchange)")
                    .font(.caption)
                    .foregroundStyle(VaalbaraTheme.inkDim)
                ForEach(state.log.suffix(3), id: \.self) { line in
                    Text(line)
                        .font(.footnote)
                        .foregroundStyle(VaalbaraTheme.inkDim)
                        .multilineTextAlignment(.center)
                }
            }

            HStack(spacing: 12) {
                ForEach(DuelIntent.allCases, id: \.self) { intent in
                    Button(intent.label) {
                        resolve(intent)
                    }
                    .buttonStyle(VaalbaraSecondaryButtonStyle())
                }
            }

            Button("Exit") {
                appState.duelSetup = nil
                appState.screen = .menu
            }
            .foregroundStyle(VaalbaraTheme.inkDim)
        }
        .padding()
        .onAppear {
            guard let setup = appState.duelSetup else { return }
            state = DuelEngine.create(seed: UInt32.random(in: 1...UInt32.max),
                                      playerFaction: setup.faction,
                                      playerOrder: setup.order)
        }
    }

    private func resolve(_ intent: DuelIntent) {
        guard var current = state else { return }
        current = DuelEngine.resolve(state: current, playerIntent: intent, botIntent: botIntent)
        botIntent = DuelIntent.allCases.randomElement() ?? .strike
        state = current
        HapticsService.medium()
    }
}
