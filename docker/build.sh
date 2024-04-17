#!/usr/bin/env bash

command -v docker >/dev/null 2>&1 || {
    echo "Docker is not running. Please start Docker and try again."
    exit 1
}

command -v jq >/dev/null 2>&1 || {
    echo "jq is not installed. Please install jq and try again."
    exit 1
}

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../")"

APP_VERSION="$(jq -r '.version' "$MONOREPO_ROOT/apps/web/package.json")"
GIT_SHA="$(git rev-parse HEAD)"

echo "Building docker image for monorepo at $MONOREPO_ROOT"
echo "App version: $APP_VERSION"
echo "Git SHA: $GIT_SHA"

docker build -f "$SCRIPT_DIR/Dockerfile" \
    --progress=plain \
    -t "documenso:latest" \
    -t "documenso:$GIT_SHA" \
    -t "documenso:$APP_VERSION" \
    "$MONOREPO_ROOT"
