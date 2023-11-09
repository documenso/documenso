#!/usr/bin/env bash

# Start the database and mailserver
docker compose -f ./docker/compose-without-app.yml up -d

# Install dependencies
npm install

# Copy the env file
cp .env.example .env

# Run the migrations
npm run prisma:migrate-dev
