# SuiteOp Sign

A white-labeled fork of [Documenso](https://github.com/documenso/documenso) - the open-source DocuSign alternative.

<div align="center">
  <img src="https://img.shields.io/badge/Based%20On-Documenso%20v2.0.0-purple" alt="Based on Documenso v2.0.0" />
  <img src="https://img.shields.io/badge/License-AGPL--3.0-blue" alt="License: AGPL-3.0" />
  <img src="https://img.shields.io/docker/v/jeanlosi/suiteop-sign?label=Docker&color=purple" alt="Docker Version" />
</div>

---

## 🎨 What is SuiteOp Sign?

SuiteOp Sign is a professionally white-labeled version of Documenso featuring:

- **🟣 Purple Brand Identity** - Custom SuiteOp branding throughout
- **✉️ Branded Emails** - All email templates customized with SuiteOp theme
- **🎯 Production Ready** - Docker image optimized for cloud deployment
- **🔄 Maintained Fork** - Regular updates from upstream Documenso releases
- **📦 Easy Deploy** - One-command Docker deployment to Render.com

---

## 🚀 Quick Start

### Option 1: Deploy to Render.com (Recommended)

1. **Create Web Service** on Render.com
2. **Use Docker Image:** `docker.io/jeanlosi/suiteop-sign:latest`
3. **Set Port:** `3000`
4. **Configure Environment Variables** (see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md))

### Option 2: Run with Docker Locally

```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_WEBAPP_URL=http://localhost:3000 \
  -e NEXT_PRIVATE_DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 64) \
  -e NEXT_PRIVATE_ENCRYPTION_KEY=$(openssl rand -base64 32) \
  -e NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=$(openssl rand -base64 32) \
  jeanlosi/suiteop-sign:latest
```

### Option 3: Local Development

```bash
# Clone repository
git clone https://github.com/JeanSuiteop/documenso-fork.git
cd documenso-fork

# Install dependencies
npm install

# Start Docker services (PostgreSQL, MailDev)
npm run dx:up

# Run database migrations
npm run prisma:migrate-dev

# Seed database
npm run prisma:seed

# Compile translations
npm run translate:compile

# Start development server
npm run dev
```

Visit `http://localhost:3000` 🎉

---

## 📚 Documentation

- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete deployment and update instructions
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick command reference
- **[WHITE_LABEL_CHANGES.md](WHITE_LABEL_CHANGES.md)** - All white-label modifications
- **[Original Documenso Docs](https://docs.documenso.com)** - Upstream documentation

---

## 🎨 Customizations

### Visual Changes

- **Primary Color:** Green → Purple (`HSL(248, 99%, 70%)`)
- **Logo:** Documenso → SuiteOp custom SVG
- **Brand Name:** Documenso → SuiteOp Sign
- **Email Templates:** Fully rebranded with purple theme
- **Meta Tags:** Updated for SuiteOp SEO
- **PWA Manifest:** SuiteOp Sign branding

### Technical Stack

- **Framework:** Remix (React Router v7)
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js
- **UI:** Tailwind CSS, Shadcn UI, Radix UI
- **Email:** React Email
- **Storage:** S3-compatible (AWS S3, Cloudflare R2, MinIO)
- **Deployment:** Docker (linux/amd64)

---

## 🔄 Updating from Upstream

To update to the latest Documenso release:

```bash
# Fetch latest releases
git fetch upstream --tags

# Create update branch
git checkout -b update-to-vX.X.X

# Merge release
git merge vX.X.X --no-ff

# Resolve conflicts (keep white-label changes)
# Test locally
# Commit and push
```

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

---

## 🐳 Docker Hub

**Image:** [`jeanlosi/suiteop-sign`](https://hub.docker.com/r/jeanlosi/suiteop-sign)

**Tags:**
- `latest` - Most recent build
- `v2.0.0` - Specific version (based on Documenso v2.0.0)

**Platform:** `linux/amd64` (compatible with most cloud providers)

---

## 🌟 Features

All features from Documenso v2.0.0:

- ✅ **Electronic Signatures** - Legally binding digital signatures
- ✅ **Document Templates** - Reusable document workflows
- ✅ **Team Collaboration** - Multi-user workspaces
- ✅ **API Access** - RESTful API for integrations
- ✅ **Webhooks** - Real-time notifications
- ✅ **Email Notifications** - Automated document reminders
- ✅ **Audit Logs** - Complete signing history
- ✅ **Mobile Responsive** - Works on all devices
- ✅ **Self-Hosted** - Full control over your data
- ✅ **Open Source** - AGPL-3.0 licensed

---

## 🔧 Environment Variables

### Required

```bash
NEXT_PUBLIC_WEBAPP_URL=https://your-domain.com
NEXT_PRIVATE_DATABASE_URL=postgresql://...
NEXT_PRIVATE_DIRECT_DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<random-64-chars>
NEXT_PRIVATE_ENCRYPTION_KEY=<random-32-chars>
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=<random-32-chars>
```

### SMTP (Email)

```bash
NEXT_PRIVATE_SMTP_HOST=smtp.gmail.com
NEXT_PRIVATE_SMTP_PORT=587
NEXT_PRIVATE_SMTP_USERNAME=your-email@gmail.com
NEXT_PRIVATE_SMTP_PASSWORD=your-password
NEXT_PRIVATE_SMTP_FROM_NAME=SuiteOp Sign
NEXT_PRIVATE_SMTP_FROM_ADDRESS=noreply@suiteop.com
```

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#environment-variables-reference) for complete list.

---

## 📊 Project Structure

```
documenso-fork/
├── apps/
│   ├── remix/              # Main Remix application
│   │   ├── app/
│   │   │   ├── components/ # UI components (branding-logo.tsx)
│   │   │   └── utils/      # Utilities (meta.ts)
│   │   └── public/         # Static assets (logos, favicons)
│   └── documentation/      # Documentation site
├── packages/
│   ├── email/              # Email templates (white-labeled)
│   ├── ui/                 # Shared UI components
│   │   └── styles/         # Global CSS (theme.css)
│   ├── tailwind-config/    # Tailwind configuration (colors)
│   └── prisma/             # Database schema & migrations
├── docker/
│   └── Dockerfile          # Production Docker build
├── DEPLOYMENT_GUIDE.md     # Full deployment guide
├── QUICK_REFERENCE.md      # Quick command reference
└── WHITE_LABEL_CHANGES.md  # All customizations
```

---

## 🤝 Credits

This project is based on the incredible work by the [Documenso](https://github.com/documenso/documenso) team.

**Original Project:** https://github.com/documenso/documenso  
**Created by:** Documenso, Inc.  
**License:** AGPL-3.0  
**Website:** https://documenso.com

Special thanks to:
- The entire Documenso team and contributors
- The open-source community

---

## 📝 License

This project inherits the **AGPL-3.0** license from Documenso.

This means:
- ✅ You can use, modify, and distribute this software
- ✅ You can use it for commercial purposes
- ⚠️ You must disclose source code of any modifications
- ⚠️ You must use the same AGPL-3.0 license
- ⚠️ Network use is considered distribution

See [LICENSE](https://github.com/documenso/documenso/blob/main/LICENSE) for full details.

---

## 🔗 Links

- **Docker Hub:** https://hub.docker.com/r/jeanlosi/suiteop-sign
- **GitHub Fork:** https://github.com/JeanSuiteop/documenso-fork
- **Upstream Documenso:** https://github.com/documenso/documenso
- **Documenso Docs:** https://docs.documenso.com
- **Documenso Discord:** https://documen.so/discord

---

## 📞 Support

For issues specific to SuiteOp Sign white-labeling, open an issue in this repository.

For general Documenso questions:
- **Documentation:** https://docs.documenso.com
- **Community:** https://documen.so/discord
- **GitHub Issues:** https://github.com/documenso/documenso/issues

---

## 🗺️ Roadmap

- [x] Initial white-label implementation (v1.13.1)
- [x] Updated to Documenso v2.0.0 (v2.0.0)
- [x] Docker image for production deployment
- [x] Comprehensive documentation
- [ ] Automated testing for white-label changes
- [ ] CI/CD pipeline for automatic Docker builds
- [ ] Custom domain setup guide
- [ ] S3 storage configuration examples
- [ ] Performance optimization benchmarks

---

## 📈 Version History

| Version | Base Documenso | Date | Highlights |
|---------|----------------|------|------------|
| v2.0.0 | v2.0.0 | 2025-01-28 | Merged upstream v2.0.0 with SuiteOp branding |
| v1.13.1 | v1.13.1 | 2025-01-28 | Initial white-labeled release with purple branding |

---

<div align="center">
  <p>Built with ❤️ based on Documenso</p>
  <p>
    <a href="https://github.com/documenso/documenso">⭐ Star Documenso on GitHub</a>
  </p>
</div>

