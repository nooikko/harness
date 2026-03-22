---
id: hook-inspection-constraint-discovery
trigger: when understanding or documenting project validation constraints
confidence: 0.6
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Hook File Inspection for Constraint Discovery

## Action
When investigating project validation rules or constraints, systematically examine the .claude/hooks/ directory to understand what patterns are enforced and what exemptions exist.

## Evidence
- Observed 3 times in session 361dcce6-c30d-4ae6-be23-6355b02f2a0f
- Pattern: Read block-direct-env-access.py → block-direct-prisma-client.py → block-test-file-location.py in sequence
- Last observed: 2026-03-17 during plugin integration testing setup
- Each hook file documents its own validation rules and exemptions clearly

## Context
The harness project uses PreToolUse hooks to enforce architectural constraints:
- block-direct-env-access.py: Forces env var access through validated env.ts modules
- block-direct-prisma-client.py: Forces Prisma access through @repo/database packages
- block-test-file-location.py: Forces test files into __tests__/ directories

When setting up new features or understanding project structure, reading these hooks provides definitive documentation of:
1. What patterns are blocked and why
2. Which paths/files are exempt
3. The exact validation logic
4. Error messages users will see

This is faster and more reliable than asking or guessing about constraints.
