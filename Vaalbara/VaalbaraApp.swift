import SwiftUI

@main
struct VaalbaraApp: App {
    @StateObject private var appState = AppState()

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
