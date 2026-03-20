---
id: crud-ui-paired-exploration
trigger: when exploring or understanding a domain feature in the web app
confidence: 0.75
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# CRUD Operations Examined with Corresponding UI Components

## Action
When exploring a feature in the web app, systematically read the server actions (create/update/delete) immediately followed by their corresponding UI components. Use Bash to discover the files, then Read them in CRUD order paired with components that use them.

## Evidence
- Observed 6+ times in session 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1
- Pattern: Bash discover files → Read create-project.ts → Read new-project-form.tsx (uses it) → Read update-project.ts → Read project-settings-form.tsx (uses it) → Read delete-project.ts (same form handles it) → Read nav-projects.tsx
- Sequence shows CRUD actions paired with components that implement them, not separated
- Last observed: 2026-03-13

## Why
This monorepo's architecture has tight coupling between server actions and their UI consumers. Reading them in pairs provides immediate context on how each backend operation is actually used, preventing misunderstandings about data flow and preventing missing UI-related details when understanding a feature.
