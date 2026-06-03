# AWS Production Cutover Plan: Deploy PSD401 Fork

**Goal:** Replace the upstream `documenso/documenso:latest` Docker image on AWS production with a custom-built image of the PSD401 fork (`feature/psd401-unlock-enterprise`), without losing any data.

**Context:** The fork has been validated on the on-prem dev server (10.0.70.60) using a copy of the production database. All features — team merge, DOCX upload, Google SSO, billing bypass — work correctly against real prod data.

---

## Current AWS Production State

| Component | Image | Volume | Size |
|-----------|-------|--------|------|
| Caddy | `caddy:2-alpine` | `caddy_data`, `caddy_config` | ~130 KB |
| PostgreSQL | `postgres:17-alpine` | `pgdata` | 883 MB (451 MB documenso, 359 MB n8n) |
| Documenso | `documenso/documenso:latest` | cert.p12 bind mount | — |
| n8n | `n8nio/n8n:latest` | `n8n_data` | 73 MB |

**Stack location:** `/home/ubuntu/psd401-stack/docker-compose.yml`
**Backups:** `backup.sh` dumps to S3 bucket `psd401-documenso-backups` daily
**Upload storage:** `NEXT_PUBLIC_UPLOAD_TRANSPORT: database` — all uploaded documents are stored as BLOBs in Postgres, not on disk
**SSH:** `ssh -i ~/.ssh/psd401-documenso-n8n.pem ubuntu@documenso.psd401.net`

### Key Environment Variables (from docker-compose.yml)

> **Secrets are on the server only.** View with: `ssh -i ~/.ssh/psd401-documenso-n8n.pem ubuntu@documenso.psd401.net 'cat /home/ubuntu/psd401-stack/docker-compose.yml'`

```
NEXT_PRIVATE_DATABASE_URL: <on server — do not commit>
NEXTAUTH_SECRET: <on server — do not commit>
NEXT_PRIVATE_ENCRYPTION_KEY: <on server — do not commit>
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: <on server — do not commit>
NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH: /opt/documenso/cert.p12
NEXT_PRIVATE_SIGNING_PASSPHRASE: <on server — must be rotated from upstream default>
NEXT_PUBLIC_UPLOAD_TRANSPORT: database
NEXT_PUBLIC_WEBAPP_URL: https://documenso.psd401.net
NEXT_PRIVATE_GOOGLE_CLIENT_ID: <on server — do not commit>
NEXT_PRIVATE_GOOGLE_CLIENT_SECRET: <on server — do not commit>
NEXT_PUBLIC_DISABLE_SIGNUP: false
NEXT_PUBLIC_FEATURE_BILLING_ENABLED: true
DOCUMENSO_DISABLE_TELEMETRY: true
license.documenso.com → 127.0.0.1 (via extra_hosts)
```

### Pending Changes for Fork Deployment

1. **`NEXT_PUBLIC_FEATURE_BILLING_ENABLED`** must change from `"true"` to `"false"` — fork strips billing, and leaving this true causes UI issues (subscription status checks zero out limits)
2. **`NEXT_PUBLIC_DISABLE_SIGNUP`** must change from `"false"` to `"true"` — prevents external users from registering with email/password and auto-joining the PSD401 org via the DB trigger
3. **Docker image** changes from `documenso/documenso:latest` to the custom-built fork image
4. **2 pending Prisma migrations** need to be applied:
   - `20260401000000_add_reminder_settings` — adds Reminder table and related columns (additive, backward-compatible)
   - `20260408052212_add_set_null_for_audit_log_foreign_key` — changes audit log FK to SET NULL on delete (backward-compatible)
5. **Org ID alignment** — `create-user.ts` hardcodes `PSD401_ORG_ID = 'org_psd401'` but the AWS prod database uses `org_psd401district`. Update the code constant to `'org_psd401district'` and `PSD401_MEMBER_GROUP_ID` to `'org_group_psd401_member'` (verify this group ID matches prod). Rebuild the image after this change.
6. **SMTP config** — currently uses `smtp-relay.gmail.com`. On-prem uses PMG relay. Decide whether to keep Gmail relay for prod or switch to PMG. (Gmail is simpler since it doesn't depend on VPN.)
7. **Signing passphrase** — `NEXT_PRIVATE_SIGNING_PASSPHRASE` is the upstream default `documenso-demo`. Generate a strong replacement, re-export cert.p12, and update docker-compose.yml.

---

## Prerequisites (resolve before scheduling cutover)

These must be done **before cutover day**, not during:

- [x] **Dockerfile** — `docker/Dockerfile` builds successfully. Image: `ghcr.io/psd401/documenso:latest` (2.6GB, commit 9cdc0b017)
- [x] **Org ID fix** — `PSD401_ORG_ID` updated to `'org_psd401district'`, `PSD401_MEMBER_GROUP_ID` confirmed as `'org_group_psd401_member'`. Baked into image.
- [x] **Image build** — built locally, pushed to GHCR at `ghcr.io/psd401/documenso:latest`
- [ ] **Image pull test** — verify EC2 can pull: `sudo docker pull ghcr.io/psd401/documenso:latest` (may need GHCR auth on EC2)
- [x] **Schema path** — confirmed: `/app/packages/prisma/schema.prisma` (from Dockerfile line 130)
- [x] **Dev sign-in button** — verified: dev button hidden when `NEXT_PRIVATE_GOOGLE_CLIENT_ID` is set. Only Google SSO shows.
- [ ] **Signing passphrase rotation** — still using upstream default. Can rotate post-cutover.
- [x] **On-prem validation** — all features tested against prod data copy on 10.0.70.60
- [x] **Local Docker test** — image boots, migrations apply, sign-in page shows correct branding, billing disabled, signup disabled, no errors

---

## Phase 1: Build the Fork Image

**Option A: Build on EC2 (simple, slow)**
- Clone the repo on the EC2 instance, checkout `feature/psd401-unlock-enterprise`, build with Docker
- Pro: No registry needed, no image transfer
- Con: EC2 needs build deps (node, bun), build takes ~10 min, uses disk space

**Option B: Build locally and push to GitHub Container Registry (recommended)**
- Build the image on a dev machine or CI
- Push to `ghcr.io/psd401/documenso:psd401-fork`
- EC2 pulls from the registry
- Pro: Fast on EC2 (just a pull), reusable for future deploys
- Con: Needs GHCR auth setup on EC2

**Option C: Build on-prem and transfer via docker save/load**
- Build on 10.0.70.60, `docker save | gzip > image.tar.gz`, scp to EC2, `docker load`
- Pro: No registry, proven build environment
- Con: Large file transfer over VPN

---

## Phase 2: Pre-Cutover Backup

Run on AWS **before any changes**:

```bash
ssh -i ~/.ssh/psd401-documenso-n8n.pem ubuntu@documenso.psd401.net
cd /home/ubuntu/psd401-stack

# 1. Run the existing backup script (dumps to S3)
sudo bash backup.sh

# 2. Take an additional local backup for fast rollback
BACKUP="/home/ubuntu/pre-cutover-$(date +%Y%m%d-%H%M%S).pgdump"
sudo docker exec psd401-stack-postgres-1 pg_dump -U documenso -d documenso -Fc > "$BACKUP"
echo "Backup saved to: $BACKUP"

# 3. Save the current docker-compose.yml and Caddyfile
cp docker-compose.yml docker-compose.yml.pre-cutover
cp Caddyfile Caddyfile.pre-cutover

# 4. Capture baseline row counts
sudo docker exec psd401-stack-postgres-1 psql -U documenso -d documenso -c "SELECT 'users' as tbl, count(*) FROM \"User\" UNION ALL SELECT 'teams', count(*) FROM \"Team\" UNION ALL SELECT 'envelopes', count(*) FROM \"Envelope\" UNION ALL SELECT 'orgs', count(*) FROM \"Organisation\";" | tee /home/ubuntu/pre-cutover-counts.txt
```

**Verify backup integrity:**
```bash
sudo docker exec -i psd401-stack-postgres-1 pg_restore --list < "$BACKUP" | tail -5
# Should show table entries, not errors

ls -lh "$BACKUP"
# Should be >200MB (prod DB is ~451MB, compressed ~272MB)

ls -la docker-compose.yml.pre-cutover Caddyfile.pre-cutover
# Both must exist before proceeding
```

---

## Phase 3: Freeze User Access

```bash
cd /home/ubuntu/psd401-stack

# Back up current Caddyfile (should already exist from Phase 2)
ls Caddyfile.pre-cutover || cp Caddyfile Caddyfile.pre-cutover

# Replace with maintenance page
cat > Caddyfile << 'CADDYEOF'
documenso.psd401.net {
    header Content-Type "text/html; charset=utf-8"
    respond <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PSD Document Signing — Maintenance</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); max-width: 480px; width: 100%; padding: 2.5rem; text-align: center; }
  .icon { font-size: 3rem; margin-bottom: 1rem; }
  h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: .75rem; }
  p { color: #475569; line-height: 1.6; margin-bottom: .5rem; }
  .time { display: inline-block; margin-top: 1rem; background: #f1f5f9; border-radius: 6px; padding: .5rem 1rem; font-weight: 500; color: #334155; }
  .footer { margin-top: 1.5rem; font-size: .85rem; color: #94a3b8; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">&#128736;</div>
  <h1>Scheduled Maintenance</h1>
  <p>PSD Document Signing is currently being updated with new features and security improvements.</p>
  <div class="time">Expected back online by 12:30 PM</div>
  <p class="footer">If you need immediate assistance, contact the Technology Services Department.</p>
</div>
</body>
</html>
HTML 503
}

n8n.psd401.net {
    reverse_proxy n8n:5678
}
CADDYEOF

# Reload Caddy (no restart needed)
sudo docker exec psd401-stack-caddy-1 caddy reload --config /etc/caddy/Caddyfile

# Verify maintenance page is active
curl -s -o /dev/null -w "%{http_code}" https://documenso.psd401.net
# MUST return 503. If not, STOP and investigate before proceeding.
```

---

## Phase 4: Stop Documenso and Apply Changes

```bash
cd /home/ubuntu/psd401-stack

# 1. Stop only Documenso (Postgres stays up for migrations)
sudo docker compose stop documenso

# 2. Update docker-compose.yml — change image and feature flags
#    Replace ghcr.io/psd401/documenso:latest with the actual image name from Phase 1
sed -i 's|image: documenso/documenso:latest|image: ghcr.io/psd401/documenso:latest|' docker-compose.yml
sed -i 's|NEXT_PUBLIC_FEATURE_BILLING_ENABLED: "true"|NEXT_PUBLIC_FEATURE_BILLING_ENABLED: "false"|' docker-compose.yml
sed -i 's|NEXT_PUBLIC_DISABLE_SIGNUP: "false"|NEXT_PUBLIC_DISABLE_SIGNUP: "true"|' docker-compose.yml

# 3. Verify the edits are correct
grep -E 'image:.*documenso|BILLING_ENABLED|DISABLE_SIGNUP' docker-compose.yml
# Should show the fork image, "false" for billing, "true" for disable-signup

# 4. Log Docker into GHCR (needed to pull from psd401 private registry)
#    Generate a PAT at https://github.com/settings/tokens with read:packages scope
echo "<GHCR_PAT>" | sudo docker login ghcr.io -u psd401 --password-stdin

# 5. Pull the new image
sudo docker compose pull documenso

# 6. Verify the correct image was pulled
sudo docker compose images documenso
# Image tag must match ghcr.io/psd401/documenso:latest, not documenso/documenso:latest

# 7. Run Prisma migrations BEFORE starting the app
#    Use a one-shot container so the app doesn't race with migrations
sudo docker compose run --rm documenso npx prisma migrate deploy --schema /app/packages/prisma/schema.prisma
# MUST output "All migrations have been successfully applied."
# If it fails, go to Rollback Plan. Do NOT proceed.

# 8. Verify migrations applied
sudo docker exec psd401-stack-postgres-1 psql -U documenso -d documenso -c "SELECT migration_name, finished_at FROM \"_prisma_migrations\" ORDER BY finished_at DESC LIMIT 3;"
# Should show both 20260401 and 20260408 migrations with finished_at timestamps

# 9. Lock out external (non-psd401) user accounts
sudo docker exec psd401-stack-postgres-1 psql -U documenso -d documenso -c "UPDATE \"User\" SET password = NULL WHERE email IN ('swanpen4@comcast.net', 'stefanie.santie@gmail.com', 'kortni.anderson97@gmail.com', 'melanie.niebuhr26@gmail.com', 'mariabrowning@yahoo.com', 'jlentrichia@gmail.com', 'mandadaw@hotmail.com');"
# Should output: UPDATE 7

# 10. Start the new container
sudo docker compose up -d documenso

# 11. Wait for the app to be ready
sleep 10
sudo docker compose logs documenso --tail=5
# Should show startup messages, no crash loops or errors
```

---

## Phase 5: Verify Before Unfreeze

**Database verification:**
```bash
cd /home/ubuntu/psd401-stack

# Row counts should match pre-cutover baseline
sudo docker exec psd401-stack-postgres-1 psql -U documenso -d documenso -c "SELECT 'users' as tbl, count(*) FROM \"User\" UNION ALL SELECT 'teams', count(*) FROM \"Team\" UNION ALL SELECT 'envelopes', count(*) FROM \"Envelope\" UNION ALL SELECT 'orgs', count(*) FROM \"Organisation\";"

cat /home/ubuntu/pre-cutover-counts.txt
# Compare — counts must match
```

**Application verification:**
```bash
# Check container is healthy and not crash-looping
sudo docker compose ps documenso
# Status should be "Up" with no "(unhealthy)" flag

# Check the app responds
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200 or 302 (redirect to sign-in)
```

**Functional verification (with Caddy still in maintenance mode):**

SSH tunnel from local machine:
```bash
ssh -L 3001:localhost:3000 -N -i ~/.ssh/psd401-documenso-n8n.pem ubuntu@documenso.psd401.net &
```

Then open `http://localhost:3001` in browser and verify:
- [ ] Sign-in page shows **only** Google SSO button (no dev sign-in)
- [ ] Sign in with Google SSO works
- [ ] Documents are visible and accessible
- [ ] Org settings → Teams page works, team merge feature available
- [ ] No billing/subscription UI visible (no "Billing" tab or upgrade prompts)
- [ ] Upload a test DOCX file — verify it converts to PDF
- [ ] Envelope limits show as unlimited (not capped by subscription)
- [ ] Browser console has no errors related to billing or subscription

**If any check fails, go to Rollback Plan. Do NOT proceed to Phase 6.**

---

## Phase 6: Unfreeze — Go Live

```bash
cd /home/ubuntu/psd401-stack

# Restore the original Caddyfile (with reverse_proxy, not maintenance page)
cp Caddyfile.pre-cutover Caddyfile

# Reload Caddy
sudo docker exec psd401-stack-caddy-1 caddy reload --config /etc/caddy/Caddyfile

# Verify the app is accessible
curl -s -o /dev/null -w "%{http_code}" https://documenso.psd401.net
# Should return 200 or 302, NOT 503
```

**Verify:** Open `https://documenso.psd401.net` — should load the app with the fork's branding.

---

## Rollback Plan

If anything goes wrong after Phase 4:

### Quick Rollback (< 2 minutes)

```bash
cd /home/ubuntu/psd401-stack

# 1. Restore the pre-cutover docker-compose.yml
cp docker-compose.yml.pre-cutover docker-compose.yml

# 2. Restart Documenso with the old upstream image
sudo docker compose up -d documenso

# 3. Restore the Caddyfile and reload
cp Caddyfile.pre-cutover Caddyfile
sudo docker exec psd401-stack-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

The 2 applied migrations are additive (new table, SET NULL on FK), so the upstream image will still work against the migrated schema. No data loss.

### Full Rollback (if DB is corrupted)

```bash
cd /home/ubuntu/psd401-stack

# 1. Stop Documenso
sudo docker compose stop documenso

# 2. Terminate all connections to the documenso database
sudo docker exec psd401-stack-postgres-1 psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='documenso' AND pid <> pg_backend_pid();"

# 3. Restore the database from pre-cutover backup (use exact filename from Phase 2)
sudo docker exec -i psd401-stack-postgres-1 pg_restore -U documenso -d documenso --clean --if-exists --no-owner < "$BACKUP"
# If $BACKUP is not set, find the file:
# ls -la /home/ubuntu/pre-cutover-*.pgdump

# 4. Restore docker-compose.yml and restart
cp docker-compose.yml.pre-cutover docker-compose.yml
sudo docker compose up -d documenso

# 5. Restore Caddyfile
cp Caddyfile.pre-cutover Caddyfile
sudo docker exec psd401-stack-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

---

## Open Questions

1. **Image build strategy:** Which option (A/B/C) for getting the fork image onto EC2? Recommendation is Option B (GHCR) for repeatability.
2. **SMTP relay:** Keep Gmail relay (`smtp-relay.gmail.com`) or switch to PMG (`vmnocapsmtpmr01.psd401.net:25`)? Gmail is simpler since it doesn't depend on VPN uptime.
3. **n8n:** Leave as-is on `n8nio/n8n:latest`? It shares the Postgres instance but has its own database. No changes needed for n8n during this cutover.
4. **serv_automation token:** Currently scoped to personal team (team 5), not TSD (team 14). n8n workflows may hit 5-doc limit. Fix token scoping before or after cutover.
5. **Timing:** Schedule for low-usage window — early morning or weekend.

---

## Estimated Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| Prerequisites | days before | Dockerfile, org ID fix, image build, passphrase rotation |
| Phase 2: Backup | 5 min | Already scripted |
| Phase 3: Freeze | 2 min | Caddy reload + verify |
| Phase 4: Apply changes | 10 min | Stop, edit, pull, verify, migrate, start |
| Phase 5: Verify | 15 min | Thorough functional testing |
| Phase 6: Go live | 2 min | Caddy reload + verify |
| **Total downtime** | **~30 min** | Phases 3-6 |
