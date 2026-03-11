#!/usr/bin/env python3
"""
PreToolUse hook: Block modifications to sensitive files.

Prevents Write/Edit on .env files, credentials, secrets, .git/, and node_modules/.
Exit 2 = block the tool call.
"""
import json
import sys

PROTECTED_PATTERNS = [
    ".env",
    ".env.local",
    ".env.production",
    "credentials.json",
    "secrets",
    ".git/",
    "node_modules/",
]

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

# Allow .env.example files (safe to write — they contain no secrets)
if file_path.endswith(".env.example"):
    sys.exit(0)

for pattern in PROTECTED_PATTERNS:
    if pattern in file_path:
        print(f"BLOCKED: Cannot modify protected file: {file_path}", file=sys.stderr)
        print("This file is protected. Please modify it manually.", file=sys.stderr)
        sys.exit(2)

sys.exit(0)
