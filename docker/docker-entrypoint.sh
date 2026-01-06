#!/bin/bash
set -e

# Configure Git to trust the workspace directory
git config --global --add safe.directory /workspace

# Clone repository if REPO_URL is provided and workspace is empty
if [ -n "$REPO_URL" ]; then
    if [ ! -d "/workspace/.git" ]; then
        echo "Cloning repository: $REPO_URL"
        git clone "$REPO_URL" /workspace
    else
        echo "Repository already exists, skipping clone"
    fi

    # Checkout branch if specified
    if [ -n "$BRANCH" ]; then
        cd /workspace
        echo "Checking out branch: $BRANCH"
        git fetch --all 2>/dev/null || true
        git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH"
    fi
fi

# Execute CMD
exec "$@"
