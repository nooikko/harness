#!/usr/bin/env python3
"""
PostToolUse hook: Run Biome check on files after Write/Edit.

Fires after Write or Edit completes on Biome-supported file types.
Runs `npx biome check --write` on the single file.
Non-blocking: always exits 0, but prints warnings on Biome errors.
"""
import json
import os
import subprocess
import sys

BIOME_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".json", ".css"}

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

tool_name = input_data.get("tool_name", "")
if tool_name not in ("Write", "Edit"):
    sys.exit(0)

file_path = input_data.get("tool_input", {}).get("file_path", "")
if not file_path:
    sys.exit(0)

ext = os.path.splitext(file_path)[1].lower()
if ext not in BIOME_EXTENSIONS:
    sys.exit(0)

if not os.path.isfile(file_path):
    sys.exit(0)

try:
    result = subprocess.run(
        ["npx", "biome", "check", "--write", file_path],
        capture_output=True,
        text=True,
        timeout=25,
    )
    if result.returncode != 0:
        print(f"⚠ Biome check reported issues for {os.path.basename(file_path)}:", file=sys.stderr)
        if result.stderr.strip():
            print(result.stderr.strip(), file=sys.stderr)
        if result.stdout.strip():
            print(result.stdout.strip(), file=sys.stderr)
except FileNotFoundError:
    print("⚠ Biome not found — skipping check", file=sys.stderr)
except subprocess.TimeoutExpired:
    print("⚠ Biome check timed out", file=sys.stderr)
except Exception as e:
    print(f"⚠ Biome check failed: {e}", file=sys.stderr)

sys.exit(0)
