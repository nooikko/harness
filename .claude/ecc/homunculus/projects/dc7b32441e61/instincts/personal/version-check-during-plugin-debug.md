---
id: version-check-during-plugin-debug
trigger: when debugging plugin runtime errors or API failures
confidence: 0.5
domain: debugging
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Check Package Versions Early When Debugging Plugin Issues

## Action
When debugging plugin failures (device detection, API errors, missing endpoints), immediately check the installed versions of key dependencies using bash before deeper investigation.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Music plugin was failing to detect devices and return 404 errors. Investigation proceeded by checking `youtubei.js` package version (14.0.0) and Node.js version (17.0.1) via bash
- Last observed: 2026-03-16T22:42:16Z

## Rationale
Version mismatches or breaking changes between dependencies are a common root cause of plugin failures. Quick version checks can reveal whether the issue is likely API incompatibility vs. runtime logic errors.
