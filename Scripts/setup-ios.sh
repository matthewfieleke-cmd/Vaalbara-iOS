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

if [[ ! -d "$ROOT/Vaalbara.xcodeproj" ]]; then
  echo "==> Generating Vaalbara.xcodeproj..."
  python3 "$ROOT/Scripts/generate-xcodeproj.py"
else
  echo "==> Vaalbara.xcodeproj already present."
fi

if command -v xcodegen >/dev/null 2>&1; then
  echo "==> XcodeGen detected — regenerating project.yml project (optional)..."
  (cd "$ROOT" && xcodegen generate)
fi

echo ""
echo "Done. Next steps:"
echo "  cd \"$ROOT\""
echo "  open Vaalbara.xcodeproj"
echo "  In Xcode: set your Development Team under Signing & Capabilities, then build."
