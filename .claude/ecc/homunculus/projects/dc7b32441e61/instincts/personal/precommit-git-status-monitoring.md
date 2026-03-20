---
id: precommit-git-status-monitoring
trigger: when preparing to commit newly created files or staging changes
confidence: 0.5
domain: git
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Pre-commit Git Status Monitoring

## Action
Check git status multiple times during the pre-commit workflow to monitor the state of untracked and staged files before committing.

## Evidence
- Observed 3 times in session d92af9b6-092b-4ede-83b8-64e047815e17
- Pattern: Sequential git status checks at 19:30:42, 19:32:09, and 19:33:43 (3-4 minute intervals)
  - 19:30:42: Check untracked files after first commit (?? status)
  - 19:32:09: Verify same untracked files still present (no changes yet)
  - 19:33:43: Check that files are now staged (A flag - added to index)
- Followed by pre-commit hooks (biome, sherif, gitleaks) and commit at 19:34:05
- Last observed: 2026-03-18T19:33:43Z

## Context
This workflow monitors file state transitions during the pre-commit phase: from untracked → staged → ready for commit. Useful for verifying that files are progressing through the staging pipeline correctly before running linting and commit hooks.
