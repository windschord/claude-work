#!/bin/bash
set -e

# Git clone/fetch timeout in seconds
GIT_TIMEOUT=${GIT_TIMEOUT:-300}

# Validate REPO_URL format (SSH or HTTPS)
validate_repo_url() {
    local url="$1"
    if [[ "$url" =~ ^git@[a-zA-Z0-9._-]+:[a-zA-Z0-9._/-]+\.git$ ]] || \
       [[ "$url" =~ ^https?://[a-zA-Z0-9._-]+/[a-zA-Z0-9._/-]+(.git)?$ ]]; then
        return 0
    fi
    return 1
}

# Configure Git to trust the workspace directory
git config --global --add safe.directory /workspace

# Clone repository if REPO_URL is provided and workspace is empty
if [ -n "$REPO_URL" ]; then
    # Validate URL format
    if ! validate_repo_url "$REPO_URL"; then
        echo "Error: Invalid repository URL format: $REPO_URL" >&2
        echo "Expected SSH (git@host:path.git) or HTTPS (https://host/path) format" >&2
        exit 1
    fi

    if [ ! -d "/workspace/.git" ]; then
        echo "Cloning repository: $REPO_URL"
        if ! timeout "$GIT_TIMEOUT" git clone "$REPO_URL" /workspace; then
            echo "Error: Failed to clone repository (timeout: ${GIT_TIMEOUT}s)" >&2
            exit 1
        fi
    else
        echo "Repository already exists, skipping clone"
    fi

    # Checkout branch if specified
    if [ -n "$BRANCH" ]; then
        cd /workspace
        echo "Checking out branch: $BRANCH"
        # Fetch with timeout, but don't fail if remote doesn't exist yet
        if ! timeout "$GIT_TIMEOUT" git fetch --all 2>&1; then
            echo "Warning: git fetch failed (remote may not exist yet)"
        fi
        # Try to checkout existing branch, or create new one
        if ! git checkout "$BRANCH" 2>/dev/null; then
            echo "Creating new branch: $BRANCH"
            git checkout -b "$BRANCH"
        fi
    fi
fi

# Execute CMD
exec "$@"
