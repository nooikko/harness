---
id: staged-feature-implementation-edits
trigger: when implementing a feature requiring imports, state management, business logic, and UI components in the same file
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Staged Feature Implementation via Sequential Edits

## Action
Break feature implementation into multiple targeted Edit operations organized by concern layer: imports first, then state/logic handlers, then UI components, rather than making one large change.

## Evidence
- Observed 5 sequential edits to project-settings-form.tsx (2026-03-13 23:53:37 – 23:55:01)
  - Pattern: navigation fix → imports → state/handlers → UI elements for description → UI elements for instructions
- Observed 6 sequential edits to chat-input.tsx (2026-03-14 22:54:09 – 22:55:18)
  - Pattern: imports → types → state management → handlers → submission logic → UI rendering
- Observed 2+ sequential edits each to thread-header.tsx, send-message.ts, chat-area.tsx during same feature integration
- Strategy keeps changes small, reviewable, and allows intermediate verification between layers
- Last observed: 2026-03-14 22:55:18

## Rationale
Staging edits by concern makes each change atomic and testable. Reduces cognitive load and makes diffs clearer for review.
