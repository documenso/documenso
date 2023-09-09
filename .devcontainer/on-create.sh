#!/usr/bin/env bash

# Start the database and mailserver
docker compose -f ./docker/compose-without-app.yml up -d

# Install dependencies
npm install

# Copy the env file
cp .env.example .env

# Source the env file, export the variables
set -a
source .env
set +a

# Run the migrations
npm run -w @documenso/prisma prisma:migrate-dev

# Start the app
npm run dev
