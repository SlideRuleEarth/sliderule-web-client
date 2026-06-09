#!/bin/bash
#
# Acceptable version identifier is x.y.z, e.g. 1.0.4
# the version number is then prepended with 'v' for
# the tags annotation in git.
#
# NOTE: not version.txt is created unlike VERSION.sh
#
VERSION=$1
if [[ "$VERSION" != "v"*"."*"."* ]]; then
    echo "Invalid version number"
    exit 1
fi
if git tag -l | grep -w $VERSION; then
    echo "Git tag already exists"
	exit 1
fi

#
# Generate (if missing) and commit the web-client release notes for this version
# BEFORE tagging, so the tag — and the build, which reads the tag for
# VITE_APP_VERSION — includes the notes file. A pre-existing file (e.g. one a
# developer generated via `make gen-release-notes` and hand-edited) is preserved.
#
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(git rev-parse --show-toplevel)"
NOTES_FILE="$ROOT_DIR/web-client/src/assets/content/release-notes/$VERSION.md"
"$SCRIPT_DIR/gen-release-notes.sh" "$VERSION"
git add "$NOTES_FILE"
if ! git diff --cached --quiet -- "$NOTES_FILE"; then
    git commit -m "Add release notes for $VERSION"
fi

#
# Create tag and acrhive
#
git tag -a $VERSION -m "version $VERSION"

