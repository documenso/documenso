.PHONY: help setup dev quick-dev build test lint format clean docker-build docker-run docker-test docker-compose-up docker-compose-down prisma-generate prisma-migrate prisma-seed prisma-studio start

# Default target when just running `make`
help:
	@echo "Documenso Development Makefile"
	@echo ""
	@echo "Available commands:"
	@echo "  make setup              - Install dependencies and set up development environment"
	@echo "  make dev                - Start development server"
	@echo "  make quick-dev          - Quick start development (setup + start)"
	@echo "  make build              - Build the application"
	@echo "  make test               - Run tests"
	@echo "  make lint               - Run linting"
	@echo "  make format             - Format code"
	@echo "  make clean              - Clean build artifacts and node_modules"
	@echo "  make docker-build       - Build Docker image"
	@echo "  make docker-run         - Run Docker container"
	@echo "  make docker-test        - Test Docker container"
	@echo "  make docker-compose-up  - Start all Docker Compose services"
	@echo "  make docker-compose-down - Stop all Docker Compose services"
	@echo "  make prisma-generate    - Generate Prisma client"
	@echo "  make prisma-migrate     - Run Prisma migrations"
	@echo "  make prisma-seed        - Seed the database"
	@echo "  make prisma-studio      - Start Prisma Studio"
	@echo "  make start              - Start production server"
	@echo "  make dev-setup          - Full development setup (database, dependencies, migrations, seed)"
	@echo "  make e2e                - Run E2E tests"
	@echo "  make deploy             - Deploy the application"

# Setup development environment
setup:
	@echo "Setting up development environment..."
	cp -n .env.example .env || true
	bun install
	@echo "Setup complete. You may want to run 'make prisma-migrate' and 'make prisma-seed' next."

# Start development server
dev:
	@echo "Starting development server..."
	bun run dev

# Quick start development
quick-dev:
	@echo "Quick starting development..."
	bun run d

# Build the application
build:
	@echo "Building application..."
	bun run build

# Run tests
test:
	@echo "Running tests..."
	bun run ci

# Run linting
lint:
	@echo "Running linter..."
	bun run lint

# Format code
format:
	@echo "Formatting code..."
	bun run format

# Clean build artifacts and node_modules
clean:
	@echo "Cleaning build artifacts and node_modules..."
	bun run clean

# Build Docker image
docker-build:
	@echo "Building Docker image..."
	docker build -t documenso:latest -f ./docker/Dockerfile .

# Run Docker container
docker-run:
	@echo "Running Docker container..."
	docker run -p 3000:3000 --env-file .env documenso:latest

# Test Docker container
docker-test:
	@echo "Testing Docker container..."
	docker build -t documenso:test -f ./docker/Dockerfile .
	@echo "Checking if the container can start..."
	docker run --name documenso-test -d -p 3001:3000 --env-file .env documenso:test
	@echo "Waiting for container to initialize (10 seconds)..."
	sleep 10
	@echo "Testing HTTP connection to container..."
	curl -f http://localhost:3001/api/health || (docker logs documenso-test && docker rm -f documenso-test && exit 1)
	@echo "Container test successful"
	docker rm -f documenso-test

# Start all services with Docker Compose
docker-compose-up:
	@echo "Starting all services with Docker Compose..."
	docker compose -f docker/development/compose.yml up -d

# Stop all services with Docker Compose
docker-compose-down:
	@echo "Stopping all services with Docker Compose..."
	docker compose -f docker/development/compose.yml down

# Generate Prisma client
prisma-generate:
	@echo "Generating Prisma client..."
	bun run prisma:generate

# Run Prisma migrations
prisma-migrate:
	@echo "Running Prisma migrations..."
	bun run prisma:migrate-dev

# Seed the database
prisma-seed:
	@echo "Seeding database..."
	bun run prisma:seed

# Start Prisma Studio
prisma-studio:
	@echo "Starting Prisma Studio..."
	bun run prisma:studio

# Start containers for development
dev-containers:
	@echo "Starting development containers..."
	bun run dx:up

# Stop containers for development
dev-containers-stop:
	@echo "Stopping development containers..."
	bun run dx:down

# Start production server
start:
	@echo "Starting production server..."
	bun run start

# Full development setup (database, dependencies, migrations, seed)
dev-setup: dev-containers setup prisma-generate prisma-migrate prisma-seed
	@echo "Development environment fully set up and ready"

# Run E2E tests
e2e:
	@echo "Running E2E tests..."
	bun run test:e2e

# Deploy the application (example for self-hosted)
deploy: build
	@echo "Deploying application..."
	bun run prisma:migrate-deploy
	bun run start
