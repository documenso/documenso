# Architecture

```mermaid
graph LR
    subgraph Documenso_Container["Documenso Container (docker-compose, node)"]
        subgraph Web_Application["Web Application (TypeScript, React Router, Hono)"]
            Web_Application_Hono_Server["Hono Server"]
            Web_Application_React_Router_UI["React Router UI"]
            Web_Application_Client_Providers["Client Providers"]
        end
        subgraph REST_API_V1["REST API V1 (TypeScript, ts-rest, Hono)"]
            REST_API_V1_V1_Contracts["V1 Contracts"]
        end
        subgraph tRPC_API["tRPC API (TypeScript, tRPC, OpenAPI)"]
            tRPC_API_Server_Routers["Server Routers"]
            tRPC_API_React_Client["React Client"]
            tRPC_API_Standalone_Client["Standalone Client"]
        end
        subgraph Core_Library["Core Library (TypeScript)"]
            Core_Library_Server_Logic["Server Logic"]
            Core_Library_Client_Utilities["Client Utilities"]
            Core_Library_Universal_Helpers["Universal Helpers"]
            Core_Library_Background_Jobs["Background Jobs"]
            Core_Library_Schemas_and_Types["Schemas and Types"]
        end
        Email_Templates["Email Templates (TypeScript, React Email, Nodemailer)"]
        Authentication["Authentication (TypeScript, Arctic, WebAuthn)"]
        subgraph PDF_Signing["PDF Signing (TypeScript)"]
            PDF_Signing_Signing_Transports["Signing Transports"]
            PDF_Signing_Signing_Helpers["Signing Helpers"]
        end
        Enterprise_Features["Enterprise Features (TypeScript)"]
    end
    subgraph PostgreSQL_Container["PostgreSQL Container (docker-compose, postgres-15)"]
        Database["Database (TypeScript, Prisma, Kysely)"]
    end
    Documentation_Site["Documentation Site (TypeScript, Next.js, Nextra)"]
    Public_Analytics_API["Public Analytics API (TypeScript, Node)"]
    UI_Components["UI Components (TypeScript, React, Tailwind, Radix)"]
    Static_Assets["Static Assets (TypeScript)"]
    E2E_Tests["E2E Tests (TypeScript, Playwright)"]

    PostgreSQL[("PostgreSQL")]
    Object_Storage[("Object Storage")]
    Job_Queue[("Job Queue")]
    Google_Cloud_KMS[("Google Cloud KMS")]
    Google_OAuth[("Google OAuth")]
    Stripe[("Stripe")]
    Resend[("Resend")]
    MailChannels[("MailChannels")]
    SMTP_Provider[("SMTP Provider")]
    PostHog[("PostHog")]

    Web_Application --> REST_API_V1
    Web_Application --> tRPC_API
    Web_Application --> Core_Library
    Web_Application --> UI_Components
    Web_Application --> Authentication
    Web_Application --> Email_Templates
    Web_Application --> Database
    Web_Application --> Enterprise_Features
    Public_Analytics_API --> Database
    REST_API_V1 --> Core_Library
    REST_API_V1 --> Database
    REST_API_V1 --> Authentication
    tRPC_API --> Core_Library
    tRPC_API --> Database
    tRPC_API --> Authentication
    tRPC_API --> Enterprise_Features
    Core_Library --> Database
    Core_Library --> Email_Templates
    Core_Library --> PDF_Signing
    Core_Library --> Object_Storage
    Core_Library --> Job_Queue
    Core_Library --> Stripe
    Core_Library --> PostHog
    Database --> PostgreSQL
    Email_Templates --> Resend
    Email_Templates --> MailChannels
    Email_Templates --> SMTP_Provider
    Authentication --> Database
    Authentication --> Google_OAuth
    PDF_Signing --> Google_Cloud_KMS
    Enterprise_Features --> Core_Library
    Enterprise_Features --> Database
    E2E_Tests --> Web_Application

    classDef external fill:#1e1b2e,stroke:#a78bfa,stroke-width:1px,color:#c4b5fd
    class PostgreSQL external
    class Object_Storage external
    class Job_Queue external
    class Google_Cloud_KMS external
    class Google_OAuth external
    class Stripe external
    class Resend external
    class MailChannels external
    class SMTP_Provider external
    class PostHog external
```

---

### Web Application `TypeScript, React Router, Hono`

Main user-facing web app and HTTP server that mounts every API surface and serves the React UI.

**Path:** `apps/remix`

**Depends on:** REST API V1, tRPC API, Core Library, UI Components, Authentication, Email Templates, Database, Enterprise Features

- **Hono Server** — Hono entry point that wires routing, middleware, and mounts api/trpc/jobs handlers.
- **React Router UI** — File-based React Router routes for authenticated, public, and recipient-signing pages.
- **Client Providers** — Top-level React providers for auth, theming, i18n, and tRPC client wiring.

### Documentation Site `TypeScript, Next.js, Nextra`

Standalone documentation portal for product and developer guides.

**Path:** `apps/docs`


### Public Analytics API `TypeScript, Node`

Publicly exposed API that serves aggregate analytics for the openpage marketing surface.

**Path:** `apps/openpage-api`

**Depends on:** Database


### REST API V1 `TypeScript, ts-rest, Hono`

Deprecated but maintained REST API for documents, templates, recipients, and fields under /api/v1.

**Path:** `packages/api`

**Depends on:** Core Library, Database, Authentication

- **V1 Contracts** — ts-rest contract definitions, handlers, and Zod schemas for the legacy REST surface.

### tRPC API `TypeScript, tRPC, OpenAPI`

Internal tRPC API and public V2 OpenAPI surface covering documents, templates, envelopes, folders, and admin.

**Path:** `packages/trpc`

**Depends on:** Core Library, Database, Authentication, Enterprise Features

- **Server Routers** — Domain routers (document, template, envelope, recipient, field, etc.) exposed via tRPC and OpenAPI.
- **React Client** — React Query bindings used by the frontend to consume internal tRPC procedures.
- **Standalone Client** — Plain tRPC client for non-React consumers and server-to-server calls.

### Core Library `TypeScript`

Shared business logic, background jobs, schemas, and provider strategies used by every server surface.

**Path:** `packages/lib`

**Depends on:** Database, Email Templates, PDF Signing, Object Storage, Job Queue, Stripe, PostHog

- **Server Logic** — Server-only domain functions for documents, recipients, billing, webhooks, and admin actions.
- **Client Utilities** — Browser-safe helpers, hooks, and constants consumed by the React UI.
- **Universal Helpers** — Isomorphic utilities including upload abstractions, validation, and crypto-safe helpers.
- **Background Jobs** — Job definitions and pluggable provider clients for Local, BullMQ, and Inngest queues.
- **Schemas and Types** — Shared Zod schemas and TypeScript types reused across API and UI layers.

### Database `TypeScript, Prisma, Kysely`

Prisma schema, generated client, migrations, and Kysely query builder for PostgreSQL access.

**Path:** `packages/prisma`

**Depends on:** PostgreSQL


### UI Components `TypeScript, React, Tailwind, Radix`

Shared component library built on Shadcn and Radix primitives styled with Tailwind.

**Path:** `packages/ui`


### Email Templates `TypeScript, React Email, Nodemailer`

React Email templates and the swappable mailer that dispatches via SMTP, Resend, or MailChannels.

**Path:** `packages/email`

**Depends on:** Resend, MailChannels, SMTP Provider


### Authentication `TypeScript, Arctic, WebAuthn`

Session, OAuth (Arctic), and passkey/WebAuthn authentication flows shared across server entry points.

**Path:** `packages/auth`

**Depends on:** Database, Google OAuth


### PDF Signing `TypeScript`

Cryptographic PDF signing with swappable Local P12 and Google Cloud HSM transports.

**Path:** `packages/signing`

**Depends on:** Google Cloud KMS

- **Signing Transports** — Provider implementations for local P12 certificates and Google Cloud HSM-backed signing.
- **Signing Helpers** — PDF preparation utilities, timestamp authority calls, and signature placement helpers.

### Enterprise Features `TypeScript`

Server-only Enterprise Edition features layered on top of the core platform under a separate license.

**Path:** `packages/ee`

**Depends on:** Core Library, Database


### Static Assets `TypeScript`

Shared static images, fonts, and brand assets bundled into apps and emails.

**Path:** `packages/assets`


### E2E Tests `TypeScript, Playwright`

Playwright end-to-end test suite that exercises the running web application.

**Path:** `packages/app-tests`

**Depends on:** Web Application


---

## Deployment

```mermaid
graph TB
    subgraph Documenso_Container["Documenso Container (docker-compose, node)"]
        Documenso_Container_Web_Application["Web Application"]
        Documenso_Container_REST_API_V1["REST API V1"]
        Documenso_Container_tRPC_API["tRPC API"]
        Documenso_Container_Core_Library["Core Library"]
        Documenso_Container_Authentication["Authentication"]
        Documenso_Container_PDF_Signing["PDF Signing"]
        Documenso_Container_Email_Templates["Email Templates"]
        Documenso_Container_Enterprise_Features["Enterprise Features"]
    end
    subgraph PostgreSQL_Container["PostgreSQL Container (docker-compose, postgres-15)"]
        PostgreSQL_Container_Database["Database"]
    end
    subgraph Redis_Container["Redis Container (docker-compose, redis-8)"]
        Redis_Container_Job_Queue["Job Queue"]
    end
    subgraph MinIO_Container["MinIO Container (docker-compose, minio)"]
        MinIO_Container_Object_Storage["Object Storage"]
    end
    subgraph Inbucket_Container["Inbucket Container (docker-compose, inbucket)"]
        Inbucket_Container_SMTP_Provider["SMTP Provider"]
    end

    Documenso_Container --> PostgreSQL_Container

    classDef infra fill:#0d1f17,stroke:#10b981,stroke-width:1px,color:#6ee7b7
```

**Documenso Container** `docker-compose, node`
: Single Node container running the Remix/Hono app image that serves UI, APIs, and job handlers.
  Hosts: Web Application, REST API V1, tRPC API, Core Library, Authentication, PDF Signing, Email Templates, Enterprise Features
  Depends on: PostgreSQL Container

**PostgreSQL Container** `docker-compose, postgres-15`
: Postgres 15 container with a persistent volume that backs the Documenso database.
  Hosts: Database

**Redis Container** `docker-compose, redis-8`
: Development Redis instance available to back the BullMQ jobs provider and caching needs.
  Hosts: Job Queue

**MinIO Container** `docker-compose, minio`
: Development S3-compatible object store used when NEXT_PUBLIC_UPLOAD_TRANSPORT is set to s3.
  Hosts: Object Storage

**Inbucket Container** `docker-compose, inbucket`
: Development SMTP/IMAP catcher that captures outbound mail for local testing.
  Hosts: SMTP Provider
