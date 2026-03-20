---
id: sdk-concurrency-investigation
trigger: when investigating session pool, contextRef, or concurrency-related issues in SDK
confidence: 0.7
domain: debugging
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# SDK Concurrency Investigation Workflow

## Action
When troubleshooting SDK or session management issues, read interconnected source files sequentially (session-pool → invoker-sdk → create-session → audit/reference docs) to understand the system architecture and identify concurrency bottlenecks.

## Evidence
- Observed 4 times in sequence at 2026-03-17T23:40:30-31 (session 31c444d9-8205-4bd5-af0b-09f5495a3367)
- Pattern: Read session-pool.ts (142 lines) → invoker-sdk/index.ts (114 lines) → create-session.ts → agent-stability-audit.md
- Each file builds on understanding of prior: pool manages sessions → invoker SDK creates sessions → session creation handles streaming → audit documents known issues
- Last observed: 2026-03-17T23:40:31

## Context
This project has known concurrency issues (C1: shared mutable contextRef, C2: mcpServerFactory sharing contextRef). When investigating these, reading the files in this order efficiently builds mental model from infrastructure → user-facing API → implementation details → known issues document.
