---
id: git-change-review-workflow
trigger: when making changes to the codebase and staging commits
confidence: 0.7
domain: git
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Git Change Review Workflow

## Action
Inspect git changes (status and diff output) multiple times before committing or taking subsequent actions.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: User runs `git status`, `git diff --stat`, then `git diff` with full output, then `git status --short` again in rapid succession (within 75 seconds)
- Timestamps: 2026-03-15T23:12:35Z to 23:13:10Z
- Indicates thorough change review before committing

## Context
User validates and reviews file changes comprehensively before staging or committing, checking both summary stats and detailed diffs to ensure all changes are intentional.
