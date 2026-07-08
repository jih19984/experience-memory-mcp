#!/usr/bin/env bash
set -euo pipefail

export MCP_TRANSPORT="${MCP_TRANSPORT:-http}"
export PORT="${PORT:-8000}"
export EXPERIENCE_MEMORY_DATA_DIR="${EXPERIENCE_MEMORY_DATA_DIR:-/tmp/experience-memory}"

exec node dist/index.js
