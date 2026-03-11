#!/usr/bin/env python3
"""
PostToolUse hook: Run validation after git merge operations.

Non-blocking (exit 0) since merge already happened. Warns if checks fail.
"""
import json
import os
import subprocess
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

if input_data.get("tool_name") != "Bash":
    sys.exit(0)

command = input_data.get("tool_input", {}).get("command", "")
if not command or "git merge" not in command:
    sys.exit(0)

tool_output = input_data.get("tool_output", {})
stdout = tool_output.get("stdout", "")
stderr = tool_output.get("stderr", "")

if "CONFLICT" in stdout or "CONFLICT" in stderr:
    sys.exit(0)
if "Already up to date" in stdout:
    sys.exit(0)

project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

checks = [
    ("type-check", ["pnpm", "type-check"]),
    ("lint", ["pnpm", "lint"]),
    ("build", ["pnpm", "build"]),
]

failed = []

for name, cmd in checks:
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=project_dir,
        )
        if result.returncode != 0:
            failed.append((name, result.stderr.strip() or result.stdout.strip()))
    except subprocess.TimeoutExpired:
        failed.append((name, "timed out after 120s"))
    except FileNotFoundError:
        failed.append((name, f"command not found: {cmd[0]}"))

if failed:
    print(
        "\nPost-merge validation failed. The merge succeeded but these checks fail:\n",
        file=sys.stderr,
    )
    for name, error in failed:
        print(f"  x {name}:", file=sys.stderr)
        for line in error.split("\n")[:10]:
            print(f"    {line}", file=sys.stderr)
        print("", file=sys.stderr)
    print(
        "Consider reverting (git revert -m 1 HEAD) or fixing issues before continuing.",
        file=sys.stderr,
    )

sys.exit(0)
