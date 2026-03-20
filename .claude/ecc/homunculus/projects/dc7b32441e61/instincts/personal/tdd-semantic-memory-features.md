---
id: tdd-semantic-memory-features
trigger: when developing SEMANTIC memory system features in the identity plugin
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test-First Development for SEMANTIC Memory Features

## Action
Write comprehensive test cases first that verify expected SEMANTIC memory behavior (synthesis triggers, scoring boost, display formatting), then run tests to identify implementation gaps.

## Evidence
- Observed 3+ edits on identity plugin test files in session d459a209-ca00-4c9e-8430-f638aa20f47e
  - `score-and-write-memory.test.ts`: Added userFact detection and synthesis trigger tests
  - `retrieve-memories.test.ts`: Added SEMANTIC boost and slot guarantee tests
  - `format-identity-header.test.ts`: Added "What I Know About You" section tests
- Pattern: Each test file covers a different aspect of SEMANTIC memory behavior
- Tests written before implementation complete (2 test failures followed by fixes)
- Last observed: 2026-03-18T01:11:50Z

## Notes
Tests verify distinct SEMANTIC memory properties independently:
- Synthesis triggers when userFact present
- SEMANTIC memories score higher than EPISODIC of same recency/importance
- At least 2 SEMANTIC memories guaranteed in retrieval results
- SEMANTIC memories display without date/type prefixes in identity header
