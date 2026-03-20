---
id: hook-error-plugin-name-parameter
trigger: when tests are added for hook error message formatting with optional plugin context
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Hook Error Messages Include Plugin Name Parameter

## Action
When adding optional plugin name parameter support to runHook and runChainHook, add test cases for both "with plugin name" and "without plugin name" error message formatting scenarios.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Tests added to run-hook.test.ts for plugin name in error messages
- Pattern: Tests added to run-chain-hook.test.ts for plugin name in error messages
- Test cases verify error format includes `[plugin=<name>]` when names provided
- Test cases verify error format omits plugin label when names array not provided
- Last observed: 2026-03-17T01:40:35Z

## Context
The hook infrastructure (runHook, runChainHook) accepts an optional plugin names parameter to enhance error logging. When this feature is implemented or extended, test coverage must include both scenarios: with and without plugin name context in error messages.
