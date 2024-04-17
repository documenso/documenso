#!/usr/bin/env bash

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../")"

cd "$MONOREPO_ROOT"

npm ci

npm run db-migrate:dev

npm run dev
