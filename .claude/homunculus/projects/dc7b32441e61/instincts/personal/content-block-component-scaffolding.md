---
id: content-block-component-scaffolding
trigger: when creating React components to display plugin tool results in the chat interface
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Content Block Component Scaffolding

## Action
When building UI components to display plugin tool results (calendar events, music playback, task lists, etc.), create React `.tsx` components in `apps/web/src/app/(chat)/chat/_components/content-blocks/` with naming pattern `*-block.tsx`, exporting a default component that accepts `ContentBlockProps`, and rendering structured data with appropriate icons, status indicators, and hierarchical information display.

## Evidence
- Observed 3 times in session 3db3a930-228b-4cee-8665-92a3648dd54b (2026-03-17 17:28:38–17:29:22Z)
- Pattern: Creating display components for plugin tool results:
  - `calendar-events-block.tsx` (renders calendar event list with time formatting, attendees, join URLs)
  - `now-playing-block.tsx` (renders music playback state with device info, queue preview, radio status)
  - `task-list-block.tsx` (renders task list with status icons, priority colors, due dates, blocking info)
- Context: Integrating plugin tool outputs into chat content rendering system
- Each component follows consistent structure: type definitions → formatters/helpers → main component with `ContentBlockProps`
- Components use lucide icons for visual hierarchy
- Components accept generic data object and destructure needed fields
- Last observed: 2026-03-17T17:29:22Z

## Notes
This pattern emerges when wiring multiple plugin tools to content blocks. The scaffolding is consistent: import icons from lucide, define prop types based on plugin tool return data, add formatting utilities for dates/status, render with hierarchical layout using bg/border utilities, include fallback rendering for empty states. Saves time by establishing reusable component structure across different plugin integrations.
