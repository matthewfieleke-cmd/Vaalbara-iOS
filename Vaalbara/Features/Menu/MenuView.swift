import SwiftUI
import VaalbaraCore

struct MenuView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 28) {
            Spacer()
            VStack(spacing: 8) {
                Text("Vaalbara")
                    .font(.system(size: 44, weight: .bold, design: .serif))
                    .foregroundStyle(VaalbaraTheme.ink)
                Text("The Last Oasis")
                    .font(.title3)
                    .foregroundStyle(VaalbaraTheme.ember)
            }

            VStack(spacing: 14) {
                Button("Battle", action: appState.startBattleFlow)
                    .buttonStyle(VaalbaraPrimaryButtonStyle())
                Button("Duels", action: appState.startDuelFlow)
                    .buttonStyle(VaalbaraSecondaryButtonStyle())
                Button("Replay Intro") { appState.screen = .cinematic }
                    .font(.subheadline)
                    .foregroundStyle(VaalbaraTheme.inkDim)
            }

            VStack(spacing: 4) {
                Text(appState.profile.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(VaalbaraTheme.ink)
                Text("\(appState.profile.wins)W · \(appState.profile.losses)L · \(appState.profile.ties)T")
                    .font(.caption)
                    .foregroundStyle(VaalbaraTheme.inkDim)
            }
            Spacer()
        }
        .padding()
    }
}

struct VaalbaraSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(VaalbaraTheme.ink)
            .padding(.horizontal, 28)
            .padding(.vertical, 14)
            .background(VaalbaraTheme.card.opacity(configuration.isPressed ? 0.7 : 1))
            .overlay(Capsule().stroke(VaalbaraTheme.ember.opacity(0.5), lineWidth: 1))
            .clipShape(Capsule())
    }
}
