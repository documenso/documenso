#!/usr/bin/env bash

# Install dependencies
npm install

# Copy the env file
cp .env.example .env

# Run the dev setup
npm run dx
