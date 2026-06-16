#!/usr/bin/env bash
#
# Step 3 — Build the container image with Cloud Build (using docker/Dockerfile)
# and push it to Artifact Registry. No local Docker required.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

info "Submitting build to Cloud Build..."
info "  Image:   ${IMAGE}"
info "  Context: ${REPO_ROOT}"

gcloud_q builds submit "$REPO_ROOT" \
  --config="${REPO_ROOT}/cloudbuild.yaml" \
  --substitutions=_IMAGE="$IMAGE"

info "Build complete and pushed to Artifact Registry."
