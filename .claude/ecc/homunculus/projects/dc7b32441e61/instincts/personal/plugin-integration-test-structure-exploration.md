---
id: plugin-integration-test-structure-exploration
trigger: when adding or improving plugin integration tests
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Integration Test Structure Exploration

## Action
Before implementing new tests for a plugin, systematically read the plugin's existing test file first to understand test patterns, then read the plugin's source code (index.ts) to understand what hooks and tools are available, then examine relevant helper files to understand the actual implementation being tested.

## Evidence
- Observed 4 times in session 089f503a-9242-463c-8b01-4fa9cbe0f7dd
- Pattern: Read test file → source/index.ts → helper files before writing tests
  1. cron: cron-plugin.test.ts (146 lines) → packages/plugins/cron/src/index.ts (93 lines) → handle-schedule-task.ts (64 lines)
  2. identity: identity-plugin.test.ts → packages/plugins/identity/src/index.ts → format-bootstrap-prompt.ts, update-agent-self.ts
  3. validator: validator-plugin.test.ts (94 lines) → packages/plugins/validator/src/index.ts (76 lines)
  4. delegation: delegation-plugin.test.ts (123 lines) → packages/plugins/delegation/src/index.ts (144 lines)
- Last observed: 2026-03-14T03:48:00Z

## Why
Integration tests in harness follow consistent patterns (beforeEach resetDatabase, afterEach cleanup, createTestHarness), but each plugin has unique hooks and tools. Reading the existing test file first reveals the local patterns. Reading plugin/index.ts reveals what hooks (onBeforeInvoke, onAfterInvoke, etc.) and MCP tools exist. Reading helpers reveals implementation details that tests may need to verify. This sequence prevents writing tests for hooks that don't exist or missing critical test cases for tools that are available.
