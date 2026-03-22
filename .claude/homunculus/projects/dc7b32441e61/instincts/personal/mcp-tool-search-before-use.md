---
id: mcp-tool-search-before-use
trigger: when needing to use MCP tools or Playwright browser interactions
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# MCP Tool Discovery via ToolSearch

## Action
Before invoking an MCP tool (Playwright, browser automation), use ToolSearch to discover available tools and confirm they exist.

## Evidence
- Observed 3 times in session 8aa114c3-6cd0-4154-84e9-d3eea7189fd6
- Pattern: ToolSearch called with `select:mcp__playwright__browser_*` queries to find navigate, screenshot, wait_for, evaluate tools
- Timestamps: 03:24:08, 03:24:20, 03:26:34
- Workflow: Search for tool → Get results list → Invoke found tool
- Last observed: 2026-03-19T03:26:34Z

## Context
The user consistently uses ToolSearch before invoking MCP/Playwright tools, suggesting either discovery of available functionality or verification that tools exist before use. This prevents blind invocations and ensures tool availability is confirmed.
