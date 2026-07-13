import Foundation
import VaalbaraCore

/// Real-time pacing, input queue, and rewind/replay — port target for TickDriver in engine.ts.
@MainActor
public final class TickDriver: ObservableObject {
    @Published public private(set) var state: GameState?
    public var onEvents: (([GameEvent]) -> Void)?
    public var onGameOver: ((MatchWinner) -> Void)?

    private let engine = GameEngine()
    private var timer: Timer?
    private var inputQueue: [PlayerInput] = []
    private var nextSeq = 0

    public init() {}

    public func start(config: MatchConfig) {
        state = engine.createMatch(seed: config.seed, factions: config.factions)
        scheduleTimer()
    }

    public func stop() {
        timer?.invalidate()
        timer = nil
    }

    public func enqueue(_ action: PlayerAction, player: PlayerId) {
        guard let state else { return }
        let input = PlayerInput(seq: nextSeq, player: player, tick: state.tick + 1, action: action)
        nextSeq += 1
        inputQueue.append(input)
    }

    private func scheduleTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: Double(WorldConstants.tickMS) / 1000.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.step() }
        }
    }

    private func step() {
        guard var current = state else { return }
        let tickInputs = inputQueue.filter { $0.tick == current.tick + 1 }
        inputQueue.removeAll { $0.tick == current.tick + 1 }
        let result = engine.tick(state: current, inputs: tickInputs)
        current = result.state
        state = current
        onEvents?(result.events)
        if let winner = current.winner {
            stop()
            onGameOver?(winner)
        }
    }
}
