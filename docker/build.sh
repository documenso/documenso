#!/usr/bin/env bash

set -e

command -v docker >/dev/null 2>&1 || {
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
}

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../")"

APP_VERSION="$(git name-rev --tags --name-only $(git rev-parse HEAD) | head -n 1 | sed 's/\^0//')"
GIT_SHA="$(git rev-parse HEAD)"

echo "📦 Building Docker image for monorepo at $MONOREPO_ROOT"
echo "🔖 App version: $APP_VERSION"
echo "🔑 Git SHA: $GIT_SHA"

# Build with temporary base tag
docker build -f "$SCRIPT_DIR/Dockerfile" \
    --progress=plain \
    -t "documenso-base" \
    "$MONOREPO_ROOT"

# Tag image
if [ ! -z "$DOCKER_REPOSITORY" ]; then
    echo "📛 Using custom repository: $DOCKER_REPOSITORY"

    docker tag "documenso-base" "$DOCKER_REPOSITORY:latest"
    docker tag "documenso-base" "$DOCKER_REPOSITORY:$GIT_SHA"
    
    if [ "$APP_VERSION" != "undefined" ]; then
        docker tag "documenso-base" "$DOCKER_REPOSITORY:$APP_VERSION"
    fi
else
    echo "📛 Using default repository tags: documenso/* and ghcr.io/*"

    docker tag "documenso-base" "documenso/documenso:latest"
    docker tag "documenso-base" "documenso/documenso:$GIT_SHA"
    docker tag "documenso-base" "ghcr.io/documenso/documenso:latest"
    docker tag "documenso-base" "ghcr.io/documenso/documenso:$GIT_SHA"

    if [ "$APP_VERSION" != "undefined" ]; then
        docker tag "documenso-base" "documenso/documenso:$APP_VERSION"
        docker tag "documenso-base" "ghcr.io/documenso/documenso:$APP_VERSION"
    fi
fi

# Do not remove image since you plan to push it later
echo "✅ Image built and tagged. Ready for manual push."
