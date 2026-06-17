# shellcheck shell=bash
#
# Copy this file to `config.sh` and edit the values below, then run the
# numbered scripts (or ./deploy-all.sh). `config.sh` is gitignored so your
# project-specific values and secrets never get committed.
#
#   cp config.example.sh config.sh
#   $EDITOR config.sh
#   ./deploy-all.sh

# ─── Required ────────────────────────────────────────────────────────────────

# Your Google Cloud project ID.
export PROJECT_ID=""

# Region for Cloud Run, Cloud SQL and Artifact Registry.
export REGION="us-west1"

# ─── Naming (sensible defaults — override only if you want) ──────────────────

export REPO="keepcontracts"
export SERVICE="keepcontracts"
export DB_INSTANCE="keepcontracts-db"
export DB_NAME="keepcontracts"
export DB_USER="keepcontracts"
export DB_TIER="db-custom-1-3840"

# Secrets are named "<SECRET_PREFIX>-enc-key", etc. Defaults to SERVICE.
# export SECRET_PREFIX="keepcontracts"

# Optional: deploy under a dedicated runtime service account instead of the
# default Compute Engine SA. Leave unset to use the default.
# export RUNTIME_SA="keepcontracts-run@PROJECT_ID.iam.gserviceaccount.com"

# ─── Public URL ──────────────────────────────────────────────────────────────

# Leave blank to use the auto-assigned Cloud Run URL.
export WEBAPP_URL="https://keepcontracts.com"

# ─── Cloud Run sizing ────────────────────────────────────────────────────────

export RUN_MEMORY="2Gi"
export RUN_CPU="2"
# Keep at least 1 warm instance: the default in-process background-jobs provider
# ("local") only runs scheduled work while an instance is alive.
export RUN_MIN_INSTANCES="1"
export RUN_MAX_INSTANCES="10"
export RUN_CONCURRENCY="40"

# ─── Storage ─────────────────────────────────────────────────────────────────

export UPLOAD_TRANSPORT="database"

# ─── Email / SMTP (required to actually send email) ──────────────────────────

# Resend SMTP settings. Get your API key from resend.com.
# SMTP_PASSWORD is your Resend API key (re_...).
export SMTP_HOST="smtp.resend.com"
export SMTP_PORT="465"
export SMTP_USERNAME="resend"
export SMTP_PASSWORD=""
export SMTP_FROM_NAME="KeepContracts"
export SMTP_FROM_ADDRESS="sign@mail.keepcontracts.com"

# ─── Document signing ────────────────────────────────────────────────────────

# A self-signed .p12 certificate is generated and stored in Secret Manager if
# one doesn't already exist. For production, replace the secret with a real
# cert or switch to Cloud KMS HSM signing (see README.md).
export SIGNING_PASSPHRASE=""
export SIGNING_CERT_CN="KeepContracts Signing Certificate"