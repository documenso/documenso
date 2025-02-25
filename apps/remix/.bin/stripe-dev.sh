#!/usr/bin/env bash

# Set Error handling
set -eu

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
WEB_APP_DIR="$SCRIPT_DIR/.."

# Store the original directory
ORIGINAL_DIR=$(pwd)

# Set up trap to ensure we return to original directory
trap 'cd "$ORIGINAL_DIR"' EXIT

cd "$WEB_APP_DIR"

# Define env file paths
ENV_LOCAL_FILE="../../.env.local"

# Function to load environment variable from env files
load_env_var() {
  local var_name=$1
  local var_value=""

  if [ -f "$ENV_LOCAL_FILE" ]; then
    var_value=$(grep "^$var_name=" "$ENV_LOCAL_FILE" | cut -d '=' -f2)
  fi

  # Remove quotes if present
  var_value=$(echo "$var_value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")

  echo "$var_value"
}

NEXT_PUBLIC_FEATURE_BILLING_ENABLED=$(load_env_var "NEXT_PUBLIC_FEATURE_BILLING_ENABLED")

# Check if NEXT_PUBLIC_FEATURE_BILLING_ENABLED is equal to true
if [ "$NEXT_PUBLIC_FEATURE_BILLING_ENABLED" != "true" ]; then
  echo "[ERROR]: NEXT_PUBLIC_FEATURE_BILLING_ENABLED must be enabled."
  exit 1
fi

# 1. Load NEXT_PRIVATE_STRIPE_API_KEY from env files
NEXT_PRIVATE_STRIPE_API_KEY=$(load_env_var "NEXT_PRIVATE_STRIPE_API_KEY")

# Check if NEXT_PRIVATE_STRIPE_API_KEY exists
if [ -z "$NEXT_PRIVATE_STRIPE_API_KEY" ]; then
  echo "[ERROR]: NEXT_PRIVATE_STRIPE_API_KEY not found in environment files."
  echo "[ERROR]: Please make sure it's set in $ENV_LOCAL_FILE"
  exit 1
fi

# 2. Check if stripe CLI is installed
if ! command -v stripe &> /dev/null; then
  echo "[ERROR]: Stripe CLI is not installed or not in PATH."
  echo "[ERROR]: Please install the Stripe CLI: https://stripe.com/docs/stripe-cli"
  exit 1
fi

# 3. Check if NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET env key exists
NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET=$(load_env_var "NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET")

if [ -z "$NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET" ]; then
  echo "╔═════════════════════════════════════════════════════════════════════╗"
  echo "║                                                                     ║"
  echo "║  ! WARNING: NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET MISSING !            ║"
  echo "║                                                                     ║"
  echo "║  Copy the webhook signing secret which will appear in the terminal  ║"
  echo "║  soon into the env file.                                            ║"
  echo "║                                                                     ║"
  echo "║  The webhook secret will start with whsec_...                       ║"
  echo "║                                                                     ║"
  echo "╚═════════════════════════════════════════════════════════════════════╝"
fi

echo "[INFO]: Starting Stripe webhook listener..."
stripe listen --api-key "$NEXT_PRIVATE_STRIPE_API_KEY" --forward-to http://localhost:3000/api/stripe/webhook
