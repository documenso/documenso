# SuiteOp Sign - Quick Reference Card

Essential commands and information for maintaining SuiteOp Sign.

---

## 🚀 Quick Deploy to Render.com

**1. Build & Push Docker Image:**
```bash
docker login -u jeanlosi
cd /Users/jean-emmanuellosi/Projects/Documenso/documenso-fork
docker buildx build --platform linux/amd64 -f docker/Dockerfile -t jeanlosi/suiteop-sign:latest --push .
```

**2. Render.com Configuration:**
- **Image:** `docker.io/jeanlosi/suiteop-sign:latest`
- **Port:** `3000`
- **Instance:** Standard (2GB RAM minimum for production)

**3. Required Environment Variables:**
```bash
NEXT_PUBLIC_WEBAPP_URL=https://your-app.onrender.com
NEXT_PRIVATE_DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=1
NEXT_PRIVATE_DIRECT_DATABASE_URL=postgresql://user:pass@host:5432/db
NEXTAUTH_SECRET=$(openssl rand -base64 64)
NEXT_PRIVATE_ENCRYPTION_KEY=$(openssl rand -base64 32)
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=$(openssl rand -base64 32)
NEXT_PRIVATE_SMTP_HOST=smtp.gmail.com
NEXT_PRIVATE_SMTP_PORT=587
NEXT_PRIVATE_SMTP_USERNAME=your-email@gmail.com
NEXT_PRIVATE_SMTP_PASSWORD=your-app-password
NEXT_PRIVATE_SMTP_FROM_NAME=SuiteOp Sign
NEXT_PRIVATE_SMTP_FROM_ADDRESS=noreply@suiteop.com
# Optional: Global webhook for centralized event tracking
NEXT_PRIVATE_GLOBAL_WEBHOOK_URL=https://events.suiteop.com/jkhgcu4kx5sec3
```

---

## 🔄 Update from Documenso

```bash
# 1. Fetch latest releases
git fetch upstream --tags

# 2. Check available versions
git tag -l | grep "^v" | sort -V | tail -10

# 3. Create update branch
git checkout -b update-to-vX.X.X

# 4. Merge release
git merge vX.X.X --no-ff

# 5. Resolve conflicts (keep white-label changes)
git status
git checkout --ours <white-labeled-file>  # Keep your changes
git checkout --theirs <dependency-file>    # Accept their changes

# 6. Test locally
npm install
npm run dx:up
npm run prisma:migrate-dev
npm run translate:compile
npm run dev

# 7. Commit & push
git add .
git commit -m "chore(update): merge upstream Documenso vX.X.X"
git push origin update-to-vX.X.X
```

---

## 🎨 White-Label Color Reference

**SuiteOp Purple:**
- **Primary:** `HSL(248, 99%, 70%)` or `#8585FF`
- **Primary Dark:** `HSL(248, 60%, 50%)` or `#3636A1`

**Tailwind Config (packages/tailwind-config/index.cjs):**
```javascript
documenso: {
  DEFAULT: '#8585FF',
  500: '#8585FF',
  700: '#3636A1',
}
```

**CSS Variables (packages/ui/styles/theme.css):**
```css
--primary: 248 99% 70%;
--ring: 248 99% 70%;
```

---

## 🛠️ Generate Secrets

```bash
# NextAuth Secret (64 chars)
openssl rand -base64 64

# Encryption Keys (32 chars each)
openssl rand -base64 32
openssl rand -base64 32
```

---

## 📁 Critical White-Labeled Files

Must preserve during updates:

1. `packages/ui/styles/theme.css`
2. `packages/tailwind-config/index.cjs`
3. `apps/remix/app/components/general/branding-logo.tsx`
4. `packages/email/template-components/template-footer.tsx`
5. `apps/remix/app/utils/meta.ts`
6. `apps/remix/public/site.webmanifest`
7. All email templates (packages/email/templates/*.tsx)
8. `packages/lib/constants/app.ts` (global webhook config)
9. `packages/lib/server-only/webhooks/trigger/handler.ts` (webhook handler)

---

## 🐳 Docker Commands

**Build for AMD64 (Render.com):**
```bash
docker buildx build --platform linux/amd64 -f docker/Dockerfile \
  -t jeanlosi/suiteop-sign:latest \
  -t jeanlosi/suiteop-sign:vX.X.X \
  --push .
```

**Build without push:**
```bash
docker buildx build --platform linux/amd64 -f docker/Dockerfile \
  -t jeanlosi/suiteop-sign:latest --load .
```

**Test locally:**
```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_WEBAPP_URL=http://localhost:3000 \
  -e NEXT_PRIVATE_DATABASE_URL=postgresql://... \
  jeanlosi/suiteop-sign:latest
```

**Clean Docker cache:**
```bash
docker builder prune -af
docker system prune -af
```

---

## 💻 Local Development

```bash
# Start services
npm run dx:up

# Stop services
npm run dx:down

# Database migrations
npm run prisma:migrate-dev

# Seed database
npm run prisma:seed

# Compile translations
npm run translate:compile

# Start dev server
npm run dev

# Build for production
npm run build

# Lint & fix
npm run lint:fix
```

---

## 🔍 Troubleshooting

**"Platform mismatch" on Render:**
```bash
# Always build with --platform linux/amd64
docker buildx build --platform linux/amd64 ...
```

**"Health check failed":**
- Verify Port = 3000 in Render
- Check database connection
- Verify all env vars are set

**"Emails not sending":**
- Test SMTP: `telnet smtp.gmail.com 587`
- Use App Password (not Gmail password)
- Check firewall allows port 587

**"Old branding shows":**
```bash
# Hard refresh browser
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)

# Verify Docker image rebuilt
docker manifest inspect jeanlosi/suiteop-sign:latest
```

---

## 📊 Version Tracking

| Component | Current | Latest Check |
|-----------|---------|--------------|
| Fork Base | v2.0.0 | `git fetch upstream --tags` |
| Docker Image | latest | `docker pull jeanlosi/suiteop-sign:latest` |
| Node.js | 20.x | `node --version` |

---

## 🔗 Important Links

- **Docker Hub:** https://hub.docker.com/r/jeanlosi/suiteop-sign
- **Render Dashboard:** https://render.com/dashboard
- **Upstream Documenso:** https://github.com/documenso/documenso
- **Your Fork:** https://github.com/JeanSuiteop/documenso-fork
- **Documenso Releases:** https://github.com/documenso/documenso/releases
- **Documenso Docs:** https://docs.documenso.com

---

## 📞 SMTP Provider Quick Setup

**Gmail:**
```env
NEXT_PRIVATE_SMTP_HOST=smtp.gmail.com
NEXT_PRIVATE_SMTP_PORT=587
NEXT_PRIVATE_SMTP_USERNAME=your-email@gmail.com
NEXT_PRIVATE_SMTP_PASSWORD=<app-password>
```
Get App Password: https://myaccount.google.com/apppasswords

**SendGrid:**
```env
NEXT_PRIVATE_SMTP_HOST=smtp.sendgrid.net
NEXT_PRIVATE_SMTP_PORT=587
NEXT_PRIVATE_SMTP_USERNAME=apikey
NEXT_PRIVATE_SMTP_PASSWORD=<sendgrid-api-key>
```

**Resend (Recommended):**
```env
NEXT_PRIVATE_SMTP_HOST=smtp.resend.com
NEXT_PRIVATE_SMTP_PORT=587
NEXT_PRIVATE_SMTP_USERNAME=resend
NEXT_PRIVATE_SMTP_PASSWORD=<resend-api-key>
```

---

## ⚠️ Important Notes

1. **Always use `--platform linux/amd64`** when building Docker images
2. **Test locally** before pushing to production
3. **Backup database** before running migrations
4. **Keep `WHITE_LABEL_CHANGES.md`** updated with any new changes
5. **Use Conventional Commits** for clear git history
6. **Monitor Render logs** after deployment for errors

---

**Full documentation:** See `DEPLOYMENT_GUIDE.md`  
**Last Updated:** January 28, 2025

