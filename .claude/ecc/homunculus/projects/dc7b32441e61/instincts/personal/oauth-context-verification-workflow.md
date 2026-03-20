---
id: oauth-context-verification-workflow
trigger: when modifying interconnected files in the OAuth or authentication flows
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Systematic Context Verification for Interconnected Files

## Action
When modifying files that have dependencies or call relationships, read related files to understand context before editing, then re-read the modified files to verify changes are correct.

## Evidence
- Observed 3+ times in session bbe56a1c-c659-48a9-87ca-5743e8ba37f1
- Pattern: Read file A → Edit → Read related file B (for context) → Edit A and B → Re-read to verify
- Specific instances:
  1. Read route.ts callback handler → Edit error handling → Read handle-oauth-callback helper → Edit both files
  2. Read microsoft.ts config → Read helper again → Read route.ts again (verification)
  3. Edit microsoft scopes → Update documentation immediately after
- Last observed: 2026-03-17T02:54:12Z
- Applies to OAuth implementation files: route.ts, handle-oauth-callback.ts, microsoft.ts, documentation

## Rationale
This workflow prevents breaking changes by understanding how code flows through related files before making edits, and verifies changes don't introduce inconsistencies.
