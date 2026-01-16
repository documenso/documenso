#!/usr/bin/env bash

# Script to build Documenso Docker image locally and push to GitHub Container Registry or save for VPS transfer
# Usage: ./docker/build-for-vps.sh [--push] [--no-save] [image-tag] [output-file]
#   --push: Push to GitHub Container Registry (ghcr.io/justx/justx-signature)
#   --no-save: Skip saving to tar.gz file

set -e

command -v docker >/dev/null 2>&1 || {
    echo "Error: Docker is not installed or not running. Please install Docker and try again."
    exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# GitHub Container Registry settings
GHCR_ORG="justx"
GHCR_REPO="justx-signature"
GHCR_REGISTRY="ghcr.io"
GHCR_FULL="${GHCR_REGISTRY}/${GHCR_ORG}/${GHCR_REPO}"

# Parse arguments
PUSH_TO_REGISTRY=false
SAVE_TO_FILE=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --push)
            PUSH_TO_REGISTRY=true
            shift
            ;;
        --no-save)
            SAVE_TO_FILE=false
            shift
            ;;
        *)
            if [ -z "$IMAGE_TAG" ]; then
                IMAGE_TAG="$1"
            elif [ -z "$OUTPUT_FILE" ]; then
                OUTPUT_FILE="$1"
            fi
            shift
            ;;
    esac
done

# Default values
IMAGE_TAG="${IMAGE_TAG:-documenso:vps}"
OUTPUT_FILE="${OUTPUT_FILE:-documenso-vps.tar.gz}"

# Get Git information for tagging
GIT_SHA="$(git -C "$MONOREPO_ROOT" rev-parse HEAD 2>/dev/null || echo 'unknown')"
APP_VERSION="$(git -C "$MONOREPO_ROOT" name-rev --tags --name-only "$GIT_SHA" 2>/dev/null | head -n 1 | sed 's/\^0//' || echo 'unknown')"

echo "=========================================="
echo "Building Documenso for VPS Deployment"
echo "=========================================="
echo "Monorepo root: $MONOREPO_ROOT"
echo "Image tag: $IMAGE_TAG"
echo "Push to registry: $PUSH_TO_REGISTRY"
if [ "$PUSH_TO_REGISTRY" = true ]; then
    echo "Registry: $GHCR_FULL"
fi
echo "Save to file: $SAVE_TO_FILE"
if [ "$SAVE_TO_FILE" = true ]; then
    echo "Output file: $OUTPUT_FILE"
fi
echo "Git SHA: $GIT_SHA"
echo "App version: $APP_VERSION"
echo "=========================================="
echo ""

# Determine if we need buildx (for cross-platform or pushing)
NEED_BUILDX=false
PLATFORM=""

# Ask about platform if on macOS or if pushing to registry
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [ "$PUSH_TO_REGISTRY" = false ]; then
        echo "Detected macOS. Do you want to build for Linux amd64? (recommended for most VPS)"
        echo "This will use docker buildx for cross-platform builds."
        read -p "Build for linux/amd64? [Y/n]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            NEED_BUILDX=true
            PLATFORM="linux/amd64"
        fi
    else
        # When pushing, we should build for linux/amd64 on macOS
        NEED_BUILDX=true
        PLATFORM="linux/amd64"
        echo "Detected macOS. Will build for linux/amd64 for VPS deployment."
    fi
elif [ "$PUSH_TO_REGISTRY" = true ]; then
    # Even on Linux, use buildx when pushing to ensure compatibility
    NEED_BUILDX=true
    PLATFORM="linux/amd64"
fi

USE_BUILDX=$NEED_BUILDX

# Handle GitHub Container Registry authentication if pushing
if [ "$PUSH_TO_REGISTRY" = true ]; then
    echo ""
    echo "Authenticating with GitHub Container Registry..."
    echo "You need a GitHub Personal Access Token (PAT) with 'write:packages' permission."
    echo "Get one at: https://github.com/settings/tokens/new?scopes=write:packages"
    echo ""
    
    # Check if already logged in by inspecting Docker config
    if ! grep -q "${GHCR_REGISTRY}" ~/.docker/config.json 2>/dev/null; then
        # Try using GITHUB_TOKEN environment variable if set
        if [ -z "$GITHUB_TOKEN" ]; then
            read -sp "Enter your GitHub Personal Access Token: " GITHUB_TOKEN
            echo ""
        fi
        
        if [ -z "$GITHUB_TOKEN" ]; then
            echo "Error: GitHub token is required to push to registry."
            echo "Set GITHUB_TOKEN environment variable or enter it when prompted."
            exit 1
        fi
        
        # Login to GitHub Container Registry
        # Use your GitHub username, not org name for login
        if [ -z "$GITHUB_USERNAME" ]; then
            read -p "Enter your GitHub username: " GITHUB_USERNAME
        fi
        
        echo "$GITHUB_TOKEN" | docker login "${GHCR_REGISTRY}" -u "${GITHUB_USERNAME}" --password-stdin
        
        if [ $? -ne 0 ]; then
            echo "Error: Failed to authenticate with GitHub Container Registry."
            exit 1
        fi
        
        echo "Successfully authenticated with GitHub Container Registry."
    else
        echo "Already authenticated with GitHub Container Registry."
    fi
fi

# Check if buildx is available and set up
if [ "$USE_BUILDX" = true ]; then
    if ! command -v docker buildx &> /dev/null; then
        echo "Error: docker buildx is required for cross-platform builds but not found."
        exit 1
    fi
    
    # Check if buildx builder exists, create if not
    if ! docker buildx ls | grep -q multiarch 2>/dev/null; then
        echo "Creating buildx builder instance..."
        docker buildx create --name multiarch --use 2>/dev/null || true
    fi
    
    # Use the multiarch builder
    docker buildx use multiarch 2>/dev/null || true
fi

echo ""
echo "Building Docker image..."
echo ""

# Build tags - include registry tag if pushing
BUILD_TAGS=(-t "$IMAGE_TAG")

if [ "$PUSH_TO_REGISTRY" = true ]; then
    # Add registry tags
    BUILD_TAGS+=(
        -t "${GHCR_FULL}:latest"
        -t "${GHCR_FULL}:${GIT_SHA}"
    )
    
    if [ "$APP_VERSION" != "unknown" ] && [ "$APP_VERSION" != "undefined" ]; then
        BUILD_TAGS+=(-t "${GHCR_FULL}:${APP_VERSION}")
    fi
    
    echo "Will tag image as: ${BUILD_TAGS[*]}"
fi

# Build the image
if [ "$USE_BUILDX" = true ]; then
    if [ "$PUSH_TO_REGISTRY" = true ]; then
        # Build with all tags first (loads locally)
        docker buildx build \
            --platform="$PLATFORM" \
            -f "$SCRIPT_DIR/Dockerfile" \
            --progress=plain \
            --build-arg NEXT_PRIVATE_TELEMETRY_KEY="${NEXT_PRIVATE_TELEMETRY_KEY:-}" \
            --build-arg NEXT_PRIVATE_TELEMETRY_HOST="${NEXT_PRIVATE_TELEMETRY_HOST:-}" \
            "${BUILD_TAGS[@]}" \
            --load \
            "$MONOREPO_ROOT"
        
        # Push only the registry tags (not the local documenso:vps tag)
        echo ""
        echo "Pushing images to GitHub Container Registry..."
        docker push "${GHCR_FULL}:latest"
        docker push "${GHCR_FULL}:${GIT_SHA}"
        if [ "$APP_VERSION" != "unknown" ] && [ "$APP_VERSION" != "undefined" ]; then
            docker push "${GHCR_FULL}:${APP_VERSION}"
        fi
        
        # If we also need to save, we need to load it locally first
        if [ "$SAVE_TO_FILE" = true ]; then
            echo ""
            echo "Note: Pushed to registry. Loading locally for save..."
            docker buildx build \
                --platform="$PLATFORM" \
                -f "$SCRIPT_DIR/Dockerfile" \
                --progress=plain \
                --build-arg NEXT_PRIVATE_TELEMETRY_KEY="${NEXT_PRIVATE_TELEMETRY_KEY:-}" \
                --build-arg NEXT_PRIVATE_TELEMETRY_HOST="${NEXT_PRIVATE_TELEMETRY_HOST:-}" \
                -t "$IMAGE_TAG" \
                --load \
                "$MONOREPO_ROOT"
        fi
    else
        # Build and load locally only
        docker buildx build \
            --platform="$PLATFORM" \
            -f "$SCRIPT_DIR/Dockerfile" \
            --progress=plain \
            --build-arg NEXT_PRIVATE_TELEMETRY_KEY="${NEXT_PRIVATE_TELEMETRY_KEY:-}" \
            --build-arg NEXT_PRIVATE_TELEMETRY_HOST="${NEXT_PRIVATE_TELEMETRY_HOST:-}" \
            -t "$IMAGE_TAG" \
            --load \
            "$MONOREPO_ROOT"
    fi
else
    docker build \
        -f "$SCRIPT_DIR/Dockerfile" \
        --progress=plain \
        --build-arg NEXT_PRIVATE_TELEMETRY_KEY="${NEXT_PRIVATE_TELEMETRY_KEY:-}" \
        --build-arg NEXT_PRIVATE_TELEMETRY_HOST="${NEXT_PRIVATE_TELEMETRY_HOST:-}" \
        "${BUILD_TAGS[@]}" \
        "$MONOREPO_ROOT"
fi

if [ $? -ne 0 ]; then
    echo "Error: Docker build failed."
    exit 1
fi

# Save to file if requested
FILE_SIZE=""
if [ "$SAVE_TO_FILE" = true ]; then
    echo ""
    echo "Saving image to $OUTPUT_FILE..."
    echo "This may take a few minutes and will create a large file..."
    echo ""
    
    # Save the image
    docker save "$IMAGE_TAG" | gzip > "$OUTPUT_FILE"
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to save image."
        exit 1
    fi
    
    # Get file size
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
fi

echo ""
echo "=========================================="
echo "Build Complete!"
echo "=========================================="
echo "Image tag: $IMAGE_TAG"
if [ "$PUSH_TO_REGISTRY" = true ]; then
    echo "Registry image: ${GHCR_FULL}:latest"
    echo "Registry image (SHA): ${GHCR_FULL}:${GIT_SHA}"
fi
if [ "$SAVE_TO_FILE" = true ]; then
    echo "Output file: $OUTPUT_FILE"
    echo "File size: $FILE_SIZE"
fi
echo ""
echo "Next steps:"

if [ "$PUSH_TO_REGISTRY" = true ]; then
    echo "Option 1: Pull from GitHub Container Registry on your VPS"
    echo "  1. On your VPS, authenticate with GitHub:"
    echo "     echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"
    echo ""
    echo "  2. Pull the image:"
    echo "     docker pull ${GHCR_FULL}:latest"
    echo ""
    echo "  3. Update your docker-compose.yml to use:"
    echo "     image: ${GHCR_FULL}:latest"
    echo ""
fi

if [ "$SAVE_TO_FILE" = true ]; then
    if [ "$PUSH_TO_REGISTRY" = true ]; then
        echo "Option 2: Use the saved tar file"
    fi
    echo "  1. Transfer the file to your VPS:"
    echo "     scp $OUTPUT_FILE user@your-vps-ip:/tmp/"
    echo ""
    echo "  2. On your VPS, load the image:"
    echo "     gunzip -c /tmp/$OUTPUT_FILE | docker load"
    echo ""
    echo "  3. Verify the image is loaded:"
    echo "     docker images | grep documenso"
    echo ""
    echo "  4. Update your docker-compose.yml to use:"
    echo "     image: $IMAGE_TAG"
fi

echo "=========================================="
