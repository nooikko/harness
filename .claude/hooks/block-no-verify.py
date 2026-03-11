#!/usr/bin/env python3
"""
PreToolUse hook: Block git commit --no-verify.
Exit 2 = block the tool call.
"""
import json
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

if input_data.get("tool_name") != "Bash":
    sys.exit(0)

command = input_data.get("tool_input", {}).get("command", "")
if not command:
    sys.exit(0)

if "git" in command and ("--no-verify" in command or " -n " in command or command.endswith(" -n")):
    print("Commit blocked: --no-verify is not allowed. Git hooks enforce code quality.", file=sys.stderr)
    print("", file=sys.stderr)
    print("The pre-commit hook runs:", file=sys.stderr)
    print("  - Type checking (pnpm type-check)", file=sys.stderr)
    print("  - Linting (pnpm lint)", file=sys.stderr)
    print("  - Monorepo dependency validation (sherif)", file=sys.stderr)
    print("", file=sys.stderr)
    print("Fix any issues reported by the hooks instead of bypassing them.", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
