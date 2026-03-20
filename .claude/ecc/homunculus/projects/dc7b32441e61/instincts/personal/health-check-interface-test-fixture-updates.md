---
id: health-check-interface-test-fixture-updates
trigger: when HealthCheckOptions or HealthStatus interface properties are expanded
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Health Check Interface Test Fixture Updates

## Action
When required properties are added to HealthCheckOptions (e.g., getPluginHealth) or HealthStatus (e.g., plugins), immediately scan and update all test instantiations of these types using TypeScript errors as a checklist.

## Evidence
- Observed 8+ test failures in health-check test suite when getPluginHealth was added to HealthCheckOptions
- Errors distributed across: createHealthCheck instantiations and createHealthServer mock instantiations
- Pattern: Each test setup that creates a HealthCheckOptions now requires getPluginHealth callback
- Each test setup for HealthStatus now requires plugins array
- TypeScript compiler output provided exact count and location of all failures
- Last observed: 2026-03-17T01:40:32Z

## Context
The health check system defines options and status types that are used throughout test fixtures. When these interfaces expand with required properties, the type errors cascade predictably and provide a complete map of affected tests.
