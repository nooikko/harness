#!/usr/bin/env python3
import json
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
    sys.exit(1)

tool_name = input_data.get("tool_name", "")
if tool_name != "Bash":
    sys.exit(0)

command = input_data.get("tool_input", {}).get("command", "")
if not command:
    sys.exit(0)

# Check for --no-verify or -n flag in git commands
if "git" in command and ("--no-verify" in command or " -n " in command or command.endswith(" -n")):
    print("❌ Using --no-verify is not allowed. Git hooks are in place for code quality.", file=sys.stderr)
    print("", file=sys.stderr)
    print("The pre-commit hook runs:", file=sys.stderr)
    print("  • Type checking (pnpm type-check)", file=sys.stderr)
    print("  • Linting (pnpm lint)", file=sys.stderr)
    print("  • Monorepo dependency validation (sherif)", file=sys.stderr)
    print("", file=sys.stderr)
    print("Please fix any issues reported by the hooks instead of bypassing them.", file=sys.stderr)
    sys.exit(2)  # Exit code 2 blocks the command

sys.exit(0)  # Allow the command
