#!/usr/bin/env python3
"""
PreToolUse hook: Block commits containing explicit `any` types.

Scans staged .ts/.tsx files for TypeScript `any` type usage and blocks
the commit if any are found. Catches patterns like `: any`, `as any`,
`<any>`, and `any[]`.

Exit 2 = block the tool call.
"""
import json
import os
import re
import subprocess
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

tool_name = input_data.get("tool_name", "")
if tool_name != "Bash":
    sys.exit(0)

command = input_data.get("tool_input", {}).get("command", "")
if not command or "git commit" not in command:
    sys.exit(0)

project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

# Get staged files
try:
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        capture_output=True,
        text=True,
        cwd=project_dir,
    )
    staged_files = [
        f
        for f in result.stdout.strip().splitlines()
        if f.endswith((".ts", ".tsx")) and not f.endswith(".d.ts")
    ]
except Exception:
    sys.exit(0)

if not staged_files:
    sys.exit(0)

# Patterns that indicate explicit `any` usage in TypeScript
# Matches: `: any`, `as any`, `<any>`, `<any,`, `any[]`, `any | `, ` | any`
ANY_PATTERN = re.compile(
    r"""
    (?::\s*any\b)        |  # type annotation  : any
    (?:\bas\s+any\b)     |  # type assertion    as any
    (?:<any[\s,>])       |  # generic param     <any> or <any,
    (?:\bany\s*\[\])     |  # array type        any[]
    (?:\bany\s*\|)       |  # union left        any |
    (?:\|\s*any\b)          # union right        | any
    """,
    re.VERBOSE,
)

# Lines to skip (comments, strings are harder — focus on obvious cases)
COMMENT_LINE = re.compile(r"^\s*(?://|/?\*|\*)")

violations = []

for filepath in staged_files:
    abs_path = os.path.join(project_dir, filepath)
    if not os.path.isfile(abs_path):
        continue

    # Get only the staged content (not working tree)
    try:
        staged_content = subprocess.run(
            ["git", "show", f":{filepath}"],
            capture_output=True,
            text=True,
            cwd=project_dir,
        )
        lines = staged_content.stdout.splitlines()
    except Exception:
        continue

    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        if COMMENT_LINE.match(stripped):
            continue
        if ANY_PATTERN.search(line):
            violations.append((filepath, line_num, stripped[:120]))

if violations:
    print(
        "❌ Commit blocked — explicit `any` types found:\n", file=sys.stderr
    )
    for filepath, line_num, text in violations[:20]:
        print(f"  {filepath}:{line_num}", file=sys.stderr)
        print(f"    {text}", file=sys.stderr)
    if len(violations) > 20:
        print(
            f"\n  ... and {len(violations) - 20} more violations",
            file=sys.stderr,
        )
    print(
        "\nReplace `any` with a proper type. No explicit `any` is allowed.",
        file=sys.stderr,
    )
    sys.exit(2)

sys.exit(0)
