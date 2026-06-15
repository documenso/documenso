#!/usr/bin/env bash
#
# Step 2 — Create application secrets in Secret Manager and grant the Cloud Run
# runtime service account the IAM it needs (read the secrets + connect to
# Cloud SQL). Safe to re-run: existing secret values are left untouched.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

ENC_KEY_SECRET="${SECRET_PREFIX}-enc-key"
ENC_SECONDARY_SECRET="${SECRET_PREFIX}-enc-secondary"
NEXTAUTH_SECRET_NAME="${SECRET_PREFIX}-nextauth"
CERT_SECRET="${SECRET_PREFIX}-signing-cert"
PASSPHRASE_SECRET="${SECRET_PREFIX}-signing-passphrase"
SMTP_PASSWORD_SECRET="${SECRET_PREFIX}-smtp-password"
DB_URL_SECRET="${SECRET_PREFIX}-db-url"

# Create a secret with a random 32-byte hex value only if it doesn't exist yet.
ensure_random_secret() {
  local name="$1"
  if secret_exists "$name"; then
    info "Secret '${name}' already exists, leaving as-is."
  else
    secret_put "$name" "$(openssl rand -hex 32)"
    info "Created secret '${name}'."
  fi
}

info "Creating encryption + auth secrets..."
ensure_random_secret "$ENC_KEY_SECRET"
ensure_random_secret "$ENC_SECONDARY_SECRET"
ensure_random_secret "$NEXTAUTH_SECRET_NAME"

# ─── Signing certificate ─────────────────────────────────────────────────────

if secret_exists "$CERT_SECRET"; then
  info "Signing certificate secret '${CERT_SECRET}' already exists, leaving as-is."
else
  info "Generating a self-signed signing certificate (CN=${SIGNING_CERT_CN})..."
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "$TMP/key.pem" -out "$TMP/cert.pem" \
    -subj "/CN=${SIGNING_CERT_CN}"
  openssl pkcs12 -export \
    -inkey "$TMP/key.pem" -in "$TMP/cert.pem" \
    -out "$TMP/cert.p12" -passout "pass:${SIGNING_PASSPHRASE:-}"
  gcloud_q secrets create "$CERT_SECRET" --data-file="$TMP/cert.p12" >/dev/null
  info "Stored self-signed certificate in secret '${CERT_SECRET}'."
  warn "This is a SELF-SIGNED cert — fine for testing. Replace it for production (see README.md)."
fi

# ─── Optional secrets ────────────────────────────────────────────────────────

if [[ -n "${SIGNING_PASSPHRASE:-}" ]]; then
  secret_put "$PASSPHRASE_SECRET" "$SIGNING_PASSPHRASE"
  info "Stored signing passphrase in secret '${PASSPHRASE_SECRET}'."
fi

if [[ -n "${SMTP_PASSWORD:-}" ]]; then
  secret_put "$SMTP_PASSWORD_SECRET" "$SMTP_PASSWORD"
  info "Stored SMTP password in secret '${SMTP_PASSWORD_SECRET}'."
fi

# ─── IAM ─────────────────────────────────────────────────────────────────────

SA="$(runtime_sa)"
info "Granting secret access + Cloud SQL client to runtime service account: ${SA}"

secrets_to_bind=(
  "$ENC_KEY_SECRET"
  "$ENC_SECONDARY_SECRET"
  "$NEXTAUTH_SECRET_NAME"
  "$CERT_SECRET"
  "$DB_URL_SECRET"
)
[[ -n "${SIGNING_PASSPHRASE:-}" ]] && secrets_to_bind+=("$PASSPHRASE_SECRET")
[[ -n "${SMTP_PASSWORD:-}" ]] && secrets_to_bind+=("$SMTP_PASSWORD_SECRET")

for s in "${secrets_to_bind[@]}"; do
  if secret_exists "$s"; then
    gcloud_q secrets add-iam-policy-binding "$s" \
      --member="serviceAccount:${SA}" \
      --role="roles/secretmanager.secretAccessor" >/dev/null
  else
    warn "Secret '${s}' not found — did you run 01-database.sh first? Skipping its IAM binding."
  fi
done

# Cloud Run needs this on the runtime SA to open the Cloud SQL socket.
gcloud_q projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}" \
  --role="roles/cloudsql.client" \
  --condition=None >/dev/null

info "Secrets and IAM complete."
