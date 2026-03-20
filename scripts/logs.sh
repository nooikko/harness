#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
NC='\033[0m'

# Defaults
LINES=50
PROCESS=""
NO_STREAM=false

for arg in "$@"; do
  case $arg in
    --orchestrator)
      PROCESS="harness-orchestrator"
      ;;
    --web|--dashboard)
      PROCESS="harness-dashboard"
      ;;
    --lines)
      # Next iteration will capture the value
      CAPTURE_LINES=true
      continue
      ;;
    --lines=*)
      LINES="${arg#*=}"
      ;;
    --no-stream)
      NO_STREAM=true
      ;;
    --help)
      echo "Usage: logs.sh [OPTIONS]"
      echo ""
      echo "View Harness PM2 logs."
      echo ""
      echo "Options:"
      echo "  --orchestrator     Show only orchestrator logs"
      echo "  --web, --dashboard Show only dashboard logs"
      echo "  --lines N          Number of lines to show (default: 50)"
      echo "  --no-stream        Show recent logs and exit (don't follow)"
      echo "  --help             Show this help message"
      echo ""
      echo "Without --no-stream, logs are streamed in real time (Ctrl+C to stop)."
      exit 0
      ;;
    *)
      if [ "${CAPTURE_LINES:-}" = true ]; then
        LINES="$arg"
        CAPTURE_LINES=false
      else
        echo -e "${RED}[ERROR]${NC} Unknown argument: $arg"
        exit 1
      fi
      ;;
  esac
done

if ! command -v pm2 &>/dev/null; then
  echo -e "${RED}[ERROR]${NC} pm2 is required but not installed. Run: npm install -g pm2"
  exit 1
fi

ARGS=("--lines" "$LINES")

if [ "$NO_STREAM" = true ]; then
  ARGS+=("--nostream")
fi

if [ -n "$PROCESS" ]; then
  pm2 logs "$PROCESS" "${ARGS[@]}"
else
  pm2 logs "${ARGS[@]}"
fi
