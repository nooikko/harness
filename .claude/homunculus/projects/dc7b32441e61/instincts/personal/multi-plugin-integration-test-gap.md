---
id: multi-plugin-integration-test-gap
trigger: when reviewing integration test coverage and reading individual plugin test files
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Multi-Plugin Integration Test Gap

## Action
When individual plugin tests exist but create-harness helper only registers one plugin at a time, extend the test infrastructure with a multi-plugin variant to verify system behavior with all plugins wired together.

## Evidence
- Observed 8 Read operations on individual plugin integration test files (discord, audit, auto-namer, summarization, project, identity, context, delegation plugins)
- Each test uses createTestHarness(plugin) which registers only ONE plugin
- Plan file explicitly identified "Single-Plugin Isolation Problem" as major gap
- No full-pipeline test exists that boots orchestrator with all 15 plugins
- Plugin interactions (identity→context prompt chain ordering) untested
- Fire-and-forget background tasks only tested with vi.waitFor polls, not with full pipeline
- Last observed: 2026-03-14

## Context
The test suite has comprehensive unit and single-plugin integration coverage, but the critical gap is:
- Individual plugins tested in isolation (1 plugin + mocked invoker)
- Real orchestrator boots all plugins simultaneously in production
- Plugin hook ordering (onBeforeInvoke chain) never verified with full set
- Error isolation between plugins untested

## Pattern
When investigating test gaps: read 5+ similar test files → identify they all test single instances → recognize infrastructure limitation → plan extension to multi-instance variant.
