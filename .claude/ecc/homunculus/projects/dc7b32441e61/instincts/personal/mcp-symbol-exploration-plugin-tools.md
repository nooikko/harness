---
id: mcp-symbol-exploration-plugin-tools
trigger: when investigating plugin architecture or how plugins define and export tools
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# MCP Symbol Exploration for Plugin Tool Investigation

## Action
Use `mcp__serena__get_symbols_overview` to inspect what tools each plugin exports when exploring plugin architecture or understanding tool integration patterns.

## Evidence
- Observed 8 consecutive times in session 3db3a930-228b-4cee-8665-92a3648dd54b (2026-03-17 17:23:55-17:23:57)
- Pattern: User grepped for "tools:" definitions, then systematically used MCP symbols to inspect each plugin (calendar, cron, delegation, identity, music, outlook, playwright, project, tasks, time)
- Context: During implementation of content-block system integration with multiple plugins
- Last observed: 2026-03-17 17:23:57

## Notes
This is a rapid-fire exploration technique for understanding how plugins structure their tool definitions and what gets exported. Used when context-switching between multiple plugin files or understanding plugin composition.
