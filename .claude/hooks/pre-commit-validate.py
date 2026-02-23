#!/usr/bin/env python3
"""
PreToolUse hook: Block git commits if tests, lint, or typecheck haven't passed.

Intercepts `git commit` commands and verifies that the CI pipeline passes
before allowing the commit. Runs pnpm typecheck, lint, and build.

This hook blocks the commit (exit 2) if any check fails.
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

# Only intercept git commit commands
if "git commit" not in command:
    sys.exit(0)

# Skip if this is an amend with no changes (message-only amend)
if "--allow-empty" in command:
    sys.exit(0)

project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

checks = [
    ("typecheck", ["pnpm", "typecheck"]),
    ("lint", ["pnpm", "lint"]),
    ("build", ["pnpm", "build"]),
    ("coverage-gate", ["pnpm", "test:coverage-gate"]),
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
    print("❌ Commit blocked. The following checks failed:\n", file=sys.stderr)
    for name, error in failed:
        print(f"  ✗ {name}:", file=sys.stderr)
        # Print first 10 lines of error output
        for line in error.split("\n")[:10]:
            print(f"    {line}", file=sys.stderr)
        print("", file=sys.stderr)
    print("Fix these issues before committing.", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
