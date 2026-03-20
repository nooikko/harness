---
id: safe-error-message-extraction
trigger: when implementing error handling in server actions or async functions
confidence: 0.5
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Safe Error Message Extraction Pattern

## Action
When extracting error messages in try-catch blocks, always use the defensive pattern: `error instanceof Error ? error.message : String(error)` to safely handle unknown error types.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern in create-project.ts: `throw new Error(`Failed to create project: ${error instanceof Error ? error.message : String(error)}`)`
- Pattern in update-project.ts: `throw new Error(`Failed to update project: ${error instanceof Error ? error.message : String(error)}`)`
- Pattern in delete-project.ts: `throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`)`
- Last observed: 2026-03-15T23:46:26Z

## Rationale
JavaScript allows throwing any value (not just Error objects), and when caught, the type may be unknown. The pattern `error instanceof Error ? error.message : String(error)` safely handles this by checking the type before accessing `.message`, preventing runtime errors when non-Error values are thrown.
