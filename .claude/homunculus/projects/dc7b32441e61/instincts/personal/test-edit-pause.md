---
id: test-edit-pause
trigger: when repeatedly failing tests trigger immediate edit-then-retest cycles
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Pause Before Edit in Test Cycles

## Action
When a test fails multiple times in succession, pause to read the actual error message and component code before editing—don't immediately re-edit and re-run.

## Evidence
- Observed 6+ cycles of: Bash (test fails) → Edit → Bash (test fails again) with minimal changes between iterations
- Pattern shows reactive editing without understanding root cause
- Real breakthrough came only after reading the component implementation (code-block.tsx) and understanding the testability issue
- Last observed: 2026-03-14T21:56:47Z (Read component after 6+ failed test-edit cycles)

## Problem Context
Reactive editing without understanding failures leads to:
- Multiple attempts at different mocking strategies without clear reason
- Wasted effort on approaches that can't possibly work (e.g., trying different Object.defineProperty configurations when the real issue is jsdom's read-only navigator)
- Delays in finding the actual solution

## Solution Pattern
When a test fails 2-3 times in the same way:
1. Stop and read the actual component code
2. Understand what the component is testing
3. Identify testability gaps in the component itself
4. Consider refactoring the component (not just the test) to be more testable
5. Then apply test fixes

This often uncovers that the component design itself needs adjustment, not just the test setup.
