#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }

cd "$PROJECT_ROOT"

echo -e "${BLUE}=== Harness Status ===${NC}"
echo ""

# --- PM2 Processes ---

echo -e "${BLUE}--- PM2 Processes ---${NC}"
if command -v pm2 &>/dev/null; then
  pm2 status 2>/dev/null || log_warn "No PM2 processes found"
else
  log_warn "pm2 not installed"
fi
echo ""

# --- Docker Containers ---

echo -e "${BLUE}--- Docker Containers ---${NC}"
if command -v docker &>/dev/null; then
  CONTAINERS=("harness-postgres" "harness-qdrant" "harness-loki" "harness-grafana")
  for container in "${CONTAINERS[@]}"; do
    STATUS=$(docker ps --filter "name=^${container}$" --format '{{.Status}}' 2>/dev/null)
    if [ -n "$STATUS" ]; then
      echo -e "  ${GREEN}[running]${NC}  ${container}  ${DIM}${STATUS}${NC}"
    else
      echo -e "  ${RED}[stopped]${NC}  ${container}"
    fi
  done
else
  log_warn "docker not installed"
fi
echo ""

# --- Health Check ---

echo -e "${BLUE}--- Health Check ---${NC}"
HEALTH_RESPONSE=$(curl -sf "http://localhost:4002/health" 2>/dev/null) && {
  echo -e "  ${GREEN}[healthy]${NC}  http://localhost:4002/health"
  echo -e "  ${DIM}${HEALTH_RESPONSE}${NC}"
} || {
  echo -e "  ${RED}[down]${NC}     http://localhost:4002/health"
}
echo ""

# --- Endpoints ---

echo -e "${BLUE}--- Endpoints ---${NC}"
for endpoint in "http://localhost:4000|Dashboard" "http://localhost:4001|Orchestrator" "http://localhost:3200|Grafana"; do
  URL="${endpoint%%|*}"
  NAME="${endpoint##*|}"
  if curl -sf --max-time 2 "$URL" >/dev/null 2>&1; then
    echo -e "  ${GREEN}[up]${NC}  ${NAME}: ${URL}"
  else
    echo -e "  ${RED}[down]${NC}  ${NAME}: ${URL}"
  fi
done
echo ""

# --- Recent Logs ---

echo -e "${BLUE}--- Recent Logs (last 10 lines each) ---${NC}"
if command -v pm2 &>/dev/null; then
  echo ""
  echo -e "${DIM}harness-orchestrator:${NC}"
  pm2 logs harness-orchestrator --nostream --lines 10 2>/dev/null || echo "  (no logs)"
  echo ""
  echo -e "${DIM}harness-dashboard:${NC}"
  pm2 logs harness-dashboard --nostream --lines 10 2>/dev/null || echo "  (no logs)"
fi
