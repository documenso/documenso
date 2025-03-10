#!/usr/bin/env bash

# Exit on error.
set -eo pipefail

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../")"
CI_COMMIT_SHORT_SHA="$(git rev-parse --short HEAD)"

echo "Building Documenso webapp!"

npm run prisma:generate
npm run prisma:migrate-deploy

npm run build

# Install dependencies
sudo apt-get update && apt-get install -y curl unzip

# Download and install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Clean up
rm -rf awscliv2.zip aws

# Verify installation
aws --version

# ECR is in production only, so use prod credentials

aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 806620123734.dkr.ecr.us-west-2.amazonaws.com
docker buildx build \
    -f "$SCRIPT_DIR/../docker/Dockerfile" \
    -t "sunrebel/documenso" \
    -t "806620123734.dkr.ecr.us-west-2.amazonaws.com/sunrebel/documenso:$CI_COMMIT_SHORT_SHA" \
    "$MONOREPO_ROOT"
    
docker tag sunrebel/documenso:latest 806620123734.dkr.ecr.us-west-2.amazonaws.com/sunrebel/documenso:latest
docker push 806620123734.dkr.ecr.us-west-2.amazonaws.com/sunrebel/documenso:$CI_COMMIT_SHORT_SHA