---
id: error-message-sanitization-no-leakage
trigger: when handling errors in OAuth, token refresh, or API integration flows
confidence: 0.75
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Error Message Sanitization Prevents Information Leakage

## Action
Never expose raw error bodies, response details, or sensitive debug info to user-facing error messages. Always sanitize error responses from external APIs before rendering to users.

## Evidence
- Observed 4 times in session bbe56a1c-c659-48a9-87ca-5743e8ba37f1
- Pattern: oauth/callback/route.ts removes errorDescription parameter and uses OAUTH_ERROR_MESSAGES map
- Pattern: get-valid-token.ts removes `${errorBody}` from error message, replaces with generic "Check server logs"
- Pattern: Error response bodies consumed with `await response.text()` but not included in thrown Error objects
- Last observed: 2026-03-16T07:26:56Z

## Context
Multiple integration points (OAuth callbacks, token refresh, Graph API) received updates to strip sensitive information from error messages. Instead of exposing raw HTTP responses, errors now use:
1. Pre-defined error message maps (OAUTH_ERROR_MESSAGES)
2. Generic messages that guide users without leaking implementation details
3. Consumed response bodies that are discarded, never exposed

## Implementation Pattern
- Store error messages in a static map keyed by standard error codes
- Use generic fallback messages for unknown errors
- Always consume response.text() to prevent connection leaks, but don't include it in error
- Redirect users to specific UI paths for resolution, not error details
