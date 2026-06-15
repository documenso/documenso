#!/usr/bin/env bash
#
# Step 5 (OPTIONAL) — Run database migrations as a one-off Cloud Run Job.
#
# The service image already runs `prisma migrate deploy` on startup, so this is
# only useful if you want to harden the rollout: apply migrations once, here,
# before traffic shifts, rather than on every cold start. Uses the same image
# and the same Cloud SQL connection + DB secret as the service.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

CONNECTION_NAME="$(gcloud_q sql instances describe "$DB_INSTANCE" --format='value(connectionName)')"
JOB="${SERVICE}-migrate"

MIGRATE_CMD='cd /app/apps/remix && npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma'

common_flags=(
  --image="$IMAGE"
  --region="$REGION"
  --set-cloudsql-instances="$CONNECTION_NAME"
  --service-account="$(runtime_sa)"
  --set-secrets="NEXT_PRIVATE_DATABASE_URL=${SECRET_PREFIX}-db-url:latest,NEXT_PRIVATE_DIRECT_DATABASE_URL=${SECRET_PREFIX}-db-url:latest"
  --command=sh
  --args="-c,${MIGRATE_CMD}"
  --max-retries=1
  --task-timeout=600s
)

if gcloud_q run jobs describe "$JOB" --region="$REGION" >/dev/null 2>&1; then
  info "Updating migration job '${JOB}'..."
  gcloud_q run jobs update "$JOB" "${common_flags[@]}"
else
  info "Creating migration job '${JOB}'..."
  gcloud_q run jobs create "$JOB" "${common_flags[@]}"
fi

info "Executing migration job (streaming until complete)..."
gcloud_q run jobs execute "$JOB" --region="$REGION" --wait

info "Migrations applied."
