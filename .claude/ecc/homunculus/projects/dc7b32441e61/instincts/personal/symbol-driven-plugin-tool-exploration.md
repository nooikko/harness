---
id: symbol-driven-plugin-tool-exploration
trigger: when implementing new plugin tools, extending plugin capabilities, or exploring plugin architecture
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Symbol-Driven Plugin Tool Exploration

## Action
When implementing new plugin tools, use `mcp__serena__find_symbol` and `mcp__serena__get_symbols_overview` to explore and understand existing plugin structure—particularly tool definitions, handler function signatures, and tool registration patterns—before writing new handlers.

## Evidence
- Observed 9 times in session 2464ac8f-58a5-496a-b12e-600dcb754571 (2026-03-14)
  - Context: Plugin tool implementation workflow
  - Targets: `PluginTool`, `PluginToolHandler`, tool definitions, handler types, `PluginToolMeta`
- Observed 9+ times in session 49317fb5-5d1c-4d9d-a68a-e4c80db55136 (2026-03-18)
  - Context: Identity plugin architecture understanding
  - Targets: `formatIdentityHeader`, `formatIdentityAnchor`, `formatBootstrapPrompt`, `loadAgent`, `updateAgentSelf`, `plugin/register`
- Pattern: Sequential symbol queries to understand plugin structure and function implementations
- Last observed: 2026-03-18T00:13:08Z

## Why
Plugins use consistent patterns for tool definition, handler implementation, and registration. Understanding these patterns via symbols before implementation ensures:
- New handlers follow existing type contracts
- Tool definitions use consistent schema structure
- Handlers are imported and registered correctly in the plugin index
- No manual file reading needed to find type definitions

## When to Use
- Adding new tools to an existing plugin
- Extending plugin functionality with new handlers
- Understanding how a plugin implements its core workflows (identity, memory, bootstrap, etc.)
- Exploring plugin architecture or function signatures before editing
- Implementing multi-operation tools (CRUD operations)
- Working with plugin systems you haven't recently reviewed
