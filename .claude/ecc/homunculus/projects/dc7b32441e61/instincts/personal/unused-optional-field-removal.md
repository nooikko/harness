---
id: unused-optional-field-removal
trigger: when an optional field in a type definition becomes unused across all implementations
confidence: 0.6
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Systematic Removal of Unused Optional Fields

## Action
When removing an optional field from a type definition, search all implementations and test files to remove the field from destructuring, parameter passing, and test assertions—don't leave orphaned references.

## Pattern
1. Identify the optional field to remove from the type definition
2. Remove it from the type itself
3. Search codebase for all references (destructuring, property access, parameter passing)
4. Remove from implementation files (hooks, functions, handlers)
5. Remove from test files (assertions about the field, mock setup expectations)
6. Use grep to verify no orphaned references remain
7. Run tests to confirm removal doesn't break anything

## Evidence
- Observed 3+ times in session 3181ed5e-cfb1-460f-be14-00d833096f5e (2026-03-18)
  - `traceId?: string;` removed from `UsageMetricData` type in record-usage-metrics.ts
  - `traceId` removed from destructuring in metrics/index.ts hook
  - `traceId` removed from `recordUsageMetrics` call in metrics/index.ts
  - Test expectation for traceId removed from index.test.ts
  - Test case "does not include traceId in tags even when provided" removed from record-usage-metrics.test.ts
  - Grep used to verify no remaining references to traceId in usage context
  - All tests passing after cleanup
- Pattern: Comprehensive cleanup across type, implementation, and tests
- Last observed: 2026-03-18T18:16:59Z

## Why This Pattern Matters
Orphaned optional fields that are no longer used (not destructured, not read) create dead code and test maintenance burden. Systematic cleanup ensures type definitions match actual implementation behavior and prevents false assumptions about what data is being tracked or passed around.
