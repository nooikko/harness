#!/usr/bin/env python3
"""
PostToolUse hook: Run validation after git merge operations.

Catches integration issues immediately after merging a worktree branch
rather than waiting for the next commit attempt.
"""
import json
import os
import subprocess
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

tool_name = input_data.get("tool_name", "")
if tool_name != "Bash":
    sys.exit(0)

command = input_data.get("tool_input", {}).get("command", "")
if not command:
    sys.exit(0)

# Only trigger on git merge commands
if "git merge" not in command:
    sys.exit(0)

# Check if the merge actually succeeded by looking at tool output
tool_output = input_data.get("tool_output", {})
stdout = tool_output.get("stdout", "")
stderr = tool_output.get("stderr", "")

# Skip if merge had conflicts or failed
if "CONFLICT" in stdout or "CONFLICT" in stderr:
    sys.exit(0)
if "Already up to date" in stdout:
    sys.exit(0)

project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

checks = [
    ("typecheck", ["pnpm", "typecheck"]),
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
        "\n⚠️  Post-merge validation failed. The merge succeeded but these checks fail:\n",
        file=sys.stderr,
    )
    for name, error in failed:
        print(f"  ✗ {name}:", file=sys.stderr)
        for line in error.split("\n")[:10]:
            print(f"    {line}", file=sys.stderr)
        print("", file=sys.stderr)
    print(
        "Consider reverting the merge (git revert -m 1 HEAD) or fixing the issues before continuing.",
        file=sys.stderr,
    )
    # Exit 0 — warn but don't block, since the merge already happened
    # The pre-commit hook will block the NEXT commit if issues persist

sys.exit(0)
