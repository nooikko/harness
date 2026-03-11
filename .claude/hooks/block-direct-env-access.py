#!/usr/bin/env python3
"""
PreToolUse hook: Block direct process.env access in application code.

Environment variables must be accessed through Zod-validated env.ts modules,
not read directly from process.env. This prevents typos, missing vars, and
unvalidated configuration from reaching runtime.

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
if ext not in (".ts", ".tsx"):
    sys.exit(0)

# Exempt env.ts files (the validated entry points themselves)
basename = os.path.basename(file_path)
if basename == "env.ts":
    sys.exit(0)

# Exempt config files (build-time, not runtime)
name_without_ext = os.path.splitext(basename)[0]
if ".config" in basename or ".setup" in basename:
    sys.exit(0)

# Exempt type declarations
if file_path.endswith(".d.ts"):
    sys.exit(0)

# Exempt typescript-config package (build tooling)
project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
rel_path = os.path.relpath(file_path, project_dir)
if rel_path.startswith("packages/typescript-config/"):
    sys.exit(0)

# Check content for direct process.env access
env_pattern = re.compile(r"process\.env\.")

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
    if env_pattern.search(line):
        violations.append(stripped[:120])

if violations:
    print(f"Direct process.env access blocked in {basename}:", file=sys.stderr)
    print("", file=sys.stderr)
    for text in violations:
        print(f"  {text}", file=sys.stderr)
    print("", file=sys.stderr)
    print("Use a Zod-validated env.ts module instead:", file=sys.stderr)
    print("  import { env } from './env';  // or '@/env'", file=sys.stderr)
    print("", file=sys.stderr)
    print("Exempt: env.ts files, *.config.* files, type declarations", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
