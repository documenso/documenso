#!/usr/bin/env bash
#
# Run the full deployment in order: prerequisites → database → secrets →
# build → deploy. Each step is idempotent and safe to re-run.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${DIR}/00-prerequisites.sh"
bash "${DIR}/01-database.sh"
bash "${DIR}/02-secrets.sh"
bash "${DIR}/03-build.sh"
bash "${DIR}/04-deploy.sh"

printf '\n\033[1;32m✓ Deployment finished.\033[0m\n'
