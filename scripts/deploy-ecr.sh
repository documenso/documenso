#!/usr/bin/env bash

# Exit on error.
set -eo pipefail

# If getting permission errors, run `sudo chown -R $(whoami) /workspaces/documenso`
# If getting docker store errors, run `nano ~/.docker/config.json` and remove credsStore

if ! command aws --version &> /dev/null; then

    # Install dependencies
    sudo apt update && sudo apt install -y curl unzip

    # Download and install AWS CLI v2
    sudo curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    sudo unzip awscliv2.zip
    sudo ./aws/install

    # Clean up
    rm -rf awscliv2.zip aws

    # Verify installation
    echo "AWS cli is installed with version: $(aws --version)"
fi

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../")"
CI_COMMIT_SHORT_SHA="$(git rev-parse --short HEAD)"

echo "Building Documenso webapp!"

npm run prisma:generate
npm run prisma:migrate-deploy

npm run build

# ECR is in production only, so use prod credentials

aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 806620123734.dkr.ecr.us-west-2.amazonaws.com
docker buildx build \
    -f "$SCRIPT_DIR/../docker/Dockerfile" \
    -t "sunrebel/documenso" \
    -t "806620123734.dkr.ecr.us-west-2.amazonaws.com/sunrebel/documenso:$CI_COMMIT_SHORT_SHA" \
    "$MONOREPO_ROOT"
    
docker tag sunrebel/documenso:latest 806620123734.dkr.ecr.us-west-2.amazonaws.com/sunrebel/documenso:latest
docker push 806620123734.dkr.ecr.us-west-2.amazonaws.com/sunrebel/documenso:$CI_COMMIT_SHORT_SHA