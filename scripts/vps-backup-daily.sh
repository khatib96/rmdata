#!/usr/bin/env bash
set -euo pipefail

# Daily backup for Phase 0.5
# - MariaDB dump
# - storage archive
# - protected env copy
# - retention cleanup (default 15 days)

APP_ROOT="/var/www/api.rmdata.tech"
APP_HTML="$APP_ROOT/html"
BACKUP_ROOT="/var/backups/rmdata"
LOG_FILE="/var/log/rmdata/backup.log"

DB_NAME="${DB_NAME:-rmdata_db}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
RETENTION_DAYS="${RETENTION_DAYS:-15}"

TIMESTAMP="$(date +%F_%H-%M-%S)"
TARGET_DIR="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$TARGET_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  printf '[%s] %s\n' "$(date +'%F %T')" "$*" | tee -a "$LOG_FILE"
}

log "Backup start"

if [[ -n "$DB_PASSWORD" ]]; then
  export MYSQL_PWD="$DB_PASSWORD"
fi

log "Dumping database: $DB_NAME"
mysqldump --single-transaction --quick --routines --triggers \
  -u "$DB_USER" "$DB_NAME" > "$TARGET_DIR/db.sql"

if [[ -n "${MYSQL_PWD:-}" ]]; then
  unset MYSQL_PWD
fi

log "Archiving storage folder"
tar -czf "$TARGET_DIR/storage.tar.gz" -C "$APP_HTML" storage

log "Copying env files"
if [[ -f "$APP_ROOT/.env" ]]; then
  cp "$APP_ROOT/.env" "$TARGET_DIR/env.api-gateway.env"
  chmod 600 "$TARGET_DIR/env.api-gateway.env"
fi
if [[ -f "$APP_ROOT/node-api/.env" ]]; then
  cp "$APP_ROOT/node-api/.env" "$TARGET_DIR/env.node-api.env"
  chmod 600 "$TARGET_DIR/env.node-api.env"
fi

chmod 600 "$TARGET_DIR/db.sql"
chmod 600 "$TARGET_DIR/storage.tar.gz"

log "Applying retention policy: $RETENTION_DAYS days"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

log "Backup done -> $TARGET_DIR"

