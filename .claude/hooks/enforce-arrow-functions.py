#!/usr/bin/env python3
"""
PostToolUse hook: Warn when function keyword declarations are used.

Checks written/edited TypeScript files for `function` keyword and warns.
Non-blocking: always exits 0.
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

ext = os.path.splitext(file_path)[1].lower()
if ext not in (".ts", ".tsx", ".js", ".jsx"):
    sys.exit(0)

if not os.path.isfile(file_path):
    sys.exit(0)

basename = os.path.basename(file_path)
skip_patterns = [
    "config", ".config.", "next.config", "vitest.config",
    "tailwind.config", "postcss.config",
    "generated", ".d.ts", "instrumentation",
]
if any(pat in basename for pat in skip_patterns):
    sys.exit(0)

try:
    with open(file_path, "r") as f:
        lines = f.readlines()
except Exception:
    sys.exit(0)

func_pattern = re.compile(
    r"^[\s]*(export\s+)?(export\s+default\s+)?(async\s+)?function\s+\w+",
)

violations = []
for i, line in enumerate(lines, 1):
    stripped = line.strip()
    if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
        continue
    if func_pattern.match(line):
        violations.append((i, stripped[:80]))

if violations:
    print(f"Arrow function style: {basename}:", file=sys.stderr)
    for line_num, text in violations[:5]:
        print(f"  Line {line_num}: {text}", file=sys.stderr)
    if len(violations) > 5:
        print(f"  ... and {len(violations) - 5} more", file=sys.stderr)
    print("  Prefer: const foo = () => { ... }", file=sys.stderr)

sys.exit(0)
