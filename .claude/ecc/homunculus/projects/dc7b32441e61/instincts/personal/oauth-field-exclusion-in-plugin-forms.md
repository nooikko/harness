---
id: oauth-field-exclusion-in-plugin-forms
trigger: when processing plugin settings fields in form data builders or rendering
confidence: 0.6
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# OAuth Field Exclusion in Plugin Forms

## Action
Always exclude fields with `type === 'oauth'` when building form data, rendering settings forms, or processing plugin settings payloads—oauth fields are managed separately and should not flow through standard form submission.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern instances:
  1. buildFormData (settings-form.tsx): skip field if `field.type === 'oauth'`
  2. buildSettingsPayload (build-settings-payload.ts): skip field if `field.type === 'oauth'`
  3. SettingsForm render (settings-form.tsx): `.filter((field) => field.type !== 'oauth')`
- Last observed: 2026-03-16T21:00:15Z

## Why
OAuth fields require separate authentication flows and credential management. Including them in standard form submission breaks the oauth flow logic and can expose or corrupt credentials.
