---
id: bash-search-overuse
trigger: when attempting to search files or content with Bash instead of dedicated tools
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Use Dedicated Tools for Search, Not Bash

## Action
Use Glob for file pattern matching and Grep for content search instead of running `find`, `ls`, or `grep` commands in Bash.

## Evidence
- Observed 7+ times across sessions (initial: 2464ac8f-58a5-496a-b12e-600dcb754571, recent: b2ed7404-0359-4731-8614-8d1c4df95a8c)
- Pattern: Bash commands executing `find` operations (e.g. finding plugin test files), `grep` operations on file contents, and `ls` directory operations when Glob and Grep tools are available
- Recent observations (2026-03-17): `ls` to explore AI_RESEARCH files, `find` for layout files, `ls` for admin directory during harness analysis
- Last observed: 2026-03-17 18:36:39Z

## Why
- Dedicated tools provide better UX for the user (clearer diff visibility)
- Dedicated tools maintain better context isolation
- System prompt explicitly discourages Bash for these operations: "Do NOT use the Bash to run commands when a relevant dedicated tool is provided"

## How to Apply
- Replace `find` with Glob tool
- Replace `grep` / `rg` with Grep tool
- Use Bash only for system operations that don't have dedicated equivalents (git commands, npm/pnpm, deployment tasks, etc.)
