#!/usr/bin/env bash
# apm — Agent Package Manager
# Requires Node.js 18+ on PATH. Runs the compiled dist/ or falls back to ts-node.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_ENTRY="$PROJECT_ROOT/dist/cli/index.js"
SRC_ENTRY="$PROJECT_ROOT/src/cli/index.ts"

# ── locate Node.js ────────────────────────────────────────────────────────────
NODE_CMD=""
for candidate in node nodejs; do
    if command -v "$candidate" &>/dev/null; then
        NODE_MAJOR=$("$candidate" -e "process.stdout.write(String(process.versions.node.split('.')[0]))" 2>/dev/null || echo "0")
        if [ "$NODE_MAJOR" -ge 18 ]; then
            NODE_CMD="$candidate"
            break
        fi
    fi
done

if [ -z "$NODE_CMD" ]; then
    echo "[error] Node.js 18+ not found. Install Node.js and ensure it is on your PATH." >&2
    exit 1
fi

# ── run ───────────────────────────────────────────────────────────────────────
if [ -f "$DIST_ENTRY" ]; then
    exec "$NODE_CMD" "$DIST_ENTRY" "$@"
elif command -v npx &>/dev/null && [ -f "$SRC_ENTRY" ]; then
    exec npx ts-node "$SRC_ENTRY" "$@"
else
    echo "[error] Run 'npm run build' first to compile the TypeScript source." >&2
    exit 1
fi
