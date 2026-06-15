#!/usr/bin/env bash
#
# DANGER — Tear down everything this toolkit created: the Cloud Run service,
# the optional migration job, the Cloud SQL instance (and ALL its data), the
# secrets, and the Artifact Registry repository. Requires typing the project
# id to confirm.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

warn "This will PERMANENTLY DELETE the following in project '${PROJECT_ID}':"
echo "  • Cloud Run service:      ${SERVICE}"
echo "  • Cloud Run job:          ${SERVICE}-migrate (if present)"
echo "  • Cloud SQL instance:     ${DB_INSTANCE}  (INCLUDING ALL DATA)"
echo "  • Artifact Registry repo: ${REPO}"
echo "  • Secrets:                ${SECRET_PREFIX}-*"
echo
read -r -p "Type the project id (${PROJECT_ID}) to confirm: " confirm
[[ "$confirm" == "$PROJECT_ID" ]] || die "Confirmation did not match. Aborting."

del() { info "Deleting: $*"; "$@" || warn "  (already gone or failed, continuing)"; }

del gcloud_q run services delete "$SERVICE" --region="$REGION" --quiet
del gcloud_q run jobs delete "${SERVICE}-migrate" --region="$REGION" --quiet
del gcloud_q sql instances delete "$DB_INSTANCE" --quiet
del gcloud_q artifacts repositories delete "$REPO" --location="$REGION" --quiet

for s in enc-key enc-secondary nextauth db-url signing-cert signing-passphrase smtp-password; do
  del gcloud_q secrets delete "${SECRET_PREFIX}-${s}" --quiet
done

info "Teardown complete."
