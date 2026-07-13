import SwiftUI
import VaalbaraAudio

@main
struct VaalbaraApp: App {
    @StateObject private var appState = AppState(
        profileStore: ProfileStore(),
        audio: ProceduralScoreEngine()
    )

    init() {
        GameCenterService.shared.authenticate()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .preferredColorScheme(.dark)
        }
    }
}
