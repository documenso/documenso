# Keep Contracts

Simple, secure document signing for DataThink's internal teams and products.

Keep Contracts is a white-labeled, self-hosted document signing service built on top of [Documenso](https://documenso.com) (v2.11.0) and maintained by [DataThink](https://datathink.dev).

## About

Keep Contracts powers document signing workflows across DataThink's products. It is not a public SaaS product; accounts are provisioned by DataThink admins.

Documents are sent and managed via API. End recipients (contractors, parents, etc.) sign through a standard signing link without needing a Keep Contracts account.

## Tech Stack

- [TypeScript](https://www.typescriptlang.org/) — Language
- [React Router v7](https://reactrouter.com/) — Framework
- [Prisma](https://www.prisma.io/) — ORM
- [PostgreSQL](https://www.postgresql.org/) — Database
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [shadcn/ui](https://ui.shadcn.com/) — Component library
- [react-email](https://react.email/) — Email templates
- [tRPC](https://trpc.io/) — API layer
- [Turborepo](https://turbo.build/) — Monorepo build system

## Local Development

### Requirements

- Node.js v22+
- Docker and Docker Compose

### Quickstart

1. Clone the repo and copy the env file:

```sh
cp .env.example .env
```

2. Start the database, mail catcher, and S3-compatible storage:

```sh
npm run dx
```

3. Start the dev server:

```sh
npm run dev
```

Or run both at once:

```sh
npm run d
```

### Local Access Points

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Email (Inbucket) | http://localhost:9000 |
| S3 dashboard (MinIO) | http://localhost:9001 |
| Database | `postgres://keepcontracts:password@127.0.0.1:54320/keepcontracts` |

### Test Login

```
Email:    example@keepcontracts.com
Password: password
```

### Email

Locally, all outgoing email is captured by [Inbucket](https://inbucket.org/) at http://localhost:9000. No real emails are sent.

SMTP credentials in `.env` point to `127.0.0.1:2500`, which is the Inbucket container.

### Seeding

To reset and reseed the local database with sample data:

```sh
npm run prisma:seed
```

## Upstream

This project is a fork of [documenso/documenso](https://github.com/documenso/documenso) at v2.11.0, licensed under AGPLv3. Upstream documentation is available at [docs.documenso.com](https://docs.documenso.com).

## Support

Internal support: [mangelsona@datathink.dev](mailto:mangelsona@datathink.dev)
