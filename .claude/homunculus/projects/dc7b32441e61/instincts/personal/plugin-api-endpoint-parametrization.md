---
id: plugin-api-endpoint-parametrization
trigger: when refactoring client-side fetch calls to plugin APIs
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin API Endpoints Should Use Configurable Base URLs

## Action
Replace hardcoded plugin API paths with a configurable orchestratorUrl parameter that is prop-drilled through component hierarchy, allowing different deployment environments to specify their own API base URL.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Hardcoded `/api/plugins/{name}/*` paths are being extracted to use `${orchestratorUrl}/api/plugins/{name}/*`
  - cast-device-list.tsx: `/api/plugins/music/devices` → `${orchestratorUrl}/api/plugins/music/devices`
  - youtube-account-section.tsx (grep): Found hardcoded path at line 76
  - youtube-account-section.tsx: `/api/plugins/music/oauth/status` → `${orchestratorUrl}/api/plugins/music/oauth/status`
- Accompanied by prop type updates to accept orchestratorUrl and parent component updates to pass it down
- Last observed: 2026-03-16T22:12:03Z

## Context
Plugin components fetch from API endpoints that may run on different hosts depending on deployment. Components should receive the base URL as a prop rather than hardcoding it, enabling flexibility across environments.
