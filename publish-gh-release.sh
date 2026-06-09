#!/bin/bash
#
# Mirror a web-client release-notes file to a GitHub Release.
#
# Usage:
#   publish-gh-release.sh <vX.Y.Z>
#
# The committed markdown file remains the source of truth and is bundled into the
# client; this just publishes the same notes to github.com so the Releases page
# is populated. Run AFTER the tag has been pushed (see `src-tag-and-push`).
#
# This is intentionally non-fatal: a missing/unauthenticated `gh`, or a GitHub
# API hiccup, must never break a deploy. It warns and exits 0 in those cases.
#
set -uo pipefail

VERSION="${1:-}"

if [[ "$VERSION" != "v"*"."*"."* ]]; then
    echo "Usage: publish-gh-release.sh <vX.Y.Z>" >&2
    echo "Invalid version number: '$VERSION'" >&2
    exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"
NOTES_FILE="$ROOT_DIR/web-client/src/assets/content/release-notes/$VERSION.md"

if [[ ! -f "$NOTES_FILE" ]]; then
    echo "WARNING: no release-notes file at $NOTES_FILE — skipping GitHub Release." >&2
    exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
    echo "WARNING: 'gh' CLI not found — skipping GitHub Release for $VERSION." >&2
    exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
    echo "WARNING: 'gh' not authenticated — skipping GitHub Release for $VERSION." >&2
    exit 0
fi

# Update in place if the release already exists, otherwise create it.
if gh release view "$VERSION" >/dev/null 2>&1; then
    echo "Updating existing GitHub Release $VERSION..."
    gh release edit "$VERSION" --title "$VERSION" --notes-file "$NOTES_FILE" \
        || echo "WARNING: failed to update GitHub Release $VERSION (continuing)." >&2
else
    echo "Creating GitHub Release $VERSION..."
    gh release create "$VERSION" --title "$VERSION" --notes-file "$NOTES_FILE" \
        || echo "WARNING: failed to create GitHub Release $VERSION (continuing)." >&2
fi

exit 0
