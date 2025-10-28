#!/bin/bash
set -e

echo "🔍 Fetching latest releases from upstream..."
git fetch upstream --tags

# Get the latest release tag
LATEST_TAG=$(git tag -l "v*" | sort -V | tail -1)
CURRENT_BRANCH=$(git branch --show-current)
BRANCH_NAME="release-$LATEST_TAG"

echo ""
echo "📋 Release Information:"
echo "  Latest release: $LATEST_TAG"
echo "  Current branch: $CURRENT_BRANCH"
echo "  Target branch: $BRANCH_NAME"
echo ""

# Check if already on the latest release branch
if [ "$CURRENT_BRANCH" = "$BRANCH_NAME" ]; then
    echo "✅ Already on the latest release branch!"
    exit 0
fi

# Check if branch already exists locally
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "📂 Branch $BRANCH_NAME already exists locally"
    read -p "Do you want to switch to it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout "$BRANCH_NAME"
        echo "✅ Switched to $BRANCH_NAME"
    else
        echo "❌ Cancelled"
        exit 0
    fi
else
    echo "🆕 Creating new branch $BRANCH_NAME from tag $LATEST_TAG"
    git checkout -b "$BRANCH_NAME" "$LATEST_TAG"
    
    echo "📤 Pushing to your fork..."
    git push -u origin "$BRANCH_NAME"
    
    echo "✅ Created and pushed $BRANCH_NAME"
fi

echo ""
echo "🎯 Next steps:"
echo "  1. Stop current dev server if running: pkill -f 'npm run dev'"
echo "  2. Install dependencies: npm install"
echo "  3. Run migrations: npm run prisma:migrate-dev"
echo "  4. Start application: npm run d"
echo ""
echo "Or run all at once:"
echo "  pkill -f 'npm run dev' && npm install && npm run prisma:migrate-dev && npm run d"

