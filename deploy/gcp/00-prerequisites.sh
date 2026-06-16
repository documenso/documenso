#!/usr/bin/env bash
#
# Step 0 — Enable the required Google Cloud APIs and create the Artifact
# Registry repository that will hold the container image.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

info "Enabling required Google Cloud APIs (this can take a minute)..."
gcloud_q services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com

info "Ensuring Artifact Registry repository '${REPO}' exists in ${REGION}..."
if gcloud_q artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1; then
  info "Repository already exists, skipping."
else
  gcloud_q artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Documenso container images"
fi

info "Prerequisites complete."
