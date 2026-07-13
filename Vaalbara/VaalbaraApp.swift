import SwiftUI
import VaalbaraAudio

@main
struct VaalbaraApp: App {
    @StateObject private var appState = AppState(
        profileStore: ProfileStore(),
        audio: ProceduralScoreEngine()
    )

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .preferredColorScheme(.dark)
                .task {
                    // Defer Game Center auth until the UI is up; setting the
                    // authenticate handler during App.init can crash at launch.
                    GameCenterService.shared.authenticate()
                }
        }
    }
}
