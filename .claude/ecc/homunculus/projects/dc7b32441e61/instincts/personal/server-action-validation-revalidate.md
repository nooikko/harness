---
id: server-action-validation-revalidate
trigger: when implementing a server action ('use server') that modifies data
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Server Action Validation + Path Revalidation

## Action
All server actions that modify data must validate inputs before database/file operations, then call `revalidatePath()` after successful completion. For multi-step operations, validate at each stage with specific error messages.

## Evidence
- Observed 3 times in session 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1
- Pattern in create-thread.ts: Validates default agent lookup → creates thread → revalidatePath('/')
- Pattern in create-project.ts: Validates options → try-catch wrapper → revalidatePath('/chat')
- Pattern in upload-file.ts: Stage-gated validation (size, MIME type, scope/FK consistency) → write file → update DB → revalidatePath('/') with broadcast notifications
- Last observed: 2026-03-13T22:45:25Z

## Why
The harness consistently pairs data mutations with immediate cache invalidation. Omitting either validation or revalidatePath causes either data integrity issues or stale UI state. Multi-stage validations (like in upload-file) prevent partial failures.
