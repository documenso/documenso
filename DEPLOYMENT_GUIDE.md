# SuiteOp Sign - Deployment & Update Guide

Complete guide for updating, building, and deploying your white-labeled Documenso fork.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Updating from Upstream Documenso](#updating-from-upstream-documenso)
3. [Building Docker Images](#building-docker-images)
4. [Deploying to Render.com](#deploying-to-rendercom)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Troubleshooting](#troubleshooting)
7. [White-Label Changes Reference](#white-label-changes-reference)

---

## System Overview

**Repository Structure:**
- **Origin:** `https://github.com/JeanSuiteop/documenso-fork` (your fork)
- **Upstream:** `https://github.com/documenso/documenso` (original Documenso)
- **Current Base Version:** v2.3.0
- **Docker Image:** `jeanlosi/suiteop-sign:latest`
- **Branding:** SuiteOp Sign (purple theme)

**Key Files Modified:**
- See `WHITE_LABEL_CHANGES.md` for complete list of white-labeled files
- Primary changes: CSS variables, logos, colors, email templates, meta tags
- Global webhook configuration for centralized event tracking

---

## Updating from Upstream Documenso

### Prerequisites

```bash
# Ensure you have the upstream remote configured
git remote -v
# Should show:
# origin    https://github.com/JeanSuiteop/documenso-fork.git
# upstream  https://github.com/documenso/documenso.git
```

**If upstream is not configured:**
```bash
git remote add upstream https://github.com/documenso/documenso.git
```

---

### Step 1: Fetch Latest Releases

```bash
cd /Users/jean-emmanuellosi/Projects/Documenso/documenso-fork

# Fetch all tags and branches from upstream
git fetch upstream --tags

# List available release versions
git tag -l | grep "^v" | sort -V | tail -10
```

---

### Step 2: Check Current Version

```bash
# Check your current version
git describe --tags

# Review what's new in the target version
# Visit: https://github.com/documenso/documenso/releases
```

---

### Step 3: Create Update Branch

```bash
# Create a new branch for the update
git checkout -b update-to-vX.X.X

# Example: git checkout -b update-to-v1.14.0
```

---

### Step 4: Merge Upstream Release

**Option A: Merge Specific Release Tag (RECOMMENDED)**

```bash
# Merge the specific release tag
git merge vX.X.X --no-ff

# Example: git merge v1.14.0 --no-ff
```

**Option B: Cherry-pick Release Commit**

```bash
# If you want more control, cherry-pick the release commit
git cherry-pick <release-commit-hash>
```

---

### Step 5: Resolve Merge Conflicts

Merge conflicts are likely in white-labeled files. Priority files to check:

**High Priority (will likely conflict):**
1. `packages/ui/styles/theme.css` - CSS variables
2. `apps/remix/app/components/general/branding-logo.tsx` - SVG logo
3. `packages/email/template-components/template-footer.tsx` - Email footer
4. `apps/remix/app/utils/meta.ts` - Meta tags
5. `packages/tailwind-config/index.cjs` - Tailwind colors
6. `apps/documentation/theme.config.tsx` - Docs theme

**For each conflict:**

```bash
# Check which files have conflicts
git status

# For each conflicted file, decide:
# 1. Keep your white-labeled changes (THEIRS)
# 2. Accept upstream changes and re-apply white-labeling (OURS)
# 3. Manually merge both

# Example: Keep your white-labeled CSS
git checkout --ours packages/ui/styles/theme.css
git add packages/ui/styles/theme.css

# Or use a merge tool
git mergetool
```

**Recommended Conflict Resolution Strategy:**

1. **For white-labeled files:** Keep your changes (`--ours`)
2. **For new upstream features:** Accept their changes, then re-apply branding
3. **For package.json, dependencies:** Accept upstream (`--theirs`), test thoroughly

---

### Step 6: Re-apply White-Labeling (if needed)

If you accepted upstream changes, re-apply white-labeling using `WHITE_LABEL_CHANGES.md` as reference:

```bash
# Example: Re-apply purple theme to CSS
# Edit: packages/ui/styles/theme.css
# Change primary colors from green to purple (HSL 248 99% 70%)

# Example: Update logo
# Edit: apps/remix/app/components/general/branding-logo.tsx
# Replace SVG with SuiteOp logo
```

---

### Step 7: Test Locally

```bash
# Install dependencies
npm install

# Start Docker services
npm run dx:up

# Run database migrations
npm run prisma:migrate-dev

# Seed database (if needed)
npm run prisma:seed

# Compile translations
npm run translate:compile

# Start development server
npm run dev
```

**Test Checklist:**
- [ ] Application starts without errors
- [ ] Purple branding displays correctly
- [ ] SuiteOp logo appears in navbar
- [ ] Login/signup flows work
- [ ] Document creation/signing works
- [ ] Email templates show SuiteOp branding
- [ ] No console errors

---

### Step 8: Commit and Push

```bash
# Add all changes
git add .

# Commit with conventional commit format
git commit -m "chore(update): merge upstream Documenso vX.X.X

- Merged latest Documenso release vX.X.X
- Resolved conflicts in white-labeled files
- Re-applied SuiteOp branding
- Tested all core functionality"

# Push to your fork
git push origin update-to-vX.X.X

# Merge to main (or create PR)
git checkout main
git merge update-to-vX.X.X
git push origin main
```

---

## Building Docker Images

### Prerequisites

1. **Docker Installed:** `docker --version`
2. **Docker Buildx:** `docker buildx version`
3. **Docker Hub Account:** Logged in via `docker login`

---

### Step 1: Docker Hub Login

```bash
# Login to Docker Hub
docker login -u jeanlosi

# Enter your password when prompted
```

---

### Step 2: Build for linux/amd64 Platform

**IMPORTANT:** Always build for `linux/amd64` (Render.com/most cloud providers require this)

```bash
cd /Users/jean-emmanuellosi/Projects/Documenso/documenso-fork

# Build and push in one command (RECOMMENDED)
docker buildx build \
  --platform linux/amd64 \
  -f docker/Dockerfile \
  -t jeanlosi/suiteop-sign:latest \
  -t jeanlosi/suiteop-sign:vX.X.X \
  --push \
  .

# Example for v2.0.0:
# docker buildx build --platform linux/amd64 -f docker/Dockerfile -t jeanlosi/suiteop-sign:latest -t jeanlosi/suiteop-sign:v2.0.0 --push .
```

**What this does:**
- `--platform linux/amd64` - Builds for AMD64 architecture (required for cloud platforms)
- `-t jeanlosi/suiteop-sign:latest` - Tags as latest
- `-t jeanlosi/suiteop-sign:vX.X.X` - Tags with version number
- `--push` - Automatically pushes to Docker Hub after build
- `.` - Uses current directory as build context

---

### Step 3: Monitor Build Progress

The build takes approximately **15-20 minutes** and includes:

1. **Dependencies Installation** (~3-5 min)
2. **Prisma Generation** (~1 min)
3. **Translation Compilation** (~1 min)
4. **React/Remix Build** (~5-8 min)
5. **Server Build** (~2-3 min)
6. **Image Export & Push** (~2-3 min)

**Build progress will show:**
```
#30 @documenso/remix:build: ✓ built in 55.35s
#38 exporting layers
#38 pushing manifest for docker.io/jeanlosi/suiteop-sign:latest
#38 DONE 96.9s
```

---

### Step 4: Verify Push

```bash
# Check Docker Hub or use:
docker manifest inspect jeanlosi/suiteop-sign:latest

# Should show:
# "architecture": "amd64"
# "os": "linux"
```

**Verify on Docker Hub:**
- Visit: https://hub.docker.com/r/jeanlosi/suiteop-sign
- Check "Tags" tab for latest version
- Verify platform shows `linux/amd64`

---

### Alternative: Build Locally, Then Push

```bash
# Build without pushing
docker buildx build \
  --platform linux/amd64 \
  -f docker/Dockerfile \
  -t jeanlosi/suiteop-sign:latest \
  -t jeanlosi/suiteop-sign:vX.X.X \
  --load \
  .

# Test locally (optional)
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_WEBAPP_URL=http://localhost:3000 \
  -e NEXT_PRIVATE_DATABASE_URL=postgresql://... \
  jeanlosi/suiteop-sign:latest

# Push to Docker Hub
docker push jeanlosi/suiteop-sign:latest
docker push jeanlosi/suiteop-sign:vX.X.X
```

---

## Deploying to Render.com

### Step 1: Create New Web Service

1. Go to https://render.com/dashboard
2. Click **"New +"** → **"Web Service"**
3. Select **"Deploy an existing image from a registry"**

---

### Step 2: Configure Image

**Image URL:**
```
docker.io/jeanlosi/suiteop-sign:latest
```

**Or specify version:**
```
docker.io/jeanlosi/suiteop-sign:v2.0.0
```

---

### Step 3: Configure Service Settings

**Basic Settings:**
- **Name:** `suiteop-sign` (or your preferred name)
- **Region:** Choose closest to your users
- **Instance Type:** 
  - **Development:** Starter (512 MB RAM, $7/month)
  - **Production:** Standard (2 GB RAM, $25/month) or higher

**Runtime:**
- **Port:** `3000` (IMPORTANT!)
- **Health Check Path:** `/` or `/api/health`

---

### Step 4: Configure Environment Variables

Click **"Environment"** tab and add these variables:

---

## Environment Variables Reference

### Required Variables

#### Application URL
```bash
NEXT_PUBLIC_WEBAPP_URL=https://your-app.onrender.com
```
**Description:** Your application's public URL (Render will provide this after first deploy)

---

#### Database Configuration

**Primary Database URL:**
```bash
NEXT_PRIVATE_DATABASE_URL=postgresql://username:password@hostname:5432/database?pgbouncer=true&connection_limit=1
```
**Description:** PostgreSQL connection string with connection pooling (PgBouncer)

**Direct Database URL:**
```bash
NEXT_PRIVATE_DIRECT_DATABASE_URL=postgresql://username:password@hostname:5432/database
```
**Description:** Direct PostgreSQL connection (used for migrations)

**Where to get database:**
- **Render PostgreSQL:** Create in Render dashboard → Internal Database
- **Supabase:** https://supabase.com → Project Settings → Database
- **Neon:** https://neon.tech
- **Railway:** https://railway.app

---

#### Authentication

**NextAuth Secret:**
```bash
NEXTAUTH_SECRET=<random-64-char-string>
```
**Generate with:**
```bash
openssl rand -base64 64
```
**Description:** Used for session token encryption

---

#### Encryption Keys

**Primary Encryption Key:**
```bash
NEXT_PRIVATE_ENCRYPTION_KEY=<random-32-char-string>
```
**Generate with:**
```bash
openssl rand -base64 32
```
**Description:** Used for encrypting sensitive data

**Secondary Encryption Key:**
```bash
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=<random-32-char-string>
```
**Generate with:**
```bash
openssl rand -base64 32
```
**Description:** Used for key rotation

---

#### SMTP Configuration (Email Sending)

```bash
NEXT_PRIVATE_SMTP_HOST=smtp.gmail.com
NEXT_PRIVATE_SMTP_PORT=587
NEXT_PRIVATE_SMTP_USERNAME=your-email@gmail.com
NEXT_PRIVATE_SMTP_PASSWORD=your-app-password
NEXT_PRIVATE_SMTP_FROM_NAME=SuiteOp Sign
NEXT_PRIVATE_SMTP_FROM_ADDRESS=noreply@suiteop.com
NEXT_PRIVATE_SMTP_SECURE=false
```

**SMTP Provider Options:**

**Gmail:**
- Host: `smtp.gmail.com`
- Port: `587`
- Use App Password: https://myaccount.google.com/apppasswords

**SendGrid:**
- Host: `smtp.sendgrid.net`
- Port: `587`
- Username: `apikey`
- Password: Your SendGrid API key

**AWS SES:**
- Host: `email-smtp.us-east-1.amazonaws.com`
- Port: `587`
- Username: Your SMTP credentials
- Password: Your SMTP credentials

**Resend:**
- Host: `smtp.resend.com`
- Port: `587`
- Username: `resend`
- Password: Your API key

**Mailgun:**
- Host: `smtp.mailgun.org`
- Port: `587`
- Username: Your Mailgun SMTP username
- Password: Your Mailgun SMTP password

---

#### Global Webhook Configuration

**Global Webhook URL (Optional):**
```bash
NEXT_PRIVATE_GLOBAL_WEBHOOK_URL=https://events.suiteop.com/jkhgcu4kx5sec3
```
**Description:** Centralized webhook endpoint that receives notifications for `DOCUMENT_SIGNED` and `DOCUMENT_COMPLETED` events from ALL accounts on the platform. This runs in addition to user-configured webhooks.

**Default Value:** `https://events.suiteop.com/jkhgcu4kx5sec3`

**Features:**
- Automatically triggers for all document signing events across the platform
- Non-blocking implementation (doesn't slow down document operations)
- Includes error handling and logging
- Runs independently of user-configured webhooks

**To disable:** Set to empty string or remove the variable

**See:** `GLOBAL_WEBHOOK.md` for complete documentation

---

#### AI Features Configuration (Optional)

The AI features enable automatic recipient detection and field placement using Google Vertex AI (Gemini models).

**Note:** This is a SuiteOp fork modification. The upstream Documenso uses `GOOGLE_VERTEX_API_KEY` which doesn't work with Vertex AI's OAuth requirements. We use service account credentials instead.

**Required for AI features:**
```bash
GOOGLE_VERTEX_PROJECT_ID=suiteop-sign-ai
GOOGLE_VERTEX_LOCATION=global
GOOGLE_CLIENT_EMAIL=suiteop-sign-ai@suiteop-sign-ai.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

**Setting up Google Cloud:**

1. Create a GCP project:
   ```bash
   gcloud projects create suiteop-sign-ai --name="SuiteOp Sign AI"
   ```

2. Link billing account:
   ```bash
   gcloud billing projects link suiteop-sign-ai --billing-account=YOUR_BILLING_ACCOUNT_ID
   ```

3. Enable Vertex AI API:
   ```bash
   gcloud services enable aiplatform.googleapis.com --project=suiteop-sign-ai
   ```

4. Create service account:
   ```bash
   gcloud iam service-accounts create suiteop-sign-ai \
     --display-name="SuiteOp Sign AI Service Account" \
     --project=suiteop-sign-ai
   ```

5. Grant permissions:
   ```bash
   gcloud projects add-iam-policy-binding suiteop-sign-ai \
     --member="serviceAccount:suiteop-sign-ai@suiteop-sign-ai.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   ```

6. Create and download key:
   ```bash
   gcloud iam service-accounts keys create service-account-key.json \
     --iam-account=suiteop-sign-ai@suiteop-sign-ai.iam.gserviceaccount.com \
     --project=suiteop-sign-ai
   ```

7. Extract values from the JSON file:
   - `GOOGLE_CLIENT_EMAIL`: The `client_email` field
   - `GOOGLE_PRIVATE_KEY`: The `private_key` field (keep the `\n` characters)

**Important:** When setting `GOOGLE_PRIVATE_KEY` in Render.com, paste the key with `\n` characters (not actual newlines). The application will convert them.

**To disable AI features:** Simply don't set these environment variables.

---

### Optional Variables

#### Storage Configuration (S3-Compatible)

```bash
NEXT_PRIVATE_UPLOAD_PROVIDER=s3
NEXT_PRIVATE_UPLOAD_ENDPOINT=https://s3.amazonaws.com
NEXT_PRIVATE_UPLOAD_REGION=us-east-1
NEXT_PRIVATE_UPLOAD_BUCKET=suiteop-documents
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID=your-access-key
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY=your-secret-key
NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE=false
```

**Storage Provider Options:**
- **AWS S3:** Standard S3 configuration
- **Cloudflare R2:** S3-compatible, free egress
- **MinIO:** Self-hosted S3-compatible
- **DigitalOcean Spaces:** S3-compatible

**If not configured:** Files stored in database (not recommended for production)

---

#### Email Templates Domain

```bash
NEXT_PUBLIC_WEBAPP_URL=https://suiteop.com
```
**Description:** Base URL for email links

---

#### Feature Flags

```bash
NEXT_PUBLIC_FEATURE_TEMPLATES=true
NEXT_PUBLIC_FEATURE_TEAMS=true
NEXT_PUBLIC_FEATURE_WEBHOOKS=true
```
**Description:** Enable/disable features

---

#### Logging & Monitoring

```bash
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
NODE_ENV=production
LOG_LEVEL=info
```

---

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Pull Docker image from Docker Hub
   - Start container with environment variables
   - Run health checks
   - Assign public URL

**First Deployment:**
- Takes ~5-10 minutes
- Monitor logs in Render dashboard
- Look for: `Server listening on port 3000`

---

### Step 6: Run Database Migrations

**IMPORTANT:** First deployment requires database setup.

**Option A: Using Render Shell**

1. Go to your service → **"Shell"** tab
2. Run:
```bash
npm run prisma:migrate-deploy
npm run prisma:db-seed
```

**Option B: Using Render Deploy Hook**

Create a one-time job:
1. Render Dashboard → **"Jobs"**
2. Create new job from same Docker image
3. Command: `npm run prisma:migrate-deploy && npm run prisma:db-seed`
4. Run once

---

### Step 7: Verify Deployment

**Test your deployment:**

1. **Visit URL:** `https://your-app.onrender.com`
2. **Create Account:** Sign up with email
3. **Check Email:** Verify email works (check SMTP settings if not)
4. **Create Document:** Test core functionality
5. **Check Branding:** Verify purple theme and SuiteOp logos

---

### Step 8: Configure Custom Domain (Optional)

1. Go to service → **"Settings"** → **"Custom Domains"**
2. Add your domain: `sign.suiteop.com`
3. Configure DNS:
   - **Type:** `CNAME`
   - **Name:** `sign`
   - **Value:** `your-app.onrender.com`
4. Update `NEXT_PUBLIC_WEBAPP_URL` environment variable
5. Redeploy

---

## Troubleshooting

### Build Issues

**Problem: "no space left on device"**
```bash
# Clean Docker cache
docker builder prune -af
docker system prune -af
```

**Problem: "buildx not found"**
```bash
# Install buildx
docker buildx install
```

**Problem: Build fails on ARM Mac**
```bash
# Ensure you're using --platform linux/amd64
docker buildx build --platform linux/amd64 ...
```

---

### Deployment Issues

**Problem: "Health check failed"**
- Check logs: Does app start?
- Verify `PORT=3000` in Render settings
- Check database connection
- Verify all required env vars are set

**Problem: "Database connection failed"**
- Verify `NEXT_PRIVATE_DATABASE_URL` is correct
- Check database is accessible from Render
- Ensure connection string includes `?pgbouncer=true&connection_limit=1`
- Use `NEXT_PRIVATE_DIRECT_DATABASE_URL` without pooling params

**Problem: "Emails not sending"**
- Check SMTP credentials
- Test SMTP connection locally
- Verify firewall allows port 587/465
- Check email provider logs

**Problem: "Page shows old branding"**
- Clear browser cache
- Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
- Check Docker image was rebuilt with latest changes
- Verify correct image tag is deployed

---

### Merge Conflict Resolution

**Problem: Complex conflicts in white-labeled files**

**Strategy:**
1. Create backup of your white-labeled file:
   ```bash
   cp packages/ui/styles/theme.css theme.css.backup
   ```

2. Accept upstream version:
   ```bash
   git checkout --theirs packages/ui/styles/theme.css
   ```

3. Manually re-apply your changes using `WHITE_LABEL_CHANGES.md`

4. Compare with backup:
   ```bash
   diff theme.css.backup packages/ui/styles/theme.css
   ```

---

## White-Label Changes Reference

All white-label changes are documented in `WHITE_LABEL_CHANGES.md`. Quick reference:

**Color Palette:**
- Primary: `HSL(248, 99%, 70%)` (purple)
- Old: `HSL(95.08, 71.08%, 67.45%)` (green)

**Key Files:**
1. `packages/ui/styles/theme.css` - CSS variables
2. `packages/tailwind-config/index.cjs` - Tailwind colors
3. `apps/remix/app/components/general/branding-logo.tsx` - SVG logo
4. `packages/email/template-components/template-footer.tsx` - Email footer
5. `apps/remix/app/utils/meta.ts` - Meta tags
6. All email templates: "Documenso Logo" → "SuiteOp Logo"

**Search & Replace:**
- Find: `Documenso` (display text)
- Replace: `SuiteOp Sign`
- Exception: Keep in code comments, URLs to original project

---

## Quick Reference Commands

**Update from upstream:**
```bash
git fetch upstream --tags
git checkout -b update-to-vX.X.X
git merge vX.X.X --no-ff
# Resolve conflicts
npm install && npm run dev
git commit -m "chore(update): merge upstream vX.X.X"
git push origin update-to-vX.X.X
```

**Build & push Docker:**
```bash
docker login -u jeanlosi
docker buildx build --platform linux/amd64 -f docker/Dockerfile -t jeanlosi/suiteop-sign:latest -t jeanlosi/suiteop-sign:vX.X.X --push .
```

**Generate secrets:**
```bash
# NEXTAUTH_SECRET (64 chars)
openssl rand -base64 64

# Encryption keys (32 chars each)
openssl rand -base64 32
```

**Local development:**
```bash
npm run dx:up
npm run prisma:migrate-dev
npm run prisma:seed
npm run translate:compile
npm run dev
```

---

## Support & Credits

**Original Project:** [Documenso](https://github.com/documenso/documenso)  
**License:** AGPL-3.0 (inherited from Documenso)  
**Documentation:** https://docs.documenso.com  
**Community:** https://documen.so/discord

**White-Label Customization:** SuiteOp Sign  
**Maintainer:** JeanSuiteop  
**Docker Hub:** https://hub.docker.com/r/jeanlosi/suiteop-sign

---

## Version History

| Version | Base Documenso | Date | Changes |
|---------|----------------|------|---------|
| v2.3.0 | v2.3.0 | 2025-12-22 | Merged upstream v2.3.0 with SuiteOp branding, OAuth, and global webhook |
| v2.0.0 | v2.0.0 | 2025-01-28 | Merged upstream v2.0.0 with SuiteOp branding and OAuth integration |

---

**Last Updated:** December 22, 2025

