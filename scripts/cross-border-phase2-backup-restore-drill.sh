#!/usr/bin/env bash
set -euo pipefail

# P2.6 backup/restore drill for the CBE business database.
#
# Required:
#   CBE_DATABASE_URL          source database URL
#   CBE_RESTORE_DATABASE_URL  disposable restore-drill database URL
#
# Optional:
#   CBE_BACKUP_DIR            dump output directory, defaults to outputs/cbe-backups
#   CBE_POSTGRES_CLIENT_IMAGE Docker image with pg_dump/pg_restore when local
#                             PostgreSQL clients are unavailable
#
# This script intentionally refuses to restore into the source database. Use a
# scratch database that can be cleaned by pg_restore --clean --if-exists.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${CBE_BACKUP_DIR:-"${ROOT_DIR}/outputs/cbe-backups"}"
POSTGRES_CLIENT_IMAGE="${CBE_POSTGRES_CLIENT_IMAGE:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_PATH="${BACKUP_DIR}/cbe-phase2-${STAMP}.dump"

if [[ -z "${CBE_DATABASE_URL:-}" ]]; then
  echo "CBE_DATABASE_URL is required." >&2
  exit 1
fi

if [[ -z "${CBE_RESTORE_DATABASE_URL:-}" ]]; then
  echo "CBE_RESTORE_DATABASE_URL is required and must point at a disposable restore-drill database." >&2
  exit 1
fi

if [[ "${CBE_DATABASE_URL}" == "${CBE_RESTORE_DATABASE_URL}" ]]; then
  echo "Source and restore database URLs are identical; refusing to run destructive restore." >&2
  exit 1
fi

if [[ "${CBE_ALLOW_NON_RESTORE_TARGET:-0}" != "1" && "${CBE_RESTORE_DATABASE_URL}" != *restore* && "${CBE_RESTORE_DATABASE_URL}" != *drill* ]]; then
  echo "CBE_RESTORE_DATABASE_URL should look like a restore/drill database. Set CBE_ALLOW_NON_RESTORE_TARGET=1 to override intentionally." >&2
  exit 1
fi

rewrite_localhost_for_docker() {
  node - "$1" <<'NODE'
const raw = process.argv[2];
const url = new URL(raw);
if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
  url.hostname = 'host.docker.internal';
}
console.log(url.toString());
NODE
}

run_pg_dump() {
  if [[ -n "${POSTGRES_CLIENT_IMAGE}" ]]; then
    docker run --rm -v "${BACKUP_DIR}:${BACKUP_DIR}" "${POSTGRES_CLIENT_IMAGE}" pg_dump "$@"
  else
    pg_dump "$@"
  fi
}

run_pg_restore() {
  if [[ -n "${POSTGRES_CLIENT_IMAGE}" ]]; then
    docker run --rm -v "${BACKUP_DIR}:${BACKUP_DIR}" "${POSTGRES_CLIENT_IMAGE}" pg_restore "$@"
  else
    pg_restore "$@"
  fi
}

mkdir -p "${BACKUP_DIR}"

PG_DUMP_DATABASE_URL="${CBE_DATABASE_URL}"
PG_RESTORE_DATABASE_URL="${CBE_RESTORE_DATABASE_URL}"

if [[ -n "${POSTGRES_CLIENT_IMAGE}" ]]; then
  command -v docker >/dev/null || {
    echo "docker is required when CBE_POSTGRES_CLIENT_IMAGE is set." >&2
    exit 1
  }
  PG_DUMP_DATABASE_URL="$(rewrite_localhost_for_docker "${CBE_DATABASE_URL}")"
  PG_RESTORE_DATABASE_URL="$(rewrite_localhost_for_docker "${CBE_RESTORE_DATABASE_URL}")"
  docker run --rm "${POSTGRES_CLIENT_IMAGE}" pg_dump --version >/dev/null
else
  command -v pg_dump >/dev/null || {
    echo "pg_dump is required for the backup drill. Set CBE_POSTGRES_CLIENT_IMAGE to use a Docker client image." >&2
    exit 1
  }
  command -v pg_restore >/dev/null || {
    echo "pg_restore is required for the restore drill. Set CBE_POSTGRES_CLIENT_IMAGE to use a Docker client image." >&2
    exit 1
  }
fi

echo "Creating custom-format CBE dump: ${DUMP_PATH}"
run_pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "${DUMP_PATH}" \
  "${PG_DUMP_DATABASE_URL}"

echo "Restoring dump into disposable drill database."
run_pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "${PG_RESTORE_DATABASE_URL}" \
  "${DUMP_PATH}"

echo "Verifying restored database migrations and Phase 2 store contract."
(
  cd "${ROOT_DIR}"
  CBE_DATABASE_URL="${CBE_RESTORE_DATABASE_URL}" pnpm exec tsx sentura/lib/cross-border-store/migrate.ts --seed
  CBE_DATABASE_URL="${CBE_RESTORE_DATABASE_URL}" pnpm exec tsx scripts/test-cross-border-phase2-store.ts --require-db
)

echo "Backup/restore drill complete: ${DUMP_PATH}"
