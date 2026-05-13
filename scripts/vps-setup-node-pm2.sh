#!/usr/bin/env bash
set -euo pipefail

# Phase 0.5 bootstrap:
# - install Node.js LTS
# - install PM2
# - start rmdata node api as a service

APP_DIR="/var/www/api.rmdata.tech/current"
ECOSYSTEM_PATH="$APP_DIR/scripts/vps-node-api-ecosystem.config.cjs"
NODE_MAJOR_DEFAULT="20"
RUN_USER_DEFAULT="deploy"

NODE_MAJOR="${1:-$NODE_MAJOR_DEFAULT}"
RUN_USER="${2:-$RUN_USER_DEFAULT}"

echo "[1/6] Installing Node.js LTS v${NODE_MAJOR}.x"
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
sudo apt-get install -y nodejs

echo "[2/6] Installing PM2 globally"
sudo npm install -g pm2

echo "[3/6] Verifying versions"
node -v
npm -v
pm2 -v

echo "[4/6] Ensuring log directory exists"
sudo mkdir -p /var/log/rmdata
sudo chown -R "$RUN_USER:$RUN_USER" /var/log/rmdata

echo "[5/6] Starting API via PM2 ecosystem"
cd "$APP_DIR"
pm2 start "$ECOSYSTEM_PATH" --only rmdata-node-api
pm2 status

echo "[6/6] Enabling PM2 startup + persistence"
pm2 startup systemd -u "$RUN_USER" --hp "/home/$RUN_USER"
pm2 save

echo "Done. Next: configure Nginx proxy for /node-api/ and run verification script."

