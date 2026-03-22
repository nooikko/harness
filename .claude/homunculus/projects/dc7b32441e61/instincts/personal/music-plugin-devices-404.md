---
id: music-plugin-devices-404
trigger: when music plugin devices fail to load or API returns 404
confidence: 0.6
domain: debugging
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Music Plugin Devices Endpoint 404

## Action
When `/api/plugins/music/devices` returns 404, verify OAuth configuration is in integrations area (not plugins) and that the devices endpoint is properly exposed from the plugin.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Browser console shows "Failed to load resource: the server responded with a status of 404" for http://localhost:4001/api/plugins/music/devices
- Curl confirms endpoint not found: "Cannot GET /api/plugins/music/devices"
- Identified cause: OAuth was misconfigured in plugins area instead of integrations
- Last observed: 2026-03-16T22:27:16Z
