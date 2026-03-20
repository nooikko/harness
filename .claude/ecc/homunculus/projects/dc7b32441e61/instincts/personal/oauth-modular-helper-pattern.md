---
id: oauth-modular-helper-pattern
trigger: when implementing OAuth support for plugins
confidence: 0.65
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# OAuth Modular Helper Pattern

## Action
When adding OAuth support to a plugin, create modular helper files for credential management, device/account handling, and server actions—separate authentication logic from UI components.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051 (music plugin OAuth implementation)
- Pattern instances:
  1. youtube-music-auth.ts: type definitions, device code flow, credential initialization
  2. device-alias-manager.ts: device alias persistence helpers
  3. initiate-oauth.ts: server action for starting OAuth flow
  4. disconnect-account.ts: server action for OAuth revocation
- Last observed: 2026-03-16T21:00:38Z

## Why
Separating OAuth logic into focused helper modules improves testability, reusability, and keeps server actions lean. Credential management logic can then be unit tested independently from UI components.
