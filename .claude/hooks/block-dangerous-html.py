#!/usr/bin/env python3
"""
PreToolUse hook: Block dangerouslySetInnerHTML usage.

dangerouslySetInnerHTML is an XSS vulnerability vector and is banned entirely.
Use React components for structured content or a safe sanitization library
if raw HTML is truly required.

Exit 2 = block the tool call.
"""
import json
import os
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
if ext not in (".tsx", ".jsx"):
    sys.exit(0)

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
    if "dangerouslySetInnerHTML" in line:
        violations.append(stripped[:120])

if violations:
    basename = os.path.basename(file_path)
    print(f"dangerouslySetInnerHTML blocked in {basename}:", file=sys.stderr)
    print("", file=sys.stderr)
    for text in violations:
        print(f"  {text}", file=sys.stderr)
    print("", file=sys.stderr)
    print("This is an XSS vulnerability vector. Use safe alternatives:", file=sys.stderr)
    print("  - React components to render structured content", file=sys.stderr)
    print("  - A sanitization library if raw HTML is truly required", file=sys.stderr)
    print("  - Markdown rendering via a safe parser", file=sys.stderr)
    print("", file=sys.stderr)
    print("If you believe this is a legitimate use case, discuss with the team first.", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
