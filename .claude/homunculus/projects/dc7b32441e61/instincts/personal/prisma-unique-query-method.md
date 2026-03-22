---
id: prisma-unique-query-method
trigger: when using Prisma to query by a unique field (e.g., name, email, id)
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Use findUnique Instead of findFirst for Unique Field Queries

## Action
Replace `findFirst({ where: { uniqueField: value } })` with `findUnique({ where: { uniqueField: value } })` when the query predicate uses a unique field.

## Evidence
- Observed 6 times across cron plugin helpers in session 2464ac8f-58a5-496a-b12e-600dcb754571
- Pattern: Switching from findFirst to findUnique in update-cron-job.ts, get-cron-job.ts, delete-cron-job.ts
- Also updated corresponding test mocks to match
- Last observed: 2026-03-14T21:12:26

## Rationale
- findUnique is semantically correct and more efficient for unique constraints
- Matches Prisma conventions: findFirst is for filtering, findUnique is for unique lookups
- Reduces cognitive load on readers who understand Prisma conventions
