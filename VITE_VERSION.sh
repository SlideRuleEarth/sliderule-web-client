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
# Create tag and acrhive
#
git tag -a $VERSION -m "version $VERSION"

