#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART_DST="$ROOT/Vaalbara/Resources/Art"

echo "Copying WebP art assets into iOS bundle resources..."
mkdir -p "$ART_DST"
if [[ -d "$ROOT/public/art" ]]; then
  cp -R "$ROOT/public/art/." "$ART_DST/"
  echo "Copied $(find "$ART_DST" -type f | wc -l | tr -d ' ') files to Vaalbara/Resources/Art"
else
  echo "Warning: public/art not found — run from repo root after web assets are present."
fi

if command -v xcodegen >/dev/null 2>&1; then
  echo "Generating Vaalbara.xcodeproj with XcodeGen..."
  (cd "$ROOT" && xcodegen generate)
else
  echo "XcodeGen not installed. On your Mac:"
  echo "  brew install xcodegen"
  echo "  ./Scripts/setup-ios.sh"
  echo "Or open project.yml in Xcode 16+ (File → Open → project.yml)."
fi
