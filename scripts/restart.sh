#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

# Parse arguments
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --help)
      echo "Usage: restart.sh [OPTIONS]"
      echo ""
      echo "Rebuild and restart PM2 processes (Docker containers are not touched)."
      echo ""
      echo "Options:"
      echo "  --skip-build    Skip pnpm build, just restart processes"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      log_warn "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

cd "$PROJECT_ROOT"

# --- Prerequisites ---

if ! command -v pm2 &>/dev/null; then
  echo "pm2 is required but not installed. Run: npm install -g pm2"
  exit 1
fi

# --- Build ---

if [ "$SKIP_BUILD" = false ]; then
  log_step "Generating Prisma client..."
  pnpm db:generate

  log_step "Pushing database schema..."
  pnpm db:push

  log_step "Building all packages..."
  NODE_ENV=production pnpm build
else
  log_info "Skipping build (--skip-build flag)"
fi

# --- Restart PM2 ---

log_step "Restarting PM2 processes..."

pm2 stop ecosystem.config.cjs 2>/dev/null || true
pm2 delete ecosystem.config.cjs 2>/dev/null || true
pm2 start ecosystem.config.cjs --env production

pm2 save --force 2>/dev/null || true

# --- Health check ---

log_step "Waiting for health check on :4002/health..."

RETRIES=0
MAX_RETRIES=30

while [ $RETRIES -lt $MAX_RETRIES ]; do
  if curl -sf "http://localhost:4002/health" >/dev/null 2>&1; then
    log_info "Health check passed"
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 1
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
  log_warn "Health check did not pass within ${MAX_RETRIES}s — check logs with: scripts/logs.sh"
fi

echo ""
pm2 status
