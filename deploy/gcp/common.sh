# shellcheck shell=bash
#
# Shared helpers and config loading for the GCP deployment scripts.
# Sourced by every numbered script — not meant to be run directly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ─── Load config ─────────────────────────────────────────────────────────────

if [[ -f "${SCRIPT_DIR}/config.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/config.sh"
else
  echo "ERROR: ${SCRIPT_DIR}/config.sh not found." >&2
  echo "       Copy config.example.sh to config.sh and edit it first:" >&2
  echo "         cp ${SCRIPT_DIR}/config.example.sh ${SCRIPT_DIR}/config.sh" >&2
  exit 1
fi

: "${PROJECT_ID:?Set PROJECT_ID in config.sh}"
: "${REGION:?Set REGION in config.sh}"

# Defaults for anything the user may have trimmed from their config.sh.
: "${REPO:=keepcontracts}"
: "${SERVICE:=keepcontracts}"
: "${DB_INSTANCE:=keepcontracts-db}"
: "${DB_NAME:=keepcontracts}"
: "${DB_USER:=keepcontracts}"
: "${DB_TIER:=db-custom-1-3840}"
: "${SECRET_PREFIX:=$SERVICE}"
: "${UPLOAD_TRANSPORT:=database}"
: "${RUN_MEMORY:=2Gi}"
: "${RUN_CPU:=2}"
: "${RUN_MIN_INSTANCES:=1}"
: "${RUN_MAX_INSTANCES:=10}"
: "${RUN_CONCURRENCY:=40}"
: "${SMTP_PORT:=587}"
: "${SMTP_FROM_NAME:=KeepContracts}"
: "${SIGNING_CERT_CN:=KeepContracts Self-Signed}"

# Derived values
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:latest"

# ─── Logging ─────────────────────────────────────────────────────────────────

info() { printf '\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ─── Helpers ─────────────────────────────────────────────────────────────────

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"; }

# Run gcloud always scoped to the configured project.
gcloud_q() { gcloud --project="${PROJECT_ID}" "$@"; }

# secret_exists NAME
secret_exists() { gcloud_q secrets describe "$1" >/dev/null 2>&1; }

# secret_put NAME VALUE  — create the secret if missing, then add a new version.
secret_put() {
  local name="$1" value="$2"
  if secret_exists "$name"; then
    printf '%s' "$value" | gcloud_q secrets versions add "$name" --data-file=- >/dev/null
  else
    printf '%s' "$value" | gcloud_q secrets create "$name" --data-file=- >/dev/null
  fi
}

# The runtime service account Cloud Run uses (default Compute Engine SA unless
# RUNTIME_SA is set in config.sh).
runtime_sa() {
  if [[ -n "${RUNTIME_SA:-}" ]]; then
    printf '%s' "$RUNTIME_SA"
  else
    local num
    num="$(gcloud_q projects describe "$PROJECT_ID" --format='value(projectNumber)')"
    printf '%s-compute@developer.gserviceaccount.com' "$num"
  fi
}

require_cmd gcloud
require_cmd openssl
