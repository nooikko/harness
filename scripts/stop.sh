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
STOP_ALL=false

for arg in "$@"; do
  case $arg in
    --all)
      STOP_ALL=true
      ;;
    --help)
      echo "Usage: stop.sh [OPTIONS]"
      echo ""
      echo "Stop Harness processes."
      echo ""
      echo "Options:"
      echo "  --all    Also stop Docker containers (PostgreSQL, Qdrant, Loki, Grafana)"
      echo "  --help   Show this help message"
      exit 0
      ;;
    *)
      log_warn "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

cd "$PROJECT_ROOT"

# --- Stop PM2 processes ---

log_step "Stopping PM2 processes..."

if command -v pm2 &>/dev/null; then
  pm2 stop ecosystem.config.cjs 2>/dev/null || true
  pm2 delete ecosystem.config.cjs 2>/dev/null || true
  log_info "PM2 processes stopped"
else
  log_warn "pm2 not found — skipping"
fi

# --- Stop Docker containers ---

if [ "$STOP_ALL" = true ]; then
  log_step "Stopping Docker containers..."
  if command -v docker &>/dev/null; then
    docker compose down
    log_info "Docker containers stopped"
  else
    log_warn "docker not found — skipping"
  fi
else
  log_info "Docker containers left running (use --all to stop)"
fi

echo ""
log_info "Harness stopped"
