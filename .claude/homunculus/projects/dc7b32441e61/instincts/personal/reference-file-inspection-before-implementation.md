---
id: reference-file-inspection-before-implementation
trigger: when implementing server actions for a new entity or feature domain
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Reference File Inspection Before Implementation

## Action
Before implementing new server actions, read existing similar implementations (generic pattern, domain-specific pattern, and list-type pattern) to understand the codebase conventions.

## Evidence
- Observed 3 instances in session 7e9d4927-d925-42d1-9e06-58777b02c63b on 2026-03-18
- Pattern: When implementing Story CRUD server actions, read:
  1. `create-story-thread.ts` (domain-specific pattern)
  2. `create-thread.ts` (generic CRUD pattern)
  3. `list-agents.ts` (list/query pattern)
- Also reads test files (`create-story-thread.test.ts`, `delete-project.test.ts`) to understand testing conventions
- Dispatch to implementation agent includes file references: "Read... for the existing story thread action pattern" and "Read... for the exact pattern"

## Notes
This is a deliberate research-before-coding workflow. The user establishes pattern understanding by sampling different implementation styles (generic, domain-specific, and list queries) before writing new code. This helps ensure consistency and idiomatic style within the codebase. Consider proactively suggesting reference files when implementing new server actions.
