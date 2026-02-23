#!/usr/bin/env python3
"""
Enforce kebab-case file naming convention.

This hook blocks file creation with PascalCase or camelCase names.
Exceptions are made for special files like __root, __index, etc.
"""
import json
import sys
import os
import re

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
    sys.exit(1)

# Only check Write tool
tool_name = input_data.get("tool_name", "")
if tool_name not in ("Write", "Edit"):
    sys.exit(0)

# Get the file path
file_path = input_data.get("tool_input", {}).get("file_path", "")
if not file_path:
    sys.exit(0)

# Ignore AI_RESEARCH directory and its contents
if "AI_RESEARCH" in file_path.split(os.sep):
    sys.exit(0)  # Allow any naming in AI_RESEARCH

# Extract filename without extension
filename = os.path.basename(file_path)
name_without_ext = os.path.splitext(filename)[0]

# Exception list: files that are allowed despite not being kebab-case
ALLOWED_PATTERNS = [
    r"^__.*__$",        # __root__, __index__, etc.
    r"^__.*$",          # __root, __init, etc.
    r"^\..*$",          # .gitignore, .env, etc.
    r"^README$",        # README files
    r"^LICENSE$",       # LICENSE files
    r"^CHANGELOG$",     # CHANGELOG files
    r"^CONTRIBUTING$",  # CONTRIBUTING files
    r"^[A-Z_]+$",       # ALL_CAPS files like TODO, USAGE_GUIDE
]

# Check if filename matches any allowed pattern
for pattern in ALLOWED_PATTERNS:
    if re.match(pattern, name_without_ext):
        sys.exit(0)  # Allow

# Kebab-case pattern: lowercase letters, numbers, and hyphens only
# Must start with a letter, can contain digits and hyphens
kebab_case_pattern = r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$"

# Check if filename contains dots (e.g., config files: tsup.config.ts)
# Each segment between dots should be kebab-case
if "." in name_without_ext:
    segments = name_without_ext.split(".")
    all_segments_valid = all(re.match(kebab_case_pattern, seg) for seg in segments)
    if all_segments_valid:
        sys.exit(0)  # Allow dot notation with kebab-case segments

if not re.match(kebab_case_pattern, name_without_ext):
    # Check if it's PascalCase or camelCase
    has_uppercase = any(c.isupper() for c in name_without_ext)
    has_underscore = "_" in name_without_ext

    error_msg = f"❌ File name '{filename}' does not follow kebab-case naming convention."
    print(error_msg, file=sys.stderr)
    print("", file=sys.stderr)

    if has_uppercase:
        # Convert to kebab-case suggestion
        kebab_suggestion = re.sub(r"(?<!^)(?=[A-Z])", "-", name_without_ext).lower()
        extension = os.path.splitext(filename)[1]
        print(f"Suggestion: '{kebab_suggestion}{extension}'", file=sys.stderr)
    elif has_underscore:
        print(f"Suggestion: Replace underscores with hyphens", file=sys.stderr)

    print("", file=sys.stderr)
    print("Required format: lowercase-with-hyphens.ext", file=sys.stderr)
    print("Examples: claude-chat.tsx, send-message.ts, api-client.ts", file=sys.stderr)
    print("", file=sys.stderr)
    print("Exceptions allowed:", file=sys.stderr)
    print("  • __root, __index (router files)", file=sys.stderr)
    print("  • .gitignore, .env (dotfiles)", file=sys.stderr)
    print("  • README, LICENSE, CHANGELOG (all caps)", file=sys.stderr)
    print("  • AI_RESEARCH/ directory (any naming)", file=sys.stderr)

    sys.exit(2)  # Block the command

sys.exit(0)  # Allow the command
