#!/usr/bin/env bash
# Harness production deployment script
# Usage: ./deploy/deploy.sh [--skip-build] [--restart-only]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
SKIP_BUILD=false
RESTART_ONLY=false

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --restart-only)
      RESTART_ONLY=true
      ;;
    --help)
      echo "Usage: deploy.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-build    Skip the build step (use existing build artifacts)"
      echo "  --restart-only  Only restart services, skip git pull and build"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      log_error "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

cd "$PROJECT_ROOT"

# Verify prerequisites
command -v node >/dev/null 2>&1 || { log_error "node is required but not installed"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { log_error "pnpm is required but not installed"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { log_error "pm2 is required but not installed. Run: npm install -g pm2"; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  log_error "Node.js >= 22 required, found v$NODE_VERSION"
  exit 1
fi

# Check for .env file
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  log_warn ".env file not found at project root"
  log_warn "Copy .env.example to .env and configure before deploying"
fi

if [ ! -f "$PROJECT_ROOT/packages/database/.env" ]; then
  log_warn "packages/database/.env not found — DATABASE_URL may not be set"
fi

# Create log directory
mkdir -p "$LOG_DIR"

if [ "$RESTART_ONLY" = true ]; then
  log_info "Restart-only mode — skipping pull and build"
else
  # Pull latest code
  log_info "Pulling latest code..."
  git pull --ff-only

  # Install dependencies
  log_info "Installing dependencies..."
  pnpm install --frozen-lockfile

  # Generate Prisma client
  log_info "Generating Prisma client..."
  pnpm db:generate

  # Push database schema (safe for incremental changes)
  log_info "Pushing database schema..."
  pnpm db:push

  if [ "$SKIP_BUILD" = false ]; then
    # Build all packages
    log_info "Building all packages..."
    NODE_ENV=production pnpm build
  else
    log_info "Skipping build (--skip-build flag)"
  fi
fi

# Install pm2-logrotate if not already installed
if ! pm2 describe pm2-logrotate > /dev/null 2>&1; then
  log_info "Installing pm2-logrotate..."
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 50M
  pm2 set pm2-logrotate:retain 14
  pm2 set pm2-logrotate:compress true
  pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
  pm2 set pm2-logrotate:workerInterval 60
fi

# Stop existing processes (if any)
log_info "Stopping existing processes..."
pm2 stop ecosystem.config.cjs 2>/dev/null || true

# Start/restart with ecosystem config
log_info "Starting services..."
pm2 start ecosystem.config.cjs --env production

# Save pm2 process list for auto-restart on reboot
pm2 save

# Health check — wait for orchestrator
log_info "Waiting for health check..."
HEALTH_PORT="${HEALTH_PORT:-3002}"
RETRIES=0
MAX_RETRIES=30

while [ $RETRIES -lt $MAX_RETRIES ]; do
  if curl -sf "http://localhost:${HEALTH_PORT}/health" > /dev/null 2>&1; then
    log_info "Health check passed"
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 1
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
  log_warn "Health check did not pass within ${MAX_RETRIES}s — check logs"
  pm2 logs --nostream --lines 20
fi

# Show status
echo ""
log_info "Deployment complete"
pm2 status
echo ""
log_info "Useful commands:"
echo "  pm2 status                  — View process status"
echo "  pm2 logs                    — Stream all logs"
echo "  pm2 logs harness-orchestrator — Stream orchestrator logs"
echo "  pm2 logs harness-dashboard  — Stream dashboard logs"
echo "  pm2 monit                   — Monitor CPU/memory"
echo "  curl localhost:${HEALTH_PORT}/health — Health check"
