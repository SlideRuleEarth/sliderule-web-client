#!/bin/bash
#
# Generate a web-client release-notes markdown file for a given version,
# derived from the git commit subjects since the previous tag.
#
# Usage:
#   gen-release-notes.sh <vX.Y.Z> [--force]
#
# Writes web-client/src/assets/content/release-notes/<vX.Y.Z>.md
# These files are bundled into the web client at build time (see LandingView.vue)
# and mirrored to a GitHub Release at tag time (see publish-gh-release.sh).
#
# Idempotent: an existing file is left untouched unless --force is passed. This
# lets a developer pre-generate the draft (`make gen-release-notes VERSION=...`),
# hand-edit it, and have the tag flow preserve their edits.
#
set -euo pipefail

VERSION="${1:-}"
FORCE="${2:-}"

if [[ "$VERSION" != "v"*"."*"."* ]]; then
    echo "Usage: gen-release-notes.sh <vX.Y.Z> [--force]" >&2
    echo "Invalid version number: '$VERSION'" >&2
    exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"
NOTES_DIR="$ROOT_DIR/web-client/src/assets/content/release-notes"
NOTES_FILE="$NOTES_DIR/$VERSION.md"

if [[ -f "$NOTES_FILE" && "$FORCE" != "--force" ]]; then
    echo "Release notes already exist: $NOTES_FILE (use --force to regenerate)"
    exit 0
fi

mkdir -p "$NOTES_DIR"

# Previous tag — computed before the new tag is created. Falls back to the full
# history when no tags exist yet (first release).
PREV_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
if [[ -n "$PREV_TAG" ]]; then
    RANGE="$PREV_TAG..HEAD"
else
    RANGE="HEAD"
fi

BODY="$(git log "$RANGE" --no-merges --pretty='- %s (%h)')"
if [[ -z "$BODY" ]]; then
    BODY="- No notable changes."
fi

DATE="$(date +%Y-%m-%d)"

{
    echo "# $VERSION — $DATE"
    echo
    echo "$BODY"
} > "$NOTES_FILE"

echo "Wrote $NOTES_FILE"
