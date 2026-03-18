#!/usr/bin/env python3
"""
Stop hook: Suggest documentation updates when source files changed.

Reads the accumulator file written by track-doc-changes.py. If
documentation-relevant source files were modified but no documentation
files were touched, outputs a block decision with specific guidance
on which docs to check.

CRITICAL: Checks stop_hook_active to prevent infinite loops. If Claude
was already told to continue once, we allow the stop unconditionally.
"""
import json
import os
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

# --- Infinite loop guard ---
# If the hook already fired and Claude continued, allow this stop.
if input_data.get("stop_hook_active", False):
    sys.exit(0)

session_id = input_data.get("session_id", "unknown")
accumulator_path = f"/tmp/claude-doc-changes-{session_id}.txt"

if not os.path.isfile(accumulator_path):
    sys.exit(0)

try:
    with open(accumulator_path, "r") as f:
        lines = f.read().strip().splitlines()
except Exception:
    sys.exit(0)

if not lines:
    sys.exit(0)

# Parse into source changes and doc changes
src_changes = set()
doc_changes = set()
for line in lines:
    parts = line.split("\t", 1)
    if len(parts) != 2:
        continue
    tag, path = parts
    if tag == "SRC":
        src_changes.add(path)
    elif tag == "DOC":
        doc_changes.add(path)

# If no source files changed, nothing to check
if not src_changes:
    sys.exit(0)

# If docs were already updated this session, likely fine
if doc_changes:
    sys.exit(0)

# --- Map source changes to relevant documentation ---

DOC_MAPPING = {
    "packages/plugin-contract/src/": [
        "docs/plugin-development.md (plugin contract, hooks, tools)",
    ],
    "apps/orchestrator/src/orchestrator/": [
        "docs/plugin-development.md (pipeline, hooks)",
        "docs/setup/environment.md (orchestrator config)",
    ],
    "apps/orchestrator/src/tool-server/": [
        "docs/plugin-development.md (tool registration)",
    ],
    "apps/orchestrator/src/plugin-registry/": [
        "docs/plugin-development.md (plugin registration)",
    ],
    "apps/orchestrator/src/invoker-sdk/": [
        "docs/setup/environment.md (invoker config)",
    ],
}

# Find which docs might be affected
affected_docs = {}
unmatched_src = []

for src_path in sorted(src_changes):
    matched = False
    for prefix, docs in DOC_MAPPING.items():
        if src_path.startswith(prefix):
            for doc in docs:
                affected_docs.setdefault(doc, []).append(src_path)
            matched = True
            break

    # Plugin index files
    if not matched and src_path.startswith("packages/plugins/") and src_path.endswith("/index.ts"):
        plugin_name = src_path.split("/")[2]
        doc = f"docs/plugin-development.md ({plugin_name} plugin)"
        affected_docs.setdefault(doc, []).append(src_path)
        matched = True

    if not matched:
        unmatched_src.append(src_path)

if not affected_docs:
    sys.exit(0)

# --- Build the suggestion ---

reason_parts = [
    "Documentation-relevant source files were modified this session "
    "but no documentation files were updated. Please review these docs "
    "for accuracy and update if needed:\n"
]

for doc, sources in sorted(affected_docs.items()):
    reason_parts.append(f"  - {doc}")
    for src in sources[:3]:
        reason_parts.append(f"      changed: {src}")
    if len(sources) > 3:
        reason_parts.append(f"      ... and {len(sources) - 3} more")

reason_parts.append(
    "\nRead each doc, compare against the current code, and update "
    "only sections that are now inaccurate. If docs are already correct, "
    "no changes needed."
)

decision = {
    "decision": "block",
    "reason": "\n".join(reason_parts),
}

json.dump(decision, sys.stdout)
sys.exit(0)
