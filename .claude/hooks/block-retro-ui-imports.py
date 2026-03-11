#!/usr/bin/env python3
"""
PreToolUse hook: Block new imports from @repo/retro-ui.

The monorepo is migrating to @repo/shadcn-ui. No new imports from
@repo/retro-ui should be added. Existing imports in retro-ui's own
package and in storybook (which documents both) are exempt.

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

# Exempt retro-ui package itself and storybook
project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
rel_path = os.path.relpath(file_path, project_dir)

if rel_path.startswith("packages/retro-ui/"):
    sys.exit(0)
if rel_path.startswith("apps/storybook/"):
    sys.exit(0)

# Check the content being written/edited
retro_import = re.compile(r"""(?:from|import)\s+['"]@repo/retro-ui['"]""")

content = ""
if tool_name == "Write":
    content = tool_input.get("content", "")
elif tool_name == "Edit":
    content = tool_input.get("new_string", "")

if not content:
    sys.exit(0)

if retro_import.search(content):
    print("Import from @repo/retro-ui blocked.", file=sys.stderr)
    print("", file=sys.stderr)
    print("@repo/retro-ui is being phased out. Use @repo/shadcn-ui instead.", file=sys.stderr)
    print("", file=sys.stderr)
    print("Replace: import { Button } from '@repo/retro-ui'", file=sys.stderr)
    print("   With: import { Button } from '@repo/shadcn-ui'", file=sys.stderr)
    print("", file=sys.stderr)
    print("Exempt: packages/retro-ui/ (internal), apps/storybook/ (documents both)", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
