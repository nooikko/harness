---
id: admin-page-layout-standardization
trigger: when creating or modifying list/grid pages in admin and user-facing sections
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Admin Page Layout Standardization

## Action
Use consistent page header and container layout across admin and user-facing list pages: max-w-5xl container, flex header with title/description on left and action button on right, and standard empty state styling.

## Pattern
- Container: `mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]`
- Header: `flex items-center justify-between` with left side (title + description) and right side (action button/form)
- Empty state: centered icon, descriptive text, no border
- Tables/grids placed directly below header with matching spacing

## Evidence
- Observed 3+ times in session 970f6bb0 (2026-03-13)
- CronJobsPage: uses max-w-5xl header with Plus button on right, Table below
- ThreadsPage: uses max-w-5xl header without action, Table below
- ProjectsPage: updated from max-w-6xl to match pattern with grid instead of table
- Empty state styling aligned across pages
- Last observed: 2026-03-13T23:39:27Z

## Why This Matters
Consistency makes the dashboard feel polished and predictable. New pages should follow this template to maintain visual coherence.
