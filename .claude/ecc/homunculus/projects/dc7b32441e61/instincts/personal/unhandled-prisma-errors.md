---
id: unhandled-prisma-errors-in-tool-handlers
trigger: when writing tool handlers that call ctx.db operations
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Unhandled Prisma Errors in Tool Handlers

## Action
Wrap all Prisma operations in tool handlers with try/catch and return a string error message instead of throwing.

## Evidence
- Observed 3 times in sessions 980fccb2-ec01-48f5-b2ba-aa84b2c61eb3 and 4cb4a5e3-7c78-4cbb-a77a-18a7f444790b
- Pattern: `await ctx.db.*.update/create/createMany` without error handling, Prisma errors (P2025, P2003) propagate unhandled through tool server
- `project` plugin `set_project_memory`: P2025 if project deleted between read and write
- `tasks` plugin `complete-task`: P2025 if task deleted between findUnique and update
- `tasks` plugin `add-task`: P2003 if any FK in blockedBy doesn't exist
- Last observed: 2026-03-18

## Notes
- Tool handlers return `ToolResult` (string or { text, blocks }), so catch and return friendly string message
- P2003 (FK constraint), P2025 (record not found) are the most common issues in these plugins
- This pattern affects data integrity: unhandled errors leave partial DB state and confuse Claude
