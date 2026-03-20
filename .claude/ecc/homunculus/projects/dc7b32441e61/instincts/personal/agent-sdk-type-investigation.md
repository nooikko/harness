---
id: agent-sdk-type-investigation
trigger: when researching Agent SDK types, session management, MCP configuration, or Query interface
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Agent SDK Type Investigation Pattern

## Action
When exploring Agent SDK types and APIs, combine local type definition searches (Grep on .d.ts) with official documentation fetches (WebFetch code.claude.com) to understand MCP servers, Query interface, and session management.

## Evidence
- Session 55ffe247-90c3-437a-8686-93ebe144acce (2026-03-14): 3+ reads of SDK types and session management
- Session 31c444d9-8205-4bd5-af0b-09f5495a3367 (2026-03-17): Reinforced pattern with 13 coordinated tool invocations:
  - Grep on sdk.d.ts: 5 searches (MCP server configs, Query interface, deprecated methods)
  - Read from sdk.d.ts: 4 reads (Query interface lines 1029–1169, control methods, async generators)
  - WebFetch official docs: 4 fetches (code.claude.com docs index, hooks reference)
- Focused areas: `McpServerConfig` types, `Query` interface with control methods, `SDKMessage` types, hook lifecycle
- Last observed: 2026-03-17T18:25:29Z
- Pattern: Searches → targeted reads of sections → documentation for context

## Context
The harness project manages warm Agent SDK sessions. Understanding SDK type definitions via .d.ts files combined with official reference docs enables:
- MCP server configuration and tool integration
- Query control flow (interrupt, setPermissionMode, setModel)
- Message type handling and session lifecycle
- Hook system design and event handling
