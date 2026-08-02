#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART_DST="$ROOT/Vaalbara/Resources/Art"

echo "==> Vaalbara iOS setup"
echo "Repo root: $ROOT"

echo "==> Copying WebP art assets..."
mkdir -p "$ART_DST"
if [[ -d "$ROOT/public/art" ]]; then
  cp -R "$ROOT/public/art/." "$ART_DST/"
  echo "Copied $(find "$ART_DST" -type f | wc -l | tr -d ' ') art files."
else
  echo "Note: public/art not found — art may already be under Vaalbara/Resources/Art."
fi

# Always regenerate from the Python scaffold. An optional xcodegen pass used
# to rewrite the project from project.yml with Resources also pulled in via
# sources — that doubled every art file in Copy Bundle Resources and produced
# ~95 "Multiple commands produce" errors in Xcode.
echo "==> Generating Vaalbara.xcodeproj..."
python3 "$ROOT/Scripts/generate-xcodeproj.py"

echo ""
echo "Done. Next steps:"
echo "  cd \"$ROOT\""
echo "  open Vaalbara.xcodeproj"
echo "  In Xcode: set your Development Team under Signing & Capabilities, then build."
