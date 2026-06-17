#!/usr/bin/env bash
#
# Step 4 — Deploy (or update) the Cloud Run service: wire up the Cloud SQL
# connection, secrets and environment, then resolve the public URL.
#
# Note: the container runs `prisma migrate deploy` on startup (see
# docker/start.sh), so deploying a new image also applies pending migrations.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

CONNECTION_NAME="$(gcloud_q sql instances describe "$DB_INSTANCE" --format='value(connectionName)')"

# ─── Environment variables ───────────────────────────────────────────────────
# Joined with '|' because some values (email addresses) contain commas/@; '|'
# never appears in our values, so it's a safe gcloud delimiter.

env_kv=(
  "NEXT_PUBLIC_UPLOAD_TRANSPORT=${UPLOAD_TRANSPORT}"
  "NEXT_PRIVATE_SIGNING_TRANSPORT=local"
  "NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH=/opt/documenso/cert.p12"
  "NEXT_PUBLIC_DISABLE_SIGNUP=${DISABLE_SIGNUP:-true}"
)

if [[ -n "${SMTP_HOST:-}" ]]; then
  env_kv+=(
    "NEXT_PRIVATE_SMTP_TRANSPORT=smtp-auth"
    "NEXT_PRIVATE_SMTP_HOST=${SMTP_HOST}"
    "NEXT_PRIVATE_SMTP_PORT=${SMTP_PORT}"
    "NEXT_PRIVATE_SMTP_USERNAME=${SMTP_USERNAME:-}"
    "NEXT_PRIVATE_SMTP_FROM_NAME=${SMTP_FROM_NAME}"
    "NEXT_PRIVATE_SMTP_FROM_ADDRESS=${SMTP_FROM_ADDRESS:-}"
  )
else
  warn "SMTP_HOST is not set — deploying without email. Outbound email will fail until configured."
fi

if [[ -n "${WEBAPP_URL:-}" ]]; then
  env_kv+=("NEXT_PUBLIC_WEBAPP_URL=${WEBAPP_URL}")
fi

env_str="$(IFS='|'; printf '%s' "${env_kv[*]}")"

# ─── Secrets ─────────────────────────────────────────────────────────────────

secret_kv=(
  "NEXT_PRIVATE_ENCRYPTION_KEY=${SECRET_PREFIX}-enc-key:latest"
  "NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=${SECRET_PREFIX}-enc-secondary:latest"
  "NEXTAUTH_SECRET=${SECRET_PREFIX}-nextauth:latest"
  "NEXT_PRIVATE_DATABASE_URL=${SECRET_PREFIX}-db-url:latest"
  "NEXT_PRIVATE_DIRECT_DATABASE_URL=${SECRET_PREFIX}-db-url:latest"
  # Mounted as a file at the path the app reads the signing cert from.
  "/opt/documenso/cert.p12=${SECRET_PREFIX}-signing-cert:latest"
)
[[ -n "${SMTP_PASSWORD:-}" ]] && secret_kv+=("NEXT_PRIVATE_SMTP_PASSWORD=${SECRET_PREFIX}-smtp-password:latest")
[[ -n "${SIGNING_PASSPHRASE:-}" ]] && secret_kv+=("NEXT_PRIVATE_SIGNING_PASSPHRASE=${SECRET_PREFIX}-signing-passphrase:latest")

secret_str="$(IFS=','; printf '%s' "${secret_kv[*]}")"

# ─── Deploy ──────────────────────────────────────────────────────────────────

info "Deploying service '${SERVICE}' to Cloud Run in ${REGION}..."
gcloud_q run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --no-invoker-iam-check \
  --add-cloudsql-instances="$CONNECTION_NAME" \
  --service-account="$(runtime_sa)" \
  --memory="$RUN_MEMORY" \
  --cpu="$RUN_CPU" \
  --min-instances="$RUN_MIN_INSTANCES" \
  --max-instances="$RUN_MAX_INSTANCES" \
  --no-cpu-throttling \
  --concurrency="$RUN_CONCURRENCY" \
  --timeout=300 \
  --network=default \
  --subnet=default \
  --vpc-egress=private-ranges-only \
  --set-env-vars="^|^${env_str}" \
  --set-secrets="$secret_str"

URL="$(gcloud_q run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"

# If the user didn't pin a custom domain, wire the auto-assigned URL back in so
# absolute links / emails resolve correctly.
if [[ -z "${WEBAPP_URL:-}" ]]; then
  info "Setting NEXT_PUBLIC_WEBAPP_URL=${URL} and redeploying a new revision..."
  gcloud_q run services update "$SERVICE" --region="$REGION" \
    --update-env-vars="NEXT_PUBLIC_WEBAPP_URL=${URL}"
fi

info "Deployed!"
info "  Service URL:  ${URL}"
info "  Health check: ${URL}/api/health"
