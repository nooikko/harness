---
id: external-api-local-verification-workflow
trigger: when researching external library APIs and needing to understand implementation details
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# External API Documentation + Local Verification Workflow

## Action
When investigating an external library's API, fetch official documentation from GitHub using WebFetch, then use Bash grep to locate and extract corresponding implementation details from a local source repository for verification.

## Evidence
- Observed 6+ tool sequences in session 4856ee0a-a85e-44ce-988d-133f25f77051 (2026-03-16 23:49)
- Pattern: WebFetch official docs → Bash grep local source code → extract implementation
- Used for: YouTube.js API investigation (Innertube signatures, Music client, Session management, Format class, VideoInfo, Player)
- Specific instances:
  - WebFetch Innertube.ts → Bash find type definitions
  - WebFetch Music.ts → Bash grep streaming_data patterns
  - WebFetch Session.ts → Bash grep Player implementation
  - Final sequence: Bash extract Changelog from local repo
- Last observed: 2026-03-16 23:49:44

## Context
This workflow combines remote documentation research with local source verification, useful when:
- Integrating with external libraries where implementation details aren't fully documented
- Understanding how public APIs map to internal source code structure
- Cross-referencing official signatures with actual implementation patterns

Complement existing research workflows by using this when you need to bridge documentation gaps with actual source code inspection.
