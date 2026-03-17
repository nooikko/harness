#!/usr/bin/env python3
"""
PreToolUse hook: Block direct Prisma client usage.

All Prisma access must go through @repo/database or @repo/athena-database.
Direct PrismaClient instantiation or imports from @prisma/client are blocked
to ensure connection pooling, Accelerate, and Edge compatibility.

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

# Exempt type declarations
if file_path.endswith(".d.ts"):
    sys.exit(0)

# Exempt database packages (they wrap Prisma)
project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
rel_path = os.path.relpath(file_path, project_dir)
if rel_path.startswith("packages/database/"):
    sys.exit(0)
if rel_path.startswith("packages/athena-database/"):
    sys.exit(0)

# Exempt integration tests (they need direct PrismaClient for testcontainer URL)
if rel_path.startswith("tests/integration/"):
    sys.exit(0)

# Exempt generated directories
if "/generated/" in rel_path:
    sys.exit(0)

# Check content
new_client_pattern = re.compile(r"new\s+PrismaClient")
direct_import_pattern = re.compile(r"""from\s+['"]@prisma/client['"]""")

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
    if new_client_pattern.search(line):
        violations.append(("new PrismaClient", stripped[:120]))
    if direct_import_pattern.search(line):
        violations.append(("@prisma/client import", stripped[:120]))

if violations:
    basename = os.path.basename(file_path)
    print(f"Direct Prisma client usage blocked in {basename}:", file=sys.stderr)
    print("", file=sys.stderr)
    for kind, text in violations:
        print(f"  [{kind}] {text}", file=sys.stderr)
    print("", file=sys.stderr)
    print("Import from the database package instead:", file=sys.stderr)
    print("  import { prisma } from '@repo/database';", file=sys.stderr)
    print("  import { prisma } from '@repo/athena-database';", file=sys.stderr)
    print("", file=sys.stderr)
    print("Exempt: packages/database/, packages/athena-database/, generated/", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
