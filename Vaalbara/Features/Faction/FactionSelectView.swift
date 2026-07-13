import SwiftUI
import VaalbaraCore

struct FactionSelectView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 24) {
            Text("Choose Your Coalition")
                .font(.title2.weight(.bold))
                .foregroundStyle(VaalbaraTheme.ink)

            ForEach(FactionId.allCases, id: \.self) { faction in
                Button {
                    appState.confirmFaction(faction)
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(GameData.factions[faction]?.name ?? faction.rawValue)
                            .font(.headline)
                        Text(GameData.factions[faction]?.tagline ?? "")
                            .font(.subheadline)
                            .foregroundStyle(VaalbaraTheme.inkDim)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(VaalbaraTheme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
            }

            Button("Back") { appState.screen = .menu }
                .foregroundStyle(VaalbaraTheme.inkDim)
        }
        .padding()
    }
}
