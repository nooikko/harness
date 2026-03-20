---
id: propagate-event-model-changes
trigger: when adding a new property to the IEvent data model
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Propagate Event Model Changes Across All Layers

## Action
When adding a new property to IEvent, update all five layers: the interface definition, mapper functions, mock generators, component forms, and any related helper functions.

## Evidence
- Observed 5 times in session 8aa114c3-6cd0-4154-84e9-d3eea7189fd6
- Pattern: Adding `isAllDay` property required updates to:
  - `interfaces.ts` (IEvent interface)
  - `map-event-row-to-calendar-event.ts` (mapper function)
  - `mocks.ts` (mock generator at 2 distinct locations)
  - `add-edit-event-dialog.tsx` (component form)
- Last observed: 2026-03-19T04:43:18Z

## Why
The event data flows through multiple layers: database rows → mapped objects → UI components → forms. Each layer needs the property to maintain type safety and prevent silent failures.

## How to Apply
When adding an event property:
1. Update the IEvent interface in `interfaces.ts`
2. Update the mapper in `map-event-row-to-calendar-event.ts`
3. Update both mock generator locations in `mocks.ts` (current event + loop)
4. Update form defaults in `add-edit-event-dialog.tsx`
5. Check for other components that instantiate IEvent objects
