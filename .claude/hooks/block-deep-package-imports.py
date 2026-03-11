#!/usr/bin/env python3
"""
PreToolUse hook: Block deep imports into @repo/* package internals.

All @repo/* packages export from a single entry point. Importing subpaths
like '@repo/database/src/client' bypasses the public API and creates
brittle coupling to internal structure. Import from the package root instead.

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

# Exempt type declarations
if file_path.endswith(".d.ts"):
    sys.exit(0)

project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
rel_path = os.path.relpath(file_path, project_dir)

# Determine if this file is inside a @repo package (self-referential imports OK)
current_package = None
if rel_path.startswith("packages/"):
    parts = rel_path.split("/")
    if len(parts) >= 2:
        current_package = parts[1]  # e.g., "database", "logger"

# Check content for deep @repo imports
# Matches: from '@repo/foo/anything' or from "@repo/foo/anything"
deep_import_pattern = re.compile(r"""(?:from|import)\s+['"]@repo/([a-z0-9-]+)/(.+?)['"]""")

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
    match = deep_import_pattern.search(line)
    if match:
        package_name = match.group(1)
        subpath = match.group(2)
        # Allow self-referential imports (package importing its own internals)
        if current_package and package_name == current_package:
            continue
        violations.append((package_name, subpath, stripped[:120]))

if violations:
    basename = os.path.basename(file_path)
    print(f"Deep package import blocked in {basename}:", file=sys.stderr)
    print("", file=sys.stderr)
    for pkg, sub, text in violations:
        print(f"  @repo/{pkg}/{sub}", file=sys.stderr)
        print(f"    → use: @repo/{pkg}", file=sys.stderr)
    print("", file=sys.stderr)
    print("Import from the package entry point, not its internals.", file=sys.stderr)
    print("If the package doesn't export what you need, add it to the package's src/index.ts.", file=sys.stderr)
    print("", file=sys.stderr)
    print("Exempt: self-referential imports (package importing its own internals)", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
