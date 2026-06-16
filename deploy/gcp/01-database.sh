#!/usr/bin/env bash
#
# Step 1 — Provision Cloud SQL for PostgreSQL: instance, database and user.
# The generated connection string (with password) is stored directly in
# Secret Manager as "<prefix>-db-url" so the password is captured exactly once.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

DB_URL_SECRET="${SECRET_PREFIX}-db-url"

info "Ensuring Cloud SQL instance '${DB_INSTANCE}' exists (this can take several minutes)..."
if gcloud_q sql instances describe "$DB_INSTANCE" >/dev/null 2>&1; then
  info "Instance already exists, skipping."
else
  gcloud_q sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_15 \
    --tier="$DB_TIER" \
    --region="$REGION" \
    --storage-auto-increase
fi

info "Ensuring database '${DB_NAME}' exists..."
if ! gcloud_q sql databases describe "$DB_NAME" --instance="$DB_INSTANCE" >/dev/null 2>&1; then
  gcloud_q sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
fi

CONNECTION_NAME="$(gcloud_q sql instances describe "$DB_INSTANCE" --format='value(connectionName)')"
info "Cloud SQL connection name: ${CONNECTION_NAME}"

# Manage the user + password. We only (re)set the password when we also need to
# (re)write the connection-string secret, so the two never drift apart.
# Password uses only URL-safe alphanumerics to avoid any encoding pitfalls.
DB_PASSWORD=""
user_exists="$(gcloud_q sql users list --instance="$DB_INSTANCE" --format='value(name)' | grep -Fxc "$DB_USER" || true)"

if [[ "$user_exists" == "0" ]]; then
  info "Creating database user '${DB_USER}'..."
  DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9')"
  gcloud_q sql users create "$DB_USER" --instance="$DB_INSTANCE" --password="$DB_PASSWORD"
elif ! secret_exists "$DB_URL_SECRET"; then
  warn "DB user '${DB_USER}' exists but no '${DB_URL_SECRET}' secret was found — rotating its password to capture a fresh connection string."
  DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9')"
  gcloud_q sql users set-password "$DB_USER" --instance="$DB_INSTANCE" --password="$DB_PASSWORD"
else
  info "DB user and connection-string secret already exist — leaving the password untouched."
fi

if [[ -n "$DB_PASSWORD" ]]; then
  # Cloud Run connects over a unix socket at /cloudsql/<connection-name>.
  DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"
  secret_put "$DB_URL_SECRET" "$DB_URL"
  info "Stored connection string in secret '${DB_URL_SECRET}'."
fi

info "Database setup complete."
