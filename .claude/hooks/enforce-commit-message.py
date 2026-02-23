#!/usr/bin/env python3
"""
PreToolUse hook: Enforce conventional commit message format.

When working on taskmaster tasks (detected by task-master set-status in recent
commands or in-progress tasks), commit messages should reference the task ID.

Format: feat(task-{id}): description
        fix(task-{id}): description
        chore(task-{id}): description

Also enforces general conventional commit format (type: description) for
non-task commits.
"""
import json
import re
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

if "git commit" not in command:
    sys.exit(0)

# Extract commit message from -m flag
# Handle both single-line -m "msg" and heredoc patterns
msg_match = re.search(r'-m\s+["\'](.+?)["\']', command, re.DOTALL)
if not msg_match:
    # Try heredoc pattern: -m "$(cat <<'EOF' ... EOF )"
    heredoc_match = re.search(r"cat\s+<<['\"]?EOF['\"]?\n(.+?)\nEOF", command, re.DOTALL)
    if not heredoc_match:
        # Can't parse message, allow it through
        sys.exit(0)
    msg = heredoc_match.group(1).strip()
else:
    msg = msg_match.group(1).strip()

# Get first line of commit message
first_line = msg.split("\n")[0].strip()

# Conventional commit pattern: type(optional-scope): description
conventional_pattern = r"^(feat|fix|chore|refactor|docs|test|style|perf|ci|build|revert)(\(.+?\))?: .+"

if not re.match(conventional_pattern, first_line):
    print(
        "❌ Commit message must follow conventional commit format:\n"
        "  type(scope): description\n\n"
        "  Valid types: feat, fix, chore, refactor, docs, test, style, perf, ci, build, revert\n"
        "  When working on a task: feat(task-1): implement feature X\n\n"
        f'  Got: "{first_line}"',
        file=sys.stderr,
    )
    sys.exit(2)

sys.exit(0)
