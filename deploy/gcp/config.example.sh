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
export REGION="us-central1"

# ─── Naming (sensible defaults — override only if you want) ──────────────────

export REPO="documenso"          # Artifact Registry repository
export SERVICE="documenso"       # Cloud Run service name
export DB_INSTANCE="documenso-db" # Cloud SQL instance name
export DB_NAME="documenso"        # Database name
export DB_USER="documenso"        # Database user
export DB_TIER="db-custom-1-3840" # Cloud SQL machine type (1 vCPU / 3.75 GB)

# Secrets are named "<SECRET_PREFIX>-enc-key", etc. Defaults to SERVICE.
# export SECRET_PREFIX="documenso"

# Optional: deploy under a dedicated runtime service account instead of the
# default Compute Engine SA. Leave unset to use the default.
# export RUNTIME_SA="documenso-run@PROJECT_ID.iam.gserviceaccount.com"

# ─── Public URL ──────────────────────────────────────────────────────────────

# Leave blank to use the auto-assigned Cloud Run URL (the deploy script will
# detect it and wire it in automatically). Set this to your custom domain if
# you've mapped one (recommended for production) e.g. https://app.keepcontracts.com
export WEBAPP_URL=""

# ─── Cloud Run sizing ────────────────────────────────────────────────────────

export RUN_MEMORY="2Gi"
export RUN_CPU="2"
# Keep at least 1 warm instance: the default in-process background-jobs provider
# ("local") only runs scheduled work while an instance is alive.
export RUN_MIN_INSTANCES="1"
export RUN_MAX_INSTANCES="10"
export RUN_CONCURRENCY="40"

# ─── Storage ─────────────────────────────────────────────────────────────────

# "database" stores uploaded documents in Postgres (simplest, keeps Cloud Run
# stateless). Use "s3" with a GCS bucket via its S3-compatible API for scale.
export UPLOAD_TRANSPORT="database"

# ─── Email / SMTP (required to actually send email) ──────────────────────────

# Leave SMTP_HOST blank to deploy without email wired up (the app will boot but
# outbound email will fail until you configure this and redeploy).
export SMTP_HOST=""
export SMTP_PORT="587"
export SMTP_USERNAME=""
export SMTP_PASSWORD=""   # stored in Secret Manager, never committed
export SMTP_FROM_NAME="KeepContracts"
export SMTP_FROM_ADDRESS="noreply@keepcontracts.com"

# ─── Document signing ────────────────────────────────────────────────────────

# A self-signed .p12 certificate is generated and stored in Secret Manager if
# one doesn't already exist. For production, replace the secret with a real
# cert or switch to Cloud KMS HSM signing (see README.md).
export SIGNING_PASSPHRASE=""
export SIGNING_CERT_CN="KeepContracts Self-Signed"
