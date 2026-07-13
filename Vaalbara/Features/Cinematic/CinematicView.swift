import SwiftUI
import VaalbaraAudio

struct CinematicView: View {
    let onDone: () -> Void
    @State private var progress: Double = 0

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Text("Vaalbara")
                .font(.system(size: 42, weight: .bold, design: .serif))
                .foregroundStyle(VaalbaraTheme.ink)
            Text("The Last Oasis")
                .font(.title3.weight(.medium))
                .foregroundStyle(VaalbaraTheme.ember)
            Spacer()
            ProgressView(value: progress)
                .tint(VaalbaraTheme.ember)
                .padding(.horizontal, 40)
            Button("Enter the Oasis", action: onDone)
                .buttonStyle(VaalbaraPrimaryButtonStyle())
                .padding(.bottom, 40)
        }
        .onAppear {
            withAnimation(.linear(duration: 4)) { progress = 1 }
        }
    }
}

struct VaalbaraPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.black)
            .padding(.horizontal, 28)
            .padding(.vertical, 14)
            .background(VaalbaraTheme.ember.opacity(configuration.isPressed ? 0.75 : 1))
            .clipShape(Capsule())
    }
}
