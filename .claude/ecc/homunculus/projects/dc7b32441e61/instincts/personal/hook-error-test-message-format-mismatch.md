---
id: hook-error-test-message-format-mismatch
trigger: when hook error test failures show "StringContaining" assertion mismatches with actual error message format
confidence: 0.65
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Hook Error Test Message Format Mismatch

## Action
When hook error handling tests fail with message format mismatches (e.g., test expects `StringContaining "onTaskCreate"` but receives `Hook "onTaskCreate" failed: ...`), investigate the hook infrastructure error message formatting in runHook or runChainHook to identify format changes that break test assertions.

## Evidence
- Observed 4 hook error test failures across multiple test runs in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Failing tests: "handles onTaskCreate hook errors gracefully", "handles onTaskFailed hook errors gracefully", "handles onTaskFailed throwing non-Error value", "handles onTaskCreate throwing non-Error value"
- Pattern: Same 4 failures persist across runs at 01:51:07Z and 01:51:25Z
- Investigation workflow: Grep at 01:51:19Z to find hook error tests → Read at 01:51:38Z to examine test expectations
- Error mismatch pattern: Test expects substring match but actual error format wraps hook names differently
- Last observed: 2026-03-17T01:51:38Z

## Context
When plugin names parameter was added to hook error messages, error formatting changed. Test assertions that checked for substring presence of hook names need updates to match new format that includes hook context like `Hook "onTaskCreate" failed:...` instead of just `onTaskCreate` string.

## Resolution Pattern
1. Run failing hook error tests to see exact message format mismatch
2. Grep for where hook error messages are formatted (runHook, runChainHook helpers)
3. Read test expectations to understand what assertions need updating
4. Update test error message matchers to expect new format
