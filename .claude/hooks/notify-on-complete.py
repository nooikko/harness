#!/usr/bin/env python3
"""
Notification hook: Desktop notifications for Claude Code events.

Uses notify-send (Linux) for desktop notifications.
Silently exits if notify-send is not available.
"""
import json
import shutil
import subprocess
import sys

NOTIFICATION_TITLES = {
    "permission_prompt": "Claude Code — Permission Required",
    "idle_prompt": "Claude Code — Waiting for Input",
    "stop_response": "Claude Code — Task Complete",
}

if not shutil.which("notify-send"):
    sys.exit(0)

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

notification_type = input_data.get("type", "unknown")
title = NOTIFICATION_TITLES.get(notification_type, f"Claude Code — {notification_type}")
message = input_data.get("message", "Claude Code needs your attention.")

try:
    subprocess.run(
        ["notify-send", "--app-name=Claude Code", title, message],
        capture_output=True,
        timeout=5,
    )
except Exception:
    pass

sys.exit(0)
