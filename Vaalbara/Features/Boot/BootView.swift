import SwiftUI

struct BootView: View {
    @EnvironmentObject private var appState: AppState
    @State private var glow = false

    var body: some View {
        VStack(spacing: 24) {
            Circle()
                .fill(VaalbaraTheme.ember.opacity(glow ? 0.9 : 0.35))
                .frame(width: 18, height: 18)
                .shadow(color: VaalbaraTheme.ember, radius: glow ? 24 : 8)
                .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: glow)

            Text("IGNITING VAALBARA")
                .font(.caption.weight(.semibold))
                .tracking(4)
                .foregroundStyle(VaalbaraTheme.inkDim)
        }
        .task {
            glow = true
            try? await appState.audio.configureSession()
            try? await Task.sleep(for: .milliseconds(900))
            appState.finishBoot()
        }
    }
}
