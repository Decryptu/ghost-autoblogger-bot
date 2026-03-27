#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/decrypt/ghost-autoblogger-bot"
LOG_DIR="$HOME/autoblogger-logs"

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

echo "==> skip PM2 restart"
echo "ghost-autoblogger is intended to run via system cron in one-shot mode."

echo "✅ $(date -Is) autoblogger deploy done"
