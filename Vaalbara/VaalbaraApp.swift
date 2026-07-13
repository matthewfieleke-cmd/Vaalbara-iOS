import SwiftUI

@main
struct VaalbaraApp: App {
    var body: some Scene {
        WindowGroup {
            WebGameView()
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
        }
    }
}
