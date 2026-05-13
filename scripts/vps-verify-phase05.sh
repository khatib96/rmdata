#!/usr/bin/env bash
set -euo pipefail

# Phase 0.5 verification:
# 1) Health checks (PHP + Node bridge)
# 2) Service persistence checks
# 3) Backup restore smoke test (DB + storage archive)

API_BASE="${API_BASE:-https://api.rmdata.tech}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/rmdata}"
RESTORE_TMP="${RESTORE_TMP:-/tmp/rmdata-restore-smoke}"
DB_NAME="${DB_NAME:-rmdata_db}"
DB_USER="${DB_USER:-root}"

echo "[1/4] PHP health"
curl -fsS "$API_BASE/api/health" | sed 's/.*/  &/'

echo "[2/4] Node bridge health"
curl -fsS "$API_BASE/node-api/health" | sed 's/.*/  &/'

echo "[3/4] Service status"
systemctl is-active nginx
systemctl is-active php8.3-fpm || true
pm2 status | sed -n '1,20p'

echo "[4/4] Backup restore smoke test"
LATEST_BACKUP="$(ls -1dt "$BACKUP_ROOT"/* 2>/dev/null | head -n 1 || true)"
if [[ -z "$LATEST_BACKUP" ]]; then
  echo "No backup folders found in $BACKUP_ROOT"
  exit 1
fi
echo "  Latest backup: $LATEST_BACKUP"

rm -rf "$RESTORE_TMP"
mkdir -p "$RESTORE_TMP"

cp "$LATEST_BACKUP/db.sql" "$RESTORE_TMP/db.sql"
tar -xzf "$LATEST_BACKUP/storage.tar.gz" -C "$RESTORE_TMP"

test -s "$RESTORE_TMP/db.sql"
test -d "$RESTORE_TMP/storage"

echo "  DB SQL and storage archive extracted successfully"
echo "  Optional DB restore test command:"
echo "    mysql -u $DB_USER ${DB_NAME}_restore_test < $RESTORE_TMP/db.sql"

echo "Phase 0.5 verification passed."

