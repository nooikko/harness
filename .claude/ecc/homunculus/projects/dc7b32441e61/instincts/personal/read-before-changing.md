---
id: read-before-changing
trigger: when investigating unexpected behavior, port conflicts, or system issues
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Read System Files Before Making Changes

## Action
When troubleshooting or investigating issues, read relevant system files to understand current state before making modifications.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Reading send-message.ts, design/package.json, and music plugin index before diagnosing port conflicts and coverage issues
- Last observed: 2026-03-16T20:49:02Z
- Context: Port troubleshooting (404 error on localhost:4001) and music plugin coverage gate issues

## Related Workflow
This typically precedes diagnostic Bash operations (curl, lsof) and configuration edits (port number changes). Reading provides context needed to make targeted fixes rather than guessing at solutions.
