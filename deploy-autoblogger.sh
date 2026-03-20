#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/decrypt/ghost-autoblogger-bot"
LOG_DIR="$HOME/autoblogger-logs"
PM2_NAME="ghost-autoblogger"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/deploy-$(date +%F_%H-%M-%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "==> $(date -Is) autoblogger deploy start"

cd "$APP_DIR"

echo "==> git reset + fetch + pull"
git checkout -- .
git clean -fd
git fetch --all --prune
git pull --rebase

echo "==> install deps"
bun install

echo "==> restart PM2"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start /home/decrypt/ecosystem.config.js --only "$PM2_NAME" --update-env
fi
pm2 save

echo "✅ $(date -Is) autoblogger deploy done"
