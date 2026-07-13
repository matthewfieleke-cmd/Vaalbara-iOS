import SwiftUI

struct MatchmakingView: View {
    @EnvironmentObject private var appState: AppState
    @State private var isSearching = true

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            ProgressView()
                .scaleEffect(1.4)
                .tint(VaalbaraTheme.ember)
            Text(isSearching ? "Summoning a rival chief…" : "Rival found")
                .font(.headline)
                .foregroundStyle(VaalbaraTheme.ink)
            Text("Offline guest mode — scripted opponent")
                .font(.caption)
                .foregroundStyle(VaalbaraTheme.inkDim)
            Spacer()
            Button("Cancel") { appState.screen = .faction }
                .foregroundStyle(VaalbaraTheme.inkDim)
        }
        .padding()
        .task {
            try? await Task.sleep(for: .milliseconds(1200))
            isSearching = false
            try? await Task.sleep(for: .milliseconds(400))
            await appState.beginLocalMatch()
        }
    }
}
