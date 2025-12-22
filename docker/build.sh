#!/usr/bin/env bash

command -v docker >/dev/null 2>&1 || {
    echo "Docker is not running. Please start Docker and try again."
    exit 1
}

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../")"

# Get Git information
APP_VERSION="$(git name-rev --tags --name-only $(git rev-parse HEAD) | head -n 1 | sed 's/\^0//')"
GIT_SHA="$(git rev-parse HEAD)"

echo "Building docker image for monorepo at $MONOREPO_ROOT"
echo "App version: $APP_VERSION"
echo "Git SHA: $GIT_SHA"

# Build with temporary base tag
docker build -f "$SCRIPT_DIR/Dockerfile" \
    --progress=plain \
    --build-arg NEXT_PRIVATE_TELEMETRY_KEY="${NEXT_PRIVATE_TELEMETRY_KEY:-}" \
    --build-arg NEXT_PRIVATE_TELEMETRY_HOST="${NEXT_PRIVATE_TELEMETRY_HOST:-}" \
    -t "documenso-base" \
    "$MONOREPO_ROOT"

# Handle repository tagging
if [ ! -z "$DOCKER_REPOSITORY" ]; then
    echo "Using custom repository: $DOCKER_REPOSITORY"
    
    # Add tags for custom repository
    docker tag "documenso-base" "$DOCKER_REPOSITORY:latest"
    docker tag "documenso-base" "$DOCKER_REPOSITORY:$GIT_SHA"

    # Add version tag if available
    if [ ! -z "$APP_VERSION" ] && [ "$APP_VERSION" != "undefined" ]; then
        docker tag "documenso-base" "$DOCKER_REPOSITORY:$APP_VERSION"
    fi
else
    echo "Using default repositories: dockerhub and ghcr.io"
    
    # Add tags for both default repositories
    docker tag "documenso-base" "documenso/documenso:latest"
    docker tag "documenso-base" "documenso/documenso:$GIT_SHA"
    docker tag "documenso-base" "ghcr.io/documenso/documenso:latest"
    docker tag "documenso-base" "ghcr.io/documenso/documenso:$GIT_SHA"

    # Add version tags if available
    if [ ! -z "$APP_VERSION" ] && [ "$APP_VERSION" != "undefined" ]; then
        docker tag "documenso-base" "documenso/documenso:$APP_VERSION"
        docker tag "documenso-base" "ghcr.io/documenso/documenso:$APP_VERSION"
    fi
fi

# Remove the temporary base tag
docker rmi "documenso-base"
