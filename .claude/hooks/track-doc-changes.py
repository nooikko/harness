#!/usr/bin/env python3
"""
PostToolUse hook: Track documentation-relevant file changes.

Appends changed file paths to a session-scoped temp file when the
modified file is in a documentation-relevant location (source files,
plugin contracts, orchestrator, plugins) or is a docs/ file.
Skips tests, configs, and generated files.

The accumulator file is read by the Stop hook (suggest-doc-updates.py)
to decide whether documentation needs updating.

Non-blocking: always exits 0.
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

file_path = input_data.get("tool_input", {}).get("file_path", "")
if not file_path:
    sys.exit(0)

# Only track TypeScript/Markdown source files
ext = os.path.splitext(file_path)[1].lower()
if ext not in (".ts", ".tsx", ".md"):
    sys.exit(0)

project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
if not project_dir:
    sys.exit(0)

rel_path = os.path.relpath(file_path, project_dir)

# --- Skip non-documentation-relevant files ---

# Tests
if "__tests__" in rel_path or ".test." in rel_path or ".spec." in rel_path:
    sys.exit(0)

# Config and generated files
skip_suffixes = (".config.ts", ".setup.ts", ".d.ts")
if any(rel_path.endswith(s) for s in skip_suffixes):
    sys.exit(0)

# Node modules, build output
skip_prefixes = ("node_modules/", ".next/", "dist/", ".turbo/")
if any(rel_path.startswith(p) for p in skip_prefixes):
    sys.exit(0)

# --- Only track documentation-relevant paths ---

DOC_RELEVANT_PATHS = (
    "packages/plugin-contract/src/",
    "apps/orchestrator/src/orchestrator/",
    "apps/orchestrator/src/tool-server/",
    "apps/orchestrator/src/invoker-sdk/",
    "apps/orchestrator/src/plugin-registry/",
)

# Plugin index files (public API surface)
is_plugin_index = (
    rel_path.startswith("packages/plugins/")
    and rel_path.endswith("/index.ts")
    and "/src/" in rel_path
    and "/_" not in rel_path.split("/src/")[-1]
)

is_doc_relevant = any(rel_path.startswith(p) for p in DOC_RELEVANT_PATHS) or is_plugin_index

# Also track changes to docs/ files (to avoid suggesting updates when docs already touched)
is_doc_file = rel_path.startswith("docs/") and rel_path.endswith(".md")

if not is_doc_relevant and not is_doc_file:
    sys.exit(0)

# --- Append to session accumulator ---

session_id = input_data.get("session_id", "unknown")
accumulator_path = f"/tmp/claude-doc-changes-{session_id}.txt"

try:
    # Tag whether this is a doc file or a source file
    tag = "DOC" if is_doc_file else "SRC"
    with open(accumulator_path, "a") as f:
        f.write(f"{tag}\t{rel_path}\n")
except Exception:
    pass

sys.exit(0)
