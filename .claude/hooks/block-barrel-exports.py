#!/usr/bin/env python3
"""
PreToolUse hook: Block barrel exports (export * from) in app code.

Package entry points (packages/*/src/index.ts) are exempt since they
legitimately re-export package contracts (Prisma generated types, UI
components, etc.). All other files must use named exports.

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

tool_input = input_data.get("tool_input", {})
file_path = tool_input.get("file_path", "")
if not file_path:
    sys.exit(0)

ext = os.path.splitext(file_path)[1].lower()
if ext not in (".ts", ".tsx", ".js", ".jsx"):
    sys.exit(0)

# Exempt package entry points — barrel exports are the standard pattern
# for package contracts (e.g., packages/database/src/index.ts)
project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
rel_path = os.path.relpath(file_path, project_dir)

if rel_path.startswith("packages/") and rel_path.endswith(("/index.ts", "/index.tsx", "/index.js")):
    sys.exit(0)

# Check the content being written/edited for barrel exports
barrel_pattern = re.compile(r"export\s+\*\s+from\s+")

content = ""
if tool_name == "Write":
    content = tool_input.get("content", "")
elif tool_name == "Edit":
    content = tool_input.get("new_string", "")

if not content:
    sys.exit(0)

violations = []
for i, line in enumerate(content.splitlines(), 1):
    stripped = line.strip()
    if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
        continue
    if barrel_pattern.search(line):
        violations.append((i, stripped[:100]))

if violations:
    print(f"Barrel export blocked in {os.path.basename(file_path)}:", file=sys.stderr)
    print("", file=sys.stderr)
    for line_num, text in violations:
        print(f"  {text}", file=sys.stderr)
    print("", file=sys.stderr)
    print("Use named exports instead: export { Foo, Bar } from './module';", file=sys.stderr)
    print("", file=sys.stderr)
    print("Exempt: packages/*/src/index.ts (package entry points)", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
