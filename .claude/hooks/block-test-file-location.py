#!/usr/bin/env python3
"""
PreToolUse hook: Block test files created outside __tests__/ directories.

Test files (*.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx) must live in
__tests__/ directories colocated with source code. This prevents test
files from being placed directly alongside source files.

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

filename = os.path.basename(file_path)

# Check if this is a test file
test_pattern = re.compile(r"\.(test|spec)\.(ts|tsx|js|jsx)$")
if not test_pattern.search(filename):
    sys.exit(0)

# Check if it's inside a __tests__/ directory
path_parts = file_path.replace("\\", "/").split("/")
if "__tests__" in path_parts:
    sys.exit(0)

# Exempt integration test directory (tests live directly in tests/integration/)
project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
rel_path = os.path.relpath(file_path, project_dir)
if rel_path.startswith("tests/integration/"):
    sys.exit(0)

# This is a test file NOT in a __tests__/ directory — block it
print(f"Test file '{filename}' must be inside a __tests__/ directory.", file=sys.stderr)
print("", file=sys.stderr)
print("Correct:   src/__tests__/my-module.test.ts", file=sys.stderr)
print("Incorrect: src/my-module.test.ts", file=sys.stderr)
print("", file=sys.stderr)
print("Tests are colocated with source code in __tests__/ folders.", file=sys.stderr)
sys.exit(2)
