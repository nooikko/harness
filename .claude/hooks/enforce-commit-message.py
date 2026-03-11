#!/usr/bin/env python3
"""
PreToolUse hook: Enforce conventional commit message format.

Format: type(optional-scope): description

Valid types: feat, fix, chore, refactor, docs, test, style, perf, ci, build, revert, merge

Exit 2 = block the tool call.
"""
import json
import re
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

if input_data.get("tool_name") != "Bash":
    sys.exit(0)

command = input_data.get("tool_input", {}).get("command", "")
if not command or "git commit" not in command:
    sys.exit(0)

# Extract commit message — try heredoc pattern first (most common in Claude Code)
heredoc_match = re.search(r"cat\s+<<['\"]?EOF['\"]?\)?\n(.+?)\n\s*EOF", command, re.DOTALL)
if heredoc_match:
    msg = heredoc_match.group(1).strip()
else:
    # Fall back to simple -m flag
    msg_match = re.search(r'-m\s+["\'](.+?)["\']', command, re.DOTALL)
    if not msg_match:
        sys.exit(0)
    msg = msg_match.group(1).strip()

first_line = msg.split("\n")[0].strip()

# Conventional commit pattern
conventional_pattern = r"^(feat|fix|chore|refactor|docs|test|style|perf|ci|build|revert|merge)(\(.+?\))?: .+"

if not re.match(conventional_pattern, first_line):
    print(
        "Commit message must follow conventional commit format:\n"
        "  type(scope): description\n\n"
        "  Valid types: feat, fix, chore, refactor, docs, test, style, perf, ci, build, revert, merge\n"
        "  Examples:\n"
        "    feat(public-site): add donation form\n"
        "    fix(internal): resolve auth redirect loop\n"
        "    chore: update dependencies\n\n"
        f'  Got: "{first_line}"',
        file=sys.stderr,
    )
    sys.exit(2)

sys.exit(0)
