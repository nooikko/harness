---
id: plugin-integration-testing
trigger: when writing integration tests for harness plugins
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Integration Testing Pattern

## Action
When testing harness plugins, use createTestHarness() to set up a fully functional orchestrator, set up test database state with PrismaClient, retrieve tools from plugin.tools, invoke handlers directly with test context, and verify results against database or return values.

## Evidence
- Observed 6+ times across project-plugin.test.ts and time-plugin.test.ts
- Pattern: beforeEach resetDatabase → createTestHarness → prisma.record.create → orchestrator.getContext() → plugin.tools.find().handler() → expect result
- Last observed: 2026-03-17 during playwright plugin test writing
- Helper functions exist at tests/integration/helpers/create-harness.ts (createTestHarness, createMultiPluginHarness)

## Context
Each integration test follows this structure:
1. PrismaClient connects to TEST_DATABASE_URL
2. beforeEach calls resetDatabase()
3. Test body: createTestHarness(plugin) → setup state → invoke tool → verify
4. afterEach calls harness.cleanup()
5. afterAll disconnects prisma

This pattern is established across all plugin tests in tests/integration/.
