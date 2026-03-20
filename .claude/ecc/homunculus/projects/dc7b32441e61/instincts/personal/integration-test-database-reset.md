---
id: integration-test-database-reset
trigger: when writing integration tests that use a real database
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Integration Test Database Reset Pattern

## Action
Call `resetDatabase(prisma)` in `beforeEach` hook to truncate all tables with `RESTART IDENTITY CASCADE` before each test, ensuring tests start with clean state.

## Evidence
- Observed 4+ times across integration test files
- Pattern applied consistently in: identity-plugin.test.ts, delegation-plugin.test.ts, cron-plugin.test.ts, web-plugin.test.ts
- SQL: `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` for all tables (Thread, Agent, AgentConfig, etc.)
- All integration tests use `beforeEach(async () => { await resetDatabase(prisma); })`
- Last observed: 2026-03-14

## Why
Prevents test pollution where one test's database state affects the next test. CASCADE ensures foreign key integrity during truncate.
