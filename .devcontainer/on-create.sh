#!/usr/bin/env bash

<<<<<<< HEAD
# Start the database and mailserver
docker compose -f ./docker/compose-without-app.yml up -d

=======
>>>>>>> main
# Install dependencies
npm install

# Copy the env file
cp .env.example .env

<<<<<<< HEAD
# Run the migrations
npm run prisma:migrate-dev
=======
# Run the dev setup
npm run dx
>>>>>>> main
