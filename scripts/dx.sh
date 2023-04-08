#!/usr/bin/env bash

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../")"

# Check if docker is installed
if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Please install Docker and try again."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose >/dev/null 2>&1; then
    echo "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Check if we have a .env file
if [ ! -f "$MONOREPO_ROOT/.env" ]; then
    echo "No .env file found. Please create one and try again."
    echo "See .env.example for an example."
    exit 1
fi

# Change to the monorepo root directory
pushd "$MONOREPO_ROOT" >/dev/null

# On failure popd back to the original directory
trap "popd >/dev/null" EXIT

docker-compose -f "$MONOREPO_ROOT/docker/compose-without-app.yml" up -d

# Install dependencies
npm ci

# Migrate the database
npm run db-migrate:dev

echo "All done! You can now start the app with: npm run dev"

# Return to the original directory
popd >/dev/null
