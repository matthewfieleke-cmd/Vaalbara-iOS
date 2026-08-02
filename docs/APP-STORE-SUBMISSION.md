# App Store submission checklist

## Release identity

- App name: **Vaalbara**
- Bundle ID: `com.vaalbara.thelastoasis`
- Version: `1.2.0`
- Build: `3`
- Devices: iPhone
- Minimum OS: iOS 17
- Developer: Vaalbara Games
- Support: <https://matthewfieleke-cmd.github.io/Vaalbara-iOS/support.html>
- Privacy policy: <https://matthewfieleke-cmd.github.io/Vaalbara-iOS/privacy.html>

A local Xcode archive does not consume a build number. Build `1` remains valid
until a build with that version and number has been uploaded to App Store
Connect. Increment `CURRENT_PROJECT_VERSION` before a second upload.

## Before archiving

1. Use Xcode 26 or newer with the iOS 26 SDK or newer.
2. Pull `main`.
3. Open `Vaalbara.xcodeproj`.
4. Select the Vaalbara target, then Signing & Capabilities.
5. Select the correct Apple Developer team and keep automatic signing enabled.
6. Confirm the registered App ID is `com.vaalbara.thelastoasis`.
7. Do not add Game Center for v1.
8. Run the Release build on a physical iPhone and complete at least one Battle
   and one Duel with the device in airplane mode.
9. Select **Any iOS Device (arm64)**, then Product → Archive.
10. In Organizer, run **Validate App** before uploading.

The committed iOS web bundle is generated with:

```bash
npm run bundle:ios
```

Run that command and commit the result whenever web game code changes.

## App Store Connect

Create the iOS app using bundle ID `com.vaalbara.thelastoasis`.

Recommended first-release disclosures:

- Game Center: disabled
- Online multiplayer: not included
- Accounts/sign-in: none
- In-app purchases: none
- Advertising: none
- Tracking: no
- App privacy: data not collected (profile and preferences stay on-device)
- Export compliance: no non-exempt encryption
- Primary category: Games
- Suggested secondary category: Strategy

Complete the age-rating questionnaire based on the fantasy combat shown in the
submitted build. Use screenshots captured from the same Release build. Do not
describe the app as online or multiplayer in v1 metadata.

## Suggested review notes

> Vaalbara is an offline strategy game with no account or network connection
> required. Tap Battle for a match against an on-device bot, or Duels for the
> offline duel mode. Match history and preferences are stored only on the
> device. The app contains no advertising, analytics, tracking, purchases,
> Game Center, or online multiplayer.

No review account is required.
