---
id: review-phase-implementation-reading
trigger: when beginning code review phase in harness
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Read Implementation Files During Code Review

## Action
When reviewing code changes, read the actual implementation files being modified before or alongside running code review tools to build full context.

## Evidence
- Observed 10 file reads across multiple review sessions
- Session 4856ee0a-a85e-44ce-988d-133f25f77051: 3 reads of web component helpers (22:34:11-22:34:12)
- Session bbe56a1c-c659-48a9-87ca-5743e8ba37f1: 7 sequential reads of plugin/oauth helpers during Microsoft Graph integration review (07:28:56-07:28:59):
  - outlook helpers: search-emails.ts, find-unsubscribe-links.ts, list-recent.ts
  - oauth helpers: encrypt-token.ts, decrypt-token.ts
  - calendar helpers: find-free-time.ts, create-event.ts
- Pattern: Systematic sequential reading of modified helper files during code review phase, typically after security fixes applied
- Last observed: 2026-03-16T07:28:59Z

## Rationale
Reading implementation files provides concrete syntax/structure context for code review agent, enabling more specific feedback on implementation choices, not just high-level design.
