# Davinci Sign - Architecture Documentation

This document provides a high-level overview of the Davinci Sign codebase to help humans and agents understand how the application is structured.

## Overview

Davinci Sign is an electronic document signing platform rebranded from the open-source Documenso project. It is built as a **monorepo** using npm workspaces and Turborepo. The application enables users to create, send, and sign documents electronically.

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

### API V2 (Current)

- **Location**: `packages/trpc/server/`
- **Framework**: tRPC with trpc-to-openapi
- **Mount**: `/api/v2/*`, `/api/v2-beta/*`
- **Auth**: API Token or Session Cookie
- **Status**: Active

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

## Key Directories

```
davinci-sign/
├── apps/
│   ├── remix/              # Main application (React Router 7 + Hono)
│   ├── documentation/      # Nextra-based docs site
│   └── openpage-api/       # Public API service
├── packages/
│   ├── api/                # ts-rest API definitions
│   ├── app-tests/          # Playwright E2E tests
│   ├── assets/             # Logo, favicon, brand images
│   ├── auth/               # Authentication utilities
│   ├── ee/                 # Enterprise Edition features
│   ├── email/              # react-email templates
│   ├── lib/                # Shared business logic & utilities
│   ├── prisma/             # Database schema & migrations
│   ├── signing/            # PDF signing transports
│   ├── trpc/               # tRPC router definitions
│   └── ui/                 # shadcn/ui component library
└── docker/                 # Docker configs
```

## Development

```bash
# Full setup (install, docker, migrate, seed, dev)
npm run d

# Start development server
npm run dev

# Database GUI
npm run prisma:studio
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
