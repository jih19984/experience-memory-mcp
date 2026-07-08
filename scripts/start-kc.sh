#!/usr/bin/env bash
set -euo pipefail

export MCP_TRANSPORT="${MCP_TRANSPORT:-http}"
export PORT="${PORT:-8000}"

if [[ "${MCP_EMBEDDED_POSTGRES:-1}" == "1" ]]; then
  export PGDATA="${PGDATA:-/tmp/experience-memory-postgres}"
  export POSTGRES_DB="${POSTGRES_DB:-experience_memory}"
  export DATABASE_URL="${DATABASE_URL:-postgres://postgres@127.0.0.1:5432/${POSTGRES_DB}}"

  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"

  if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
    su postgres -c "/usr/lib/postgresql/15/bin/initdb -D '$PGDATA' --auth-local=trust --auth-host=trust >/dev/null"
  fi

  su postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D '$PGDATA' -o '-c listen_addresses=127.0.0.1' -w start >/dev/null"
  su postgres -c "createdb '$POSTGRES_DB' 2>/dev/null || true"

  node dist/cli/database.js init
fi

exec node dist/index.js
