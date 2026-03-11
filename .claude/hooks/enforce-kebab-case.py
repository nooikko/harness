#!/usr/bin/env python3
"""
PreToolUse hook: Enforce kebab-case file naming convention.

Blocks file creation with PascalCase or camelCase names.
Exceptions for special files (__root, README, .env, AI_RESEARCH/, etc.)

Exit 2 = block the tool call.
"""
import json
import os
import re
import sys

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

# Ignore AI_RESEARCH directory
if "AI_RESEARCH" in file_path.split(os.sep):
    sys.exit(0)

# Ignore CLAUDE.md files
filename = os.path.basename(file_path)
if filename == "CLAUDE.md":
    sys.exit(0)

name_without_ext = os.path.splitext(filename)[0]

# Exception patterns
ALLOWED_PATTERNS = [
    r"^__.*__$",        # __root__, __index__
    r"^__.*$",          # __root, __init
    r"^\..*$",          # .gitignore, .env
    r"^README$",        # README files
    r"^LICENSE$",
    r"^CHANGELOG$",
    r"^CONTRIBUTING$",
    r"^CLAUDE$",        # CLAUDE.md
    r"^SKILL$",         # SKILL.md
    r"^[A-Z_]+$",       # ALL_CAPS files
]

for pattern in ALLOWED_PATTERNS:
    if re.match(pattern, name_without_ext):
        sys.exit(0)

# Kebab-case: lowercase letters, numbers, hyphens
kebab_case_pattern = r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$"

# Allow dot notation (e.g., vitest.config.ts) if each segment is kebab-case
if "." in name_without_ext:
    segments = name_without_ext.split(".")
    if all(re.match(kebab_case_pattern, seg) for seg in segments):
        sys.exit(0)

if not re.match(kebab_case_pattern, name_without_ext):
    has_uppercase = any(c.isupper() for c in name_without_ext)

    print(f"File name '{filename}' does not follow kebab-case naming convention.", file=sys.stderr)
    print("", file=sys.stderr)

    if has_uppercase:
        kebab_suggestion = re.sub(r"(?<!^)(?=[A-Z])", "-", name_without_ext).lower()
        extension = os.path.splitext(filename)[1]
        print(f"Suggestion: '{kebab_suggestion}{extension}'", file=sys.stderr)
    elif "_" in name_without_ext:
        print("Suggestion: Replace underscores with hyphens", file=sys.stderr)

    print("", file=sys.stderr)
    print("Required format: lowercase-with-hyphens.ext", file=sys.stderr)
    print("Examples: auth-form.tsx, api-client.ts, bill-classifier.ts", file=sys.stderr)
    print("", file=sys.stderr)
    print("Exceptions: __root, .env, README, CLAUDE.md, ALL_CAPS, AI_RESEARCH/", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
