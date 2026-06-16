# Deploying to Google Cloud (Cloud Run)

This directory contains a small, idempotent toolkit for deploying this app to
Google Cloud using **Cloud Run + Cloud SQL (PostgreSQL) + Artifact Registry +
Secret Manager**.

Cloud Run is the natural fit here: the app already ships a production
`docker/Dockerfile`, listens on `$PORT` (which Cloud Run injects), exposes a
`/api/health` endpoint, runs migrations on startup, and — with the default
`database` upload transport — stores documents in Postgres so the container
stays stateless.

## Architecture

```
                         ┌──────────────────────┐
   users ──HTTPS──▶      │   Cloud Run service  │  (autoscaling container)
                         │   documenso:latest   │
                         └──────────┬───────────┘
                                    │ unix socket /cloudsql/...
                         ┌──────────▼───────────┐
                         │   Cloud SQL (PG 15)  │  documents + app data
                         └──────────────────────┘
   Secret Manager ──▶ encryption keys, auth secret, DB URL, signing cert, SMTP pw
   Artifact Registry ──▶ container image (built by Cloud Build)
```

## Prerequisites

- The [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) installed and
  authenticated: `gcloud auth login`
- `openssl` (used to generate keys and the self-signed signing cert)
- A Google Cloud project with billing enabled, and permission to create the
  resources above (Owner/Editor is simplest)

## Quick start

```bash
cd deploy/gcp
cp config.example.sh config.sh
$EDITOR config.sh          # set PROJECT_ID, REGION, SMTP, ...
./deploy-all.sh
```

That runs every step in order. When it finishes it prints the service URL and
health-check URL. Each step is idempotent — re-running is safe.

## What each script does

| Script | Purpose |
|---|---|
| `config.example.sh` | Template you copy to `config.sh` (gitignored) and edit. |
| `common.sh` | Shared helpers + config loading. Sourced by the others; not run directly. |
| `00-prerequisites.sh` | Enables required APIs, creates the Artifact Registry repo. |
| `01-database.sh` | Creates the Cloud SQL instance, database and user; stores the connection string as a secret. |
| `02-secrets.sh` | Creates encryption/auth secrets + a self-signed signing cert; grants the runtime SA secret access and `cloudsql.client`. |
| `03-build.sh` | Builds the image via Cloud Build (`../../cloudbuild.yaml`) and pushes to Artifact Registry. |
| `04-deploy.sh` | Deploys the Cloud Run service with Cloud SQL, secrets and env wired in; resolves the public URL. |
| `05-migrate-job.sh` | **Optional.** Runs migrations as a one-off Cloud Run Job (see *Migrations* below). |
| `deploy-all.sh` | Runs steps 00→04 in order. |
| `99-teardown.sh` | **Destructive.** Deletes everything created here (asks for confirmation). |

## Migrations

The container runs `prisma migrate deploy` on startup (`docker/start.sh`), so a
normal deploy also applies pending migrations. Prisma guards this with an
advisory lock, so concurrent instances are safe.

If you'd rather apply migrations explicitly *before* shifting traffic, run
`./05-migrate-job.sh` — it executes migrations once in a Cloud Run Job using the
same image. (The startup migration still runs and is a harmless no-op when
there's nothing pending.)

## Custom domain (recommended for production)

`NEXT_PUBLIC_WEBAPP_URL` must match the URL users hit. By default the deploy
script detects the auto-assigned `*.run.app` URL and wires it in. For a stable
URL, map your domain and set `WEBAPP_URL` in `config.sh` before deploying:

```bash
gcloud run domain-mappings create \
  --service="$SERVICE" --domain="app.keepcontracts.com" --region="$REGION"
# add the DNS records it prints, then set WEBAPP_URL=https://app.keepcontracts.com
```

## Decision points & alternatives

- **File storage** — defaults to `database` (documents in Postgres; keeps Cloud
  Run stateless). For high volume, set `UPLOAD_TRANSPORT=s3` and point the
  `NEXT_PRIVATE_UPLOAD_*` vars at a GCS bucket via its S3-compatible API.
- **Email** — you must supply real SMTP credentials in `config.sh` for outbound
  email to work. Without `SMTP_HOST` the app boots but can't send mail.
- **Signing certificate** — the toolkit generates a **self-signed** `.p12` for
  testing. For production, either replace the `*-signing-cert` secret with a
  real certificate, or switch to **Cloud KMS HSM** signing
  (`NEXT_PRIVATE_SIGNING_TRANSPORT=gcloud-hsm` + the `*_GCLOUD_HSM_*` env vars —
  this app has first-class support for it). See
  <https://docs.documenso.com/developers/self-hosting/signing-certificate>.
- **Background jobs** — defaults to the in-process `local` provider, which is
  why `RUN_MIN_INSTANCES=1` and `--no-cpu-throttling` are set (a warm instance
  with CPU always allocated is needed for scheduled work). For heavier setups,
  switch to `bullmq` backed by Memorystore (Redis) or Inngest.

## Troubleshooting

- **Build can't push to Artifact Registry** — ensure the Cloud Build service
  account has `roles/artifactregistry.writer` (default in most projects).
- **`--allow-unauthenticated` rejected** — an org policy may forbid public
  services. Remove the flag and put Cloud Run behind IAP or a load balancer.
- **Service can't reach the DB** — confirm the runtime SA has
  `roles/cloudsql.client` (granted by `02-secrets.sh`) and that the deploy used
  `--add-cloudsql-instances`.
- **Apple Silicon, building locally instead of Cloud Build** — pass
  `--platform linux/amd64` to `docker buildx`; Cloud Run runs amd64.

## Teardown

```bash
./99-teardown.sh    # deletes the service, DB (and all data), secrets, repo
```
