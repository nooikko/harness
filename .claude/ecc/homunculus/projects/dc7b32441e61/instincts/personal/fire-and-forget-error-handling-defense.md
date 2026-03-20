---
id: fire-and-forget-error-handling-defense
trigger: when identifying fire-and-forget operations in async code
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Fire-and-Forget Operations Require Explicit Error Handling

## Action
When auditing fire-and-forget code, ensure every async operation has explicit error handling: either wrapping in try/catch, adding .catch() handler, or documenting why errors are intentionally ignored. Never rely on implicit error swallowing (e.g., runHook swallowing errors).

## Evidence
- Observed 3 times in agent-stability-audit.md (session 31c444d9)
- Pattern: Async operations spawned without blocking (void prefix, .catch() missing) that fail silently when errors occur
- Specific examples:
  - H4: `sendToThread` broadcast safe only because `runHook` swallows errors — fragile contract
  - H6: `void scoreAndWriteMemory(...)` discards promise, DB errors become unhandled rejections
  - L4: Nested fire-and-forget in reflection IIFE lacks .catch() — double unhandled rejection risk
- Last observed: 2026-03-17T23:44:53Z

## Rationale
Fire-and-forget operations that don't explicitly handle errors are latent bugs waiting for upstream code changes. Errors silently vanish, making problems hard to debug in production. Explicit error handling (try/catch or .catch()) with context logging (threadId, agentId) prevents silent failures.
