import SwiftUI
import VaalbaraCore

struct DuelSetupView: View {
    @EnvironmentObject private var appState: AppState
    @State private var faction: FactionId = .magma

    var body: some View {
        VStack(spacing: 20) {
            Text("Duel Order")
                .font(.title2.weight(.bold))
                .foregroundStyle(VaalbaraTheme.ink)

            Picker("Faction", selection: $faction) {
                ForEach(FactionId.allCases, id: \.self) { f in
                    Text(GameData.factions[f]?.name ?? f.rawValue).tag(f)
                }
            }
            .pickerStyle(.segmented)

            Text("Default roster order — reorder UI port in progress")
                .font(.caption)
                .foregroundStyle(VaalbaraTheme.inkDim)

            Button("Begin Duel") {
                let order = GameData.factions[faction]?.cards.compactMap(\.species) ?? []
                appState.beginDuel(DuelSetup(faction: faction, order: order))
            }
            .buttonStyle(VaalbaraPrimaryButtonStyle())

            Button("Back") { appState.screen = .menu }
                .foregroundStyle(VaalbaraTheme.inkDim)
        }
        .padding()
    }
}
