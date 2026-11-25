#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if command -v cygpath >/dev/null 2>&1; then
  repo="$(cygpath -am "$repo")"
  export BACKUP_DIR="$(cygpath -am "${BACKUP_DIR:-/var/backups/spieleabend}")"
  if [ "$#" -eq 1 ] && [ -n "$1" ]; then
    set -- "$(cygpath -am "$1")"
  fi
fi
exec node "$repo/scripts/restore-test.mjs" "$@"
