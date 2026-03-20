---
id: feature-discovery-pattern
trigger: when exploring a new feature or component
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Feature Discovery Sequential Reading Pattern

## Action
When discovering a new feature, use glob/bash to find related files first, then systematically read component files, then action files, then helpers in sequence.

## Evidence
- Observed 3+ times in session 2464ac8f-58a5-496a-b12e-600dcb754571
- Pattern: Thread sidebar exploration (search → read sidebar.tsx → read create-thread.ts), project exploration (search → read form.tsx → read actions), plugin context (search → read index.ts → read helpers)
- Workflow: bash find/glob pattern → read component → read action → read _helpers files
- Last observed: 2026-03-14T20:47:47Z

## Context
This pattern emerged when exploring interconnected features. Starting with a file search to map the surface area, then drilling into implementation details in logical order (UI → logic → utilities) reduces context switching and builds mental models more efficiently.
