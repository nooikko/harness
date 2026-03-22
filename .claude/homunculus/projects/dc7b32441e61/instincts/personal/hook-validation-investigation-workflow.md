---
id: hook-validation-investigation-workflow
trigger: when edit/write triggers hook validation blocking or warnings
confidence: 0.65
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Hook Validation Investigation Workflow

## Action
When a file write/edit is blocked by hook validation, immediately investigate the specific rule violation via bash commands before attempting to correct and retry the write.

## Evidence
- Edit at 2026-03-14T03:48:59 followed by bash hook investigation at 03:49:04, 03:49:05, 03:49:18, 03:49:19
- Edit at 2026-03-14T03:50:00 followed by bash Prisma hook debugging at 03:50:26, 03:50:27, 03:50:31
- Pattern: After each hook block, bash commands examine hook source and exit codes to understand validation logic
- Common hook violations: Direct Prisma client instantiation (new PrismaClient), direct process.env access, test files outside __tests__/ directories
- Hooks provide specific error messages and correction guidance
- Last observed: 2026-03-14T03:50:37

## Reasoning
The harness project uses PreToolUse hooks to enforce code patterns (connection pooling via database package, validated env.ts modules, test colocation). Understanding the specific rule prevents repeated validation failures.
