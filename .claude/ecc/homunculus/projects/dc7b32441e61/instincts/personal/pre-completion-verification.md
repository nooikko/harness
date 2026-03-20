---
id: pre-completion-verification-workflow
trigger: when completing a feature or fixing a bug
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Pre-Completion Verification Workflow

## Action
Launch typecheck, lint, and tests as parallel background tasks (Bash with run_in_background), then retrieve results using TaskOutput. This parallelizes independent verification tasks for speed rather than blocking sequentially.

## Evidence
- Observed 6 times in session 970f6bb0 (2026-03-13):
  - 3 task launches: typecheck, lint, tests at 22:59:48-49
  - 3 result retrievals via TaskOutput at 22:59:53-54
- Pattern: Bash backgroundTaskId generated for each task, results fetched later
- Applies across all packages in the monorepo (web, plugins, database, etc.)
- Last observed: 2026-03-13T22:59:54Z
