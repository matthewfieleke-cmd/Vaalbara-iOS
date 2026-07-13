import Foundation
import AVFoundation
import VaalbaraCore

/// Procedural Zimmer-style score on AVAudioEngine — faithful port target for audio.ts (~2,100 lines).
@MainActor
public final class ProceduralScoreEngine: ObservableObject {
    public enum Mode: Sendable {
        case menu, battleBasalt, battleOasis, duel, cinematic
    }

    @Published public private(set) var isMuted = false
    @Published public private(set) var isRunning = false

    private let engine = AVAudioEngine()
    private var sessionConfigured = false

    public init() {}

    public func configureSession() throws {
        guard !sessionConfigured else { return }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try session.setActive(true)
        sessionConfigured = true
    }

    public func start() {
        guard !isRunning else { return }
        isRunning = true
        // Port: wire AVAudioEngine nodes mirroring Web Audio graph in audio.ts
    }

    public func setMode(_ mode: Mode) {
        guard isRunning else { return }
        // Port: crossfade layers per phase; minute-by-minute ladder in battleBasalt
    }

    public func setMuted(_ muted: Bool) {
        isMuted = muted
        engine.mainMixerNode.outputVolume = muted ? 0 : 1
    }

    public func playSFX(for event: GameEvent) {
        guard !isMuted else { return }
        // Port: per-species SFX profiles from audio.ts
    }

    public func playResult(won: Bool) {
        guard !isMuted else { return }
        // Port: victory/defeat stinger resolution
    }

    public func updateBattleIntensity(armyDensity: Double, phase: GamePhase, basaltElapsedSec: Double) {
        // Port: THE BOIL — live density nudges rhythm above minute ladder
    }
}
