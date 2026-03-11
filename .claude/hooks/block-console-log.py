#!/usr/bin/env python3
"""
PreToolUse hook: Block console.log/warn/error/debug/info in application code.

All logging must use @repo/logger for structured output, OpenTelemetry
integration, and proper log levels. console.* is only permitted in test
files and build-time config.

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

# Exempt test files
if "/__tests__/" in file_path:
    sys.exit(0)

# Exempt config files
basename = os.path.basename(file_path)
if ".config" in basename or ".setup" in basename:
    sys.exit(0)

# Check content
console_pattern = re.compile(r"console\.(log|warn|error|debug|info)\s*\(")

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
    match = console_pattern.search(line)
    if match:
        violations.append((match.group(0).rstrip("("), stripped[:120]))

if violations:
    print(f"console.* usage blocked in {basename}:", file=sys.stderr)
    print("", file=sys.stderr)
    for method, text in violations:
        print(f"  [{method}] {text}", file=sys.stderr)
    print("", file=sys.stderr)
    print("Use @repo/logger instead:", file=sys.stderr)
    print("  import { createPinoLogger } from '@repo/logger';", file=sys.stderr)
    print("  const logger = createPinoLogger({ serviceName: 'my-service' });", file=sys.stderr)
    print("  logger.info('message');", file=sys.stderr)
    print("  logger.error('something failed', { error });", file=sys.stderr)
    print("", file=sys.stderr)
    print("For local dev, set PRETTY_LOGS=true for human-readable output.", file=sys.stderr)
    print("", file=sys.stderr)
    print("Exempt: __tests__/ directories, *.config.* files", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
