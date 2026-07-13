import Combine
import Foundation
import VaalbaraCore

/// Profile persistence for offline guest mode.
public final class ProfileStore: ObservableObject {
    @Published public private(set) var profile: Profile

    private let defaults: UserDefaults
    private let key = "vaalbara.profile"

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: key),
           let saved = try? JSONDecoder().decode(Profile.self, from: data) {
            profile = saved
        } else {
            profile = Profile.defaultProfile()
        }
    }

    public func save() {
        guard let data = try? JSONEncoder().encode(profile) else { return }
        defaults.set(data, forKey: key)
    }

    public func recordResult(outcome: MatchOutcome, faction: FactionId) {
        profile.games += 1
        profile.favouriteFaction = faction
        switch outcome {
        case .win: profile.wins += 1
        case .loss: profile.losses += 1
        case .tie: profile.ties += 1
        }
        save()
    }
}
