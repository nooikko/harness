---
id: monorepo-workspace-test-execution
trigger: when running tests in this monorepo or setting up test commands
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Monorepo Workspace Test Execution Pattern

## Action
Run tests using each workspace package's own test script defined in its package.json via `pnpm test` from the package directory, rather than trying to run tests from root across multiple packages in a single command.

## Evidence
- Observed 8+ test execution patterns across multiple sessions:
  - Session 4856ee0a-a85e-44ce-988d-133f25f77051:
    - @harness/vector-search@0.1.0: `pnpm test` runs vitest for src/_helpers/__tests__/*.test.ts
    - web@0.1.0: separate test invocations with path patterns
    - integration-tests@0.0.1: `pnpm test:integration` with --testPathPattern flag
    - discord-plugin and other plugin tests running independently
  - Session 31c444d9-8205-4bd5-af0b-09f5495a3367 (2026-03-17T23:08:05Z):
    - `plugin-delegation` package isolated test run: 14 test files, 164 tests total (✓ all pass)
    - Shows individual package test formatting with timing per package
    - Tests grouped by workspace package namespace
- Each package maintains its own vitest.config.ts and test configuration
- Tests run with package-specific environment setup (testcontainers, database setup, etc.)
- Last observed: 2026-03-17T23:08:05Z (plugin-delegation comprehensive test suite)

## Implementation Details
- Each workspace package has its own test command in package.json
- Tests are run from the package directory or via full path specification
- Packages use consistent vitest configuration but with package-specific settings
- Integration tests require database/container setup managed per test suite
- This allows parallel test execution and package-specific test environments
