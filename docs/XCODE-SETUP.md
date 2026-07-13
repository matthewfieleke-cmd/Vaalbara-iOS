# Xcode setup (Mac)

## The red X means “build failed”

1. In Xcode’s **left sidebar**, click the **Issue Navigator** icon (triangle with `!`) — or press **⌘5**.
2. Read the error messages there. Common first-time fixes:
   - **Package resolution:** File → Packages → Reset Package Caches, then Resolve Package Versions.
   - **Signing:** set your Development Team (steps below).
   - **Wrong project:** you should see `VaalbaraApp.swift`, not `ContentView.swift`. If you see `ContentView`, you opened a different Xcode project — use the cloned `Vaalbara-iOS` repo.

After pulling the latest branch:

```bash
cd Vaalbara-iOS
git pull
git checkout cursor/native-ios-scaffold-8a48
./Scripts/setup-ios.sh
open Vaalbara.xcodeproj
```

---

## How to find Signing & Capabilities

Xcode hides this until you select the **target**, not a source file.

1. **Left sidebar (Project Navigator)** — click the **blue** icon at the very top named **Vaalbara** (the project, not a folder inside it).
2. In the **center panel**, you’ll see two columns:
   - **PROJECT** → Vaalbara
   - **TARGETS** → **Vaalbara** ← click this one
3. Across the **top of the center panel**, tabs appear:
   - **General** | **Signing & Capabilities** | Resource Tags | Info | Build Settings | …
4. Click **Signing & Capabilities**.
5. Check **Automatically manage signing**.
6. Choose your **Team** (your Apple Developer account).

If you only see file contents (Swift code), you clicked a `.swift` file — go back to step 1.

---

## Run on your iPhone

1. Connect the phone via USB (or use Wi‑Fi debugging).
2. Top toolbar: device menu next to the Run button → pick your iPhone.
3. Press **Run** (▶) or **⌘R**.

First run may prompt you to trust the developer certificate on the phone: Settings → General → VPN & Device Management.
