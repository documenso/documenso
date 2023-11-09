#!/usr/bin/env bash

# Exit on error.
set -eo pipefail

# Get the directory of this script, regardless of where it is called from.
SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"


function log() {
  echo "[VercelBuild]: $1"
}

function build_webapp() {
  log "Building webapp for $VERCEL_ENV"

  remap_webapp_env
  remap_database_integration

  npm run prisma:generate --workspace=@documenso/prisma
  npm run prisma:migrate-deploy --workspace=@documenso/prisma

  if [[ "$VERCEL_ENV" != "production" ]]; then
    log "Seeding database for $VERCEL_ENV"

    npm run prisma:seed --workspace=@documenso/prisma
  fi

  npm run build -- --filter @documenso/web
}

function remap_webapp_env() {
  if [[ "$VERCEL_ENV" != "production" ]]; then
    log "Remapping webapp environment variables for $VERCEL_ENV"

    export NEXTAUTH_URL="https://$VERCEL_URL"
    export NEXT_PUBLIC_WEBAPP_URL="https://$VERCEL_URL"
  fi
}

function build_marketing() {
  log "Building marketing for $VERCEL_ENV"

  remap_marketing_env
  remap_database_integration

  npm run prisma:generate --workspace=@documenso/prisma
  npm run build -- --filter @documenso/marketing
}

function remap_marketing_env() {
  if [[ "$VERCEL_ENV" != "production" ]]; then
    log "Remapping marketing environment variables for $VERCEL_ENV"

    export NEXT_PUBLIC_MARKETING_URL="https://$VERCEL_URL"
  fi
}

function remap_database_integration() {
  log "Remapping Supabase integration for $VERCEL_ENV"

  if [[ ! -z "$POSTGRES_URL" ]]; then
    export NEXT_PRIVATE_DATABASE_URL="$POSTGRES_URL"
    export NEXT_PRIVATE_DIRECT_DATABASE_URL="$POSTGRES_URL"
  fi

  if [[ ! -z "$DATABASE_URL" ]]; then
    export NEXT_PRIVATE_DATABASE_URL="$DATABASE_URL"
    export NEXT_PRIVATE_DIRECT_DATABASE_URL="$DATABASE_URL"
  fi

  if [[ ! -z "$POSTGRES_URL_NON_POOLING" ]]; then
    export NEXT_PRIVATE_DATABASE_URL="$POSTGRES_URL?pgbouncer=true"
    export NEXT_PRIVATE_DIRECT_DATABASE_URL="$POSTGRES_URL_NON_POOLING"
  fi

  if [[ "$NEXT_PRIVATE_DATABASE_URL" == *"neon.tech"* ]]; then
    log "Remapping for Neon integration"

    PROJECT_ID="$(echo "$PGHOST" | cut -d'.' -f1)"
    PGBOUNCER_HOST="$(echo "$PGHOST" | sed "s/${PROJECT_ID}/${PROJECT_ID}-pooler/")"

    export NEXT_PRIVATE_DATABASE_URL="postgres://${PGUSER}:${PGPASSWORD}@${PGBOUNCER_HOST}/${PGDATABASE}?pgbouncer=true"
  fi
}

# Navigate to the root of the project.
cd "$SCRIPT_DIR/.."

# Check if the script is running on Vercel.
if [[ -z "$VERCEL" ]]; then
  log "ERROR - This script must be run as part of the Vercel build process."
  exit 1
fi

case "$DEPLOYMENT_TARGET" in
  "webapp")
    build_webapp
    ;;
  "marketing")
    build_marketing
    ;;
  *)
    log "ERROR - Missing or invalid DEPLOYMENT_TARGET environment variable."
    log "ERROR - DEPLOYMENT_TARGET must be either 'webapp' or 'marketing'."
    exit 1
    ;;
esac
