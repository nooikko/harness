---
id: lint-commit-verify-push-sequence
trigger: when completing changes and pushing to remote
confidence: 0.75
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Lint-Commit-Verify-Push Sequential Workflow

## Action
When finalizing changes, follow this sequence: stage files → lint-staged (auto-format and lint) → commit with message → run sherif verification → push to remote. Don't skip the verification step after commit.

## Evidence
- Observed 5 complete cycles in session 9fc9b500-3fe7-4994-9892-df5e7e684625 (2026-03-14)
- Timestamps: 08:26:44, 08:27:00, 08:27:05, 08:27:19, 08:32:22 (plus final push at 08:32:22)
- Each cycle follows: Bash edits → lint-staged task → git commit → sherif check → git push
- Pattern: Sherif (linter verification) runs AFTER commit, before pushing to remote
- Ensures code quality gate passes before remote gets new commits
- Last observed: 2026-03-14T08:32:22Z

## Rationale
Sequential verification (lint → commit → sherif → push) catches quality issues before they reach the remote. The post-commit verification step is critical for catching linter failures that might have slipped through staging.
