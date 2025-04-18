# Documenso Makefile Usage

This document explains how to use the Makefile provided in this repository to simplify development tasks.

## Getting Started

The Makefile provides shortcuts for common development tasks. To see all available commands, run:

```sh
make
# or
make help
```

## Setting Up Development Environment

To set up your development environment, run:

```sh
make dev-setup
```

This will:

1. Start development containers (PostgreSQL and Inbucket)
2. Install dependencies with Bun
3. Generate Prisma client
4. Run database migrations
5. Seed the database

If you just want to install dependencies without starting containers:

```sh
make setup
```

## Development Commands

To start the development server:

```sh
make dev
```

For a quicker start (if you've already set up everything):

```sh
make quick-dev
```

## Building and Testing

To build the application:

```sh
make build
```

To run tests:

```sh
make test
```

For E2E tests specifically:

```sh
make e2e
```

For linting:

```sh
make lint
```

For formatting code:

```sh
make format
```

## Docker Commands

To build the Docker image:

```sh
make docker-build
```

To run the application in a Docker container:

```sh
make docker-run
```

To test if the Docker container works properly:

```sh
make docker-test
```

To start all Docker Compose services:

```sh
make docker-compose-up
```

To stop all Docker Compose services:

```sh
make docker-compose-down
```

## Database Commands

Generate Prisma client:

```sh
make prisma-generate
```

Run database migrations:

```sh
make prisma-migrate
```

Seed the database:

```sh
make prisma-seed
```

Start Prisma Studio (database GUI):

```sh
make prisma-studio
```

## Production Commands

To deploy the application (self-hosted):

```sh
make deploy
```

To start the production server:

```sh
make start
```

## Cleaning Up

To clean build artifacts and node_modules:

```sh
make clean
```

---

The Makefile is designed to simplify development workflows and provide consistent commands across different development environments. It wraps around the Bun scripts defined in package.json, providing a more user-friendly interface.
