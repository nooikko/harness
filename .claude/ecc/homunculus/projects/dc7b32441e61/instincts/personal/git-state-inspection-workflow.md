---
id: git-state-inspection-workflow
trigger: when starting code review or before running quality checks
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Git State Inspection Workflow

## Action
Run git status, git diff, and git log in sequence before running linting, tests, or code review to establish baseline state of working tree and understand what changes are staged.

## Evidence
- Observed 5+ times in session 4856ee0a on 2026-03-15
- Pattern: Sequential git commands executed within 30 seconds (22:43:29-22:44:01)
  - 22:43:29 git status (shows 20+ modified files and untracked files)
  - 22:43:30 git diff (summary of 20 files changed, 608 insertions)
  - 22:43:31 git log (shows 5 recent commits)
  - 22:43:59 git diff (detailed view of changes)
  - 22:44:01 git diff (larger output showing 45 files changed, 2766 insertions)
- Always executed before linting/test runs
- Last observed: 2026-03-15T22:44:01Z

## Context
This workflow establishes working tree baseline before quality checks. Confirms all expected changes are present, no unintended modifications exist, and understanding what was implemented before running automated checks.
