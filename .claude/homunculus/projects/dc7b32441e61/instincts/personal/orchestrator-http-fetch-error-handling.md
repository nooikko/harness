---
id: orchestrator-http-fetch-error-handling
trigger: when writing a server action that makes HTTP calls to the orchestrator
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Orchestrator HTTP Fetch Error Handling Pattern

## Action
Wrap orchestrator fetch calls in try/catch, check res.ok, safely parse JSON responses with fallback to empty object, and return a result object with `{ success: boolean, error?: string }` structure.

## Evidence
- Observed 4+ times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern in disconnect-account.ts, identify-device.ts, initiate-oauth.ts, set-device-alias.ts
- Consistent structure across all 4 files:
  1. `const res = await fetch(${getOrchestratorUrl()}/api/...)`
  2. Check `if (!res.ok) { const body = (await res.json().catch(() => ({}))); return { success: false, error: body.error ?? \`Request failed (${res.status})\` } }`
  3. Return `{ success: true, ...data }` on success
  4. Catch block returns `{ success: false, error: 'Could not reach orchestrator. Is it running?' }`
- Agent task reinforced pattern: created 4 test files validating this pattern with 3 tests per file (happy path, HTTP error, network unreachable)
- Last observed: 2026-03-16T21:21:02Z

## Why
The harness orchestrator is external to the web app and may be unreachable. The try/catch handles network failures; res.ok check catches HTTP errors; JSON parse fallback prevents crashes when body is malformed. The discriminated union return type enables client-side type narrowing without throwing.
