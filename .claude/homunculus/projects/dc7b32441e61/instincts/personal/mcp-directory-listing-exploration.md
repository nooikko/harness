---
id: mcp-directory-listing-exploration
trigger: when exploring project structure, discovering files, or listing directory contents
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# MCP Directory Listing Tool for File Exploration

## Action
Use `mcp__serena__list_dir` (MCP directory listing tool) as primary method for discovering directory structure and file listings during exploration workflows, rather than relying solely on Bash `ls` commands.

## Evidence
- Observed 4 times in session b2ed7404-0359-4731-8614-8d1c4df95a8c (2026-03-17T17:50:50-17:51:00Z)
- Pattern: Sequential exploration of `/Users/quinn/dev/harness/AI_RESEARCH/` and `.claude/worktrees/file-upload/AI_RESEARCH/` using mcp__serena__list_dir for structured directory listings
- Returns structured JSON with `dirs` and `files` arrays, enabling programmatic file discovery
- Last observed: 2026-03-17 17:50:57Z

## Context
In the harness project, file exploration workflows frequently use mcp__serena__list_dir to list directories before performing pattern matching (Glob) or content retrieval (Read). This tool provides better structure than raw Bash output.
