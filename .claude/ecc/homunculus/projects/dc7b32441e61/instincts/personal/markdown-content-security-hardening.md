---
id: markdown-content-security-hardening
trigger: when editing markdown or code block rendering components
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Markdown Content Security Hardening

## Action
When editing markdown rendering components, validate and sanitize all user-controlled inputs using whitelists, regex constraints with length limits, and explicit protocol checks before rendering to DOM.

## Evidence
- Observed 3+ security hardening edits in session 2464ac8f-58a5-496a-b12e-600dcb754571
- Pattern: Language identifier validation (regex `[a-zA-Z0-9_+#-]{1,32}` with max length)
- Pattern: URL protocol whitelist for links (https, http, mailto, tel only)
- Pattern: Security-focused test additions for XSS vectors (javascript: URLs, invalid identifiers)
- Last observed: 2026-03-14T22:02:47Z

## Context
The chat interface renders user-generated markdown content. Multiple security constraints were added:
1. Code fence language identifiers restricted by regex and length
2. Link URLs validated against safe protocol whitelist before rendering
3. Clipboard promise handling with error suppression
4. Tests added for attack vectors
