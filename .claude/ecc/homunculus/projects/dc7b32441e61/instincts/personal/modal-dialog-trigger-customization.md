---
id: modal-dialog-trigger-customization
trigger: when a modal/dialog form needs to be used in multiple UI contexts with different trigger presentations
confidence: 0.65
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Modal Dialog Trigger Customization

## Action
Make modal/dialog form components accept an optional `trigger` prop to render custom trigger elements, falling back to a sensible default when not provided.

## Pattern
1. Add `trigger?: React.ReactNode` to component props
2. In DialogTrigger, render `trigger ?? <default button/icon>`
3. This allows the same form to be used:
   - In sidebar navigation with icon button
   - In page header with full Button + text
   - In empty states with secondary button
   - Without duplicating form logic

## Evidence
- Observed 3 times in session 970f6bb0 (2026-03-13)
- NewProjectForm modified to accept trigger prop
- Used in nav-links.tsx with icon-only button
- Used in projects/page.tsx header with full Button (Plus icon + text)
- Form logic and validation stays consistent across contexts
- Last observed: 2026-03-13T23:39:01Z

## Why This Matters
Reduces code duplication and makes form components more flexible for reuse. Single source of truth for validation and submission logic while UI presentation varies by context.
