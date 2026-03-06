# Documenso Architecture

This document provides a high-level overview of the Documenso codebase to help humans and agents understand how the application is structured.

## Overview

Documenso is an open-source document signing platform built as a **monorepo** using pnpm workspaces and Turborepo. The application enables users to create, send, and sign documents electronically.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Remix App (Hono Server)                        │
│                                 apps/remix                                  │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│  /api/v1/*  │  /api/v2/*  │ /api/trpc/* │ /api/jobs/* │   React Router UI   │
│  (ts-rest)  │   (tRPC)    │   (tRPC)    │  (Jobs API) │                     │
├─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┤
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐    │
│  │  @api   │  │  @trpc  │  │  @lib   │  │  @email │  │    @signing     │    │
│  │ (REST)  │  │  (RPC)  │  │  (CORE) │  │         │  │                 │    │
│  └─────────┘  └─────────┘  └────┬────┘  └─────────┘  └─────────────────┘    │
│                                 │                                           │
│              ┌──────────────────┼──────────────────┐                        │
│              │                  │                  │                        │
│         ┌────▼────┐       ┌─────▼─────┐      ┌─────▼─────┐                  │
│         │ Storage │       │   Jobs    │      │    PDF    │                  │
│         │Provider │       │  Provider │      │  Signing  │                  │
│         └────┬────┘       └─────┬─────┘      └─────┬─────┘                  │
│              │                  │                  │                        │
└──────────────┼──────────────────┼──────────────────┼────────────────────────┘
               │                  │                  │
        ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐
        │  Database   │    │   Inngest/  │    │ Google KMS/ │
        │     S3      │    │    Local    │    │    Local    │
        └─────────────┘    └─────────────┘    └─────────────┘
```

## Monorepo Structure

### Applications (`apps/`)

| Package                    | Description                                              | Port |
| -------------------------- | -------------------------------------------------------- | ---- |
| `@documenso/remix`         | Main application - React Router (Remix) with Hono server | 3000 |
| `@documenso/documentation` | Documentation site (Next.js + Nextra)                    | 3002 |
| `@documenso/openpage-api`  | Public analytics API                                     | 3003 |

### Core Packages (`packages/`)

| Package              | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `@documenso/lib`     | Core business logic (server-only, client-only, universal) |
| `@documenso/trpc`    | tRPC API layer with OpenAPI support (API V2)              |
| `@documenso/api`     | REST API layer using ts-rest (API V1)                     |
| `@documenso/prisma`  | Database layer (Prisma ORM + Kysely)                      |
| `@documenso/ui`      | UI component library (Shadcn + Radix + Tailwind)          |
| `@documenso/email`   | Email templates and mailer (React Email)                  |
| `@documenso/auth`    | Authentication (OAuth via Arctic, WebAuthn/Passkeys)      |
| `@documenso/signing` | PDF signing (Local P12, Google Cloud KMS)                 |
| `@documenso/ee`      | Enterprise Edition features                               |
| `@documenso/assets`  | Static assets                                             |

### Supporting Packages

| Package                      | Description               |
| ---------------------------- | ------------------------- |
| `@documenso/app-tests`       | E2E tests (Playwright)    |
| `@documenso/eslint-config`   | Shared ESLint config      |
| `@documenso/prettier-config` | Shared Prettier config    |
| `@documenso/tailwind-config` | Shared Tailwind config    |
| `@documenso/tsconfig`        | Shared TypeScript configs |

## Tech Stack

| Category | Technology                        |
| -------- | --------------------------------- |
| Frontend | React 18, React Router v7 (Remix) |
| Server   | Hono                              |
| Database | PostgreSQL 15, Prisma, Kysely     |
| API      | tRPC, ts-rest, OpenAPI            |
| Styling  | Tailwind CSS, Radix UI, Shadcn UI |
| Auth     | Arctic (OAuth), WebAuthn/Passkeys |
| Email    | React Email, Nodemailer           |
| Jobs     | Inngest / Local                   |
| Storage  | S3-compatible / Database          |
| PDF      | @libpdf/core, pdfjs-dist          |
| i18n     | Lingui                            |
| Build    | Turborepo, Vite                   |
| Testing  | Playwright                        |

## API Architecture

### API V1 (Deprecated)

- **Location**: `packages/api/v1/`
- **Framework**: ts-rest (contract-based REST)
- **Mount**: `/api/v1/*`
- **Auth**: API Token (Bearer header)
- **Status**: Deprecated but maintained

**Routes** (RESTful pattern):

- `GET/POST/DELETE /api/v1/documents/*`
- `GET/POST/DELETE /api/v1/templates/*`
- Recipients and fields nested under documents

### API V2 (Current)

- **Location**: `packages/trpc/server/`
- **Framework**: tRPC with trpc-to-openapi
- **Mount**: `/api/v2/*`, `/api/v2-beta/*`
- **Auth**: API Token or Session Cookie
- **Status**: Active

**Routes** (action-based pattern):

- `GET/POST /api/v2/document/*` - Document operations
- `GET/POST /api/v2/template/*` - Template operations
- `GET/POST /api/v2/envelope/*` - Envelope operations (multi-document)
- `GET/POST /api/v2/folder/*` - Folder management

**Route Organization**:

```
packages/trpc/server/
├── document-router/
│   ├── get-document.ts
│   ├── get-document.types.ts
│   └── ...
├── template-router/
├── envelope-router/
├── recipient-router/
├── field-router/
└── ...
```

### Internal tRPC API

- **Mount**: `/api/trpc/*`
- **Usage**: Frontend-to-backend communication
- **Auth**: Session-based

## Background Jobs

Jobs handle async operations like email sending, document sealing, and webhooks.

### Architecture

```
┌─────────────────┐     ┌───────────────────────────────────────┐
│ triggerJob()    │────▶│         Job Provider                  │
│                 │     │  ┌─────────────┬─────────────────┐    │
│ - name          │     │  │   Inngest   │      Local      │    │
│ - payload       │     │  │   (Cloud)   │   (Database)    │    │
└─────────────────┘     │  └─────────────┴─────────────────┘    │
                        │                │                      │
                        │                ▼                      │
                        │    ┌─────────────────────┐            │
                        │    │  Job Handler        │            │
                        │    │  (async processing) │            │
                        │    └─────────────────────┘            │
                        └───────────────────────────────────────┘
```

### Location

- `packages/lib/jobs/client/` - Provider implementations
- `packages/lib/jobs/definitions/` - Job definitions

### Job Types

**Email Jobs**:

- `send.signing.requested.email` - Signing invitation
- `send-confirmation-email` - Email verification
- `send-recipient-signed-email` - Notify on signature
- `send-rejection-emails` - Rejection notifications
- `send-document-cancelled-emails` - Cancellation notices

**Internal Jobs**:

- `internal.seal-document` - Finalize signed documents
- `internal.bulk-send-template` - Bulk document sending
- `internal.execute-webhook` - External webhook calls

## Swappable Providers

The codebase uses a **strategy pattern** with `ts-pattern` for provider selection via environment variables.

### Storage Provider

Handles file uploads and downloads.

| Provider | Description                          | Env Value  |
| -------- | ------------------------------------ | ---------- |
| Database | Store files as Base64 in DB          | `database` |
| S3       | S3-compatible storage (+ CloudFront) | `s3`       |

**Config**: `NEXT_PUBLIC_UPLOAD_TRANSPORT`

**Location**: `packages/lib/universal/upload/`

### PDF Signing Provider

Cryptographically signs PDF documents.

| Provider         | Description          | Env Value    |
| ---------------- | -------------------- | ------------ |
| Local            | P12 certificate file | `local`      |
| Google Cloud HSM | Google Cloud KMS     | `gcloud-hsm` |

**Config**: `NEXT_PRIVATE_SIGNING_TRANSPORT`

**Location**: `packages/signing/`

### Email Provider

Sends transactional emails.

| Provider     | Description                    | Env Value      |
| ------------ | ------------------------------ | -------------- |
| SMTP Auth    | Standard SMTP with credentials | `smtp-auth`    |
| SMTP API     | SMTP with API key              | `smtp-api`     |
| Resend       | Resend API                     | `resend`       |
| MailChannels | MailChannels API               | `mailchannels` |

**Config**: `NEXT_PRIVATE_SMTP_TRANSPORT`

**Location**: `packages/email/mailer.ts`

### Background Jobs Provider

Processes async jobs.

| Provider | Description           | Env Value         |
| -------- | --------------------- | ----------------- |
| Local    | Database-backed queue | `local` (default) |
| Inngest  | Managed cloud service | `inngest`         |

**Config**: `NEXT_PRIVATE_JOBS_PROVIDER`

**Location**: `packages/lib/jobs/client/`

## Request Flow

### Web Application Request

```
Browser
   │
   ▼
Hono Server (apps/remix/server/)
   │
   ├──▶ /api/v1/* ──▶ ts-rest handlers (packages/api/)
   │
   ├──▶ /api/v2/* ──▶ tRPC OpenAPI handlers (packages/trpc/)
   │
   ├──▶ /api/trpc/* ──▶ tRPC handlers (packages/trpc/)
   │
   ├──▶ /api/jobs/* ──▶ Job handlers (packages/lib/jobs/)
   │
   └──▶ /* ──▶ React Router (apps/remix/app/routes/)
                    │
                    ▼
              React Components (packages/ui/)
```

### Document Signing Flow

```
1. Upload Document ──▶ Storage Provider (DB/S3)
                                  │
2. Add Recipients ────────────────┤
                                  │
3. Add Fields ────────────────────┤
                                  │
4. Send Document ─────────────────┤
       │                          │
       ▼                          │
   Email Job ──▶ Email Provider   |
       │                          |
5. Recipient Signs ───────────────┤
       │                          │
       ▼                          │
   seal-document Job              │
       │                          │
       ▼                          │
   Signing Provider ◀─────────────┘
       │
       ▼
   Signed PDF ──▶ Storage Provider
```

## Key Directories

```
documenso/
├── apps/
│   └── remix/
│       ├── app/
│       │   └── routes/           # React Router routes
│       │       ├── _authenticated+/  # Protected routes
│       │       ├── _unauthenticated+/  # Public routes
│       │       └── _recipient+/  # Signing routes
│       └── server/
│           ├── router.ts         # Hono route mounting
│           └── main.js           # Entry point
├── packages/
│   ├── api/v1/                   # API V1 (ts-rest)
│   ├── trpc/server/              # API V2 + Internal (tRPC)
│   ├── lib/
│   │   ├── server-only/          # Server business logic
│   │   ├── client-only/          # Client utilities
│   │   ├── universal/            # Shared code
│   │   └── jobs/                 # Background jobs
│   ├── prisma/                   # Database schema & client
│   ├── signing/                  # PDF signing
│   ├── email/                    # Email templates
│   └── ui/                       # Component library
└── docker/                       # Docker configs
```

## Development

```bash
# Full setup (install, docker, migrate, seed, dev)
pnpm run d

# Start development server
pnpm run dev

# Database GUI
pnpm run prisma:studio

# Type checking (faster than build)
pnpm exec tsc --noEmit

# E2E tests
pnpm run test:e2e
```

### Docker Services (Development)

| Service         | Port       |
| --------------- | ---------- |
| PostgreSQL      | 54320      |
| Inbucket (Mail) | 9000       |
| MinIO (S3)      | 9001, 9002 |

## Environment Variables Summary

| Variable                         | Purpose          | Options                                           |
| -------------------------------- | ---------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_UPLOAD_TRANSPORT`   | Storage provider | `database`, `s3`                                  |
| `NEXT_PRIVATE_SIGNING_TRANSPORT` | Signing provider | `local`, `gcloud-hsm`                             |
| `NEXT_PRIVATE_SMTP_TRANSPORT`    | Email provider   | `smtp-auth`, `smtp-api`, `resend`, `mailchannels` |
| `NEXT_PRIVATE_JOBS_PROVIDER`     | Jobs provider    | `local`, `inngest`                                |

See `.env.example` for the complete list of configuration options.
