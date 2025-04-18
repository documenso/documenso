#!/usr/bin/env bash

# Install dependencies
bun install

# Copy the env file
cp .env.example .env

# Run the dev setup
bun run dx
