# Fork Workflow Guide

This document explains how to keep your fork of Documenso up to date with the latest releases from the original repository.

## Repository Setup

Your local repository is configured with two remotes:

- **origin**: Your fork at `https://github.com/jean-losi/documenso.git`
- **upstream**: Original repository at `https://github.com/documenso/documenso.git`

You can verify this with:
```bash
git remote -v
```

## Branching Strategy

- **main**: Tracks the latest development from upstream/main
- **release-v1.13.1**: Your current working branch based on the v1.13.1 release
- **release-vX.X.X**: Create new branches for each new release you want to use

## Workflow: Pulling New Releases

### 1. Check for New Releases

Visit the releases page to see new versions:
```bash
gh release list --repo documenso/documenso
```

Or visit: https://github.com/documenso/documenso/releases

### 2. Fetch Updates from Upstream

Always start by fetching the latest tags and commits:
```bash
git fetch upstream --tags
```

### 3. Create a Branch for the New Release

When a new release (e.g., v1.14.0) is available:
```bash
# Create and checkout a new branch from the release tag
git checkout -b release-v1.14.0 v1.14.0

# Push to your fork
git push -u origin release-v1.14.0
```

### 4. Switch Between Releases

To switch back to a previous release:
```bash
git checkout release-v1.13.1
```

To use the new release:
```bash
git checkout release-v1.14.0
```

### 5. Update Dependencies After Switching

After switching to a new release branch, always:
```bash
# Stop current services
npm run dx:down
pkill -f "npm run dev"

# Install dependencies (in case they changed)
npm install

# Run migrations
npm run prisma:migrate-dev

# Start services
npm run d
```

## Pulling Only Stable Releases (Not Development Commits)

Since you want to track only releases and not development commits:

### Update Main Branch (Optional)
If you want to keep your main branch updated with upstream main:
```bash
git checkout main
git pull upstream main
git push origin main
```

### Stick to Release Branches (Recommended)
For stability, always work on `release-vX.X.X` branches:
```bash
# List all available release tags
git tag -l "v*"

# Create branch from specific release
git checkout -b release-v1.14.0 v1.14.0

# Push to your fork
git push -u origin release-v1.14.0
```

## Quick Reference Commands

### Check current branch
```bash
git branch
```

### List all release tags
```bash
git tag -l "v*" | sort -V | tail -10
```

### Fetch latest releases
```bash
git fetch upstream --tags
```

### Create branch from latest release
```bash
# Get the latest tag
LATEST_TAG=$(git tag -l "v*" | sort -V | tail -1)

# Create and checkout branch
git checkout -b release-$LATEST_TAG $LATEST_TAG

# Push to your fork
git push -u origin release-$LATEST_TAG
```

### View changes between releases
```bash
git log v1.13.1..v1.14.0 --oneline
```

## Automated Update Script

Create a file `update-to-latest-release.sh`:

```bash
#!/bin/bash

# Fetch latest from upstream
git fetch upstream --tags

# Get the latest release tag
LATEST_TAG=$(git tag -l "v*" | sort -V | tail -1)
BRANCH_NAME="release-$LATEST_TAG"

echo "Latest release: $LATEST_TAG"
echo "Creating branch: $BRANCH_NAME"

# Check if branch already exists locally
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "Branch $BRANCH_NAME already exists. Checking out..."
    git checkout "$BRANCH_NAME"
else
    # Create new branch from tag
    git checkout -b "$BRANCH_NAME" "$LATEST_TAG"
    
    # Push to your fork
    git push -u origin "$BRANCH_NAME"
fi

echo "Now on $BRANCH_NAME"
echo "Run 'npm run d' to start the application"
```

Make it executable:
```bash
chmod +x update-to-latest-release.sh
```

Run it:
```bash
./update-to-latest-release.sh
```

## Important Notes

1. **Never commit directly to main** - Keep it as a mirror of upstream/main
2. **Always work on release branches** - This keeps your work stable
3. **Tag format**: Documenso uses semantic versioning: `vMAJOR.MINOR.PATCH`
4. **Environment files**: Your `.env` file is gitignored and will persist across branch switches
5. **Database migrations**: Always run migrations after switching to a new release

## Troubleshooting

### Merge Conflicts When Updating
If you've made local changes and want to update:
```bash
# Stash your changes
git stash

# Switch to new release
git checkout release-v1.14.0

# Apply your changes
git stash pop
```

### Reset to Pristine Release State
If things go wrong:
```bash
# Discard all local changes
git reset --hard v1.13.1

# Clean untracked files
git clean -fd
```

### See What Changed in a Release
```bash
# View release notes
gh release view v1.13.1 --repo documenso/documenso

# Or visit the web UI
open https://github.com/documenso/documenso/releases/tag/v1.13.1
```

## Your Current Setup

- **Local path**: `/Users/jean-emmanuellosi/Projects/Documenso/documenso-fork`
- **Your fork**: https://github.com/jean-losi/documenso
- **Current release**: v2.0.0
- **Current branch**: release-v1.13.1 (merged with v2.0.0)
- **Local server**: http://localhost:3000

Happy forking! 🍴

