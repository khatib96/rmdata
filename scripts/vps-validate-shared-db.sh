#!/usr/bin/env bash
set -euo pipefail

# Validate PHP and Node bridge are reading/writing against the same DB.

API_BASE="${API_BASE:-https://api.rmdata.tech}"
LOGIN_USER="${LOGIN_USER:-}"
LOGIN_PASS="${LOGIN_PASS:-}"

if [[ -z "$LOGIN_USER" || -z "$LOGIN_PASS" ]]; then
  echo "Set LOGIN_USER and LOGIN_PASS before running."
  echo "Example: LOGIN_USER=admin LOGIN_PASS='***' ./scripts/vps-validate-shared-db.sh"
  exit 1
fi

echo "[1/4] Login to PHP gateway"
PHP_RAW="$(curl -sS -X POST "$API_BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$LOGIN_USER\",\"password\":\"$LOGIN_PASS\"}")"
PHP_TOKEN="$(printf '%s' "$PHP_RAW" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"

if [[ -z "$PHP_TOKEN" ]]; then
  echo "Failed to obtain PHP token. Response was:"
  echo "$PHP_RAW"
  echo "(Check username/password — PHP returns 200 with success:false on bad login.)"
  exit 1
fi

echo "[2/4] Login to Node bridge"
NODE_RAW="$(curl -sS -X POST "$API_BASE/node-api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$LOGIN_USER\",\"password\":\"$LOGIN_PASS\"}")"
NODE_TOKEN="$(printf '%s' "$NODE_RAW" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"

if [[ -z "$NODE_TOKEN" ]]; then
  echo "Failed to obtain Node token. Response was:"
  echo "$NODE_RAW"
  exit 1
fi

STAMP="phase05_db_check_$(date +%s)"
SQL="INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, datetime('now'))"
PARAMS="[\"$STAMP\",\"node-written\"]"

echo "[3/4] Write marker through Node /api/db/query"
curl -fsS -X POST "$API_BASE/node-api/db/query" \
  -H "Authorization: Bearer $NODE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$SQL\",\"params\":$PARAMS}" >/dev/null

echo "[4/4] Read marker through PHP /api/db/query"
READ_SQL="SELECT key, value FROM settings WHERE key = ? LIMIT 1"
READ_PARAMS="[\"$STAMP\"]"
RESULT="$(curl -fsS -X POST "$API_BASE/api/db/query" \
  -H "Authorization: Bearer $PHP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$READ_SQL\",\"params\":$READ_PARAMS}")"

echo "$RESULT" | grep -q "$STAMP"
echo "Shared DB validation passed: Node write is visible to PHP."

