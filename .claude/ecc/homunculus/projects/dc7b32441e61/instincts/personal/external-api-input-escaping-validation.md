---
id: external-api-input-escaping-validation
trigger: when passing user-controlled input to external APIs (Graph API, OAuth, third-party services)
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# External API Input Escaping and Validation

## Action
Always escape or validate user-controlled input before passing it to external APIs. Use regex patterns, character escaping, or validation functions to sanitize untrusted data.

## Evidence
- Observed 3+ times in session bbe56a1c-c659-48a9-87ca-5743e8ba37f1
- Pattern: search-emails.ts escapes double quotes in Graph API $search parameter using `.replace(/"/g, '\\"')`
- Pattern: oauth/callback/route.ts validates state parameter matches stored value before processing
- Pattern: validate-graph-id.ts validates Graph ID format with regex `/^[A-Za-z0-9+/=_\-]+$/` and blocks ".." sequences
- Last observed: 2026-03-16T07:27:22Z

## Context
Outlook plugin, OAuth flow, and Graph API integration layers all require input validation before external API calls. Patterns include:
1. Quote escaping in search queries to prevent injection
2. State parameter validation with stored cookies for CSRF protection
3. Format validation for IDs before Graph API calls

## Implementation Pattern
- Define validation patterns (regex, whitelists) for each API parameter type
- Escape special characters relevant to the API (quotes for search, etc.)
- Validate state/CSRF tokens by comparing with server-side stored values
- Throw descriptive errors for validation failures, don't silently fail
