import UIKit

/// Haptic feedback for deploy flings, hits, phase transitions, and duel impacts.
/// UIKit feedback generators are main-actor isolated, so this service is too.
@MainActor
public enum HapticsService {
    private static let lightGenerator = UIImpactFeedbackGenerator(style: .light)
    private static let mediumGenerator = UIImpactFeedbackGenerator(style: .medium)
    private static let heavyGenerator = UIImpactFeedbackGenerator(style: .heavy)
    private static let rigidGenerator = UIImpactFeedbackGenerator(style: .rigid)
    private static let notificationGenerator = UINotificationFeedbackGenerator()

    public static func light() {
        lightGenerator.prepare()
        lightGenerator.impactOccurred()
    }

    public static func medium() {
        mediumGenerator.prepare()
        mediumGenerator.impactOccurred()
    }

    public static func heavy() {
        heavyGenerator.prepare()
        heavyGenerator.impactOccurred()
    }

    public static func success() {
        notificationGenerator.prepare()
        notificationGenerator.notificationOccurred(.success)
    }

    public static func warning() {
        notificationGenerator.prepare()
        notificationGenerator.notificationOccurred(.warning)
    }

    public static func phaseTransition() {
        rigidGenerator.prepare()
        rigidGenerator.impactOccurred(intensity: 1.0)
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(80))
            rigidGenerator.impactOccurred(intensity: 0.6)
        }
    }
}
