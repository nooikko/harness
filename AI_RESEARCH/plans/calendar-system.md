# Calendar System Implementation Plan

## Overview
Unified calendar system with local DB storage, Outlook sync, and multi-source event aggregation.

## Phases

### Phase 1: Database Models ✅
- `CalendarEvent` model with `CalendarEventSource` enum
- `CalendarSyncState` model for delta sync cursors

### Phase 2: Rename `calendar` → `outlook-calendar`
- Rename package directory + package.json
- Update PluginDefinition.name and tool prefixes
- Update plugin registry import

### Phase 3: New `calendar` Plugin
- Local CRUD tools (create, update, delete, list, get)
- `sync_now` tool for manual sync trigger
- Background Outlook sync via internal timer in `start()`
- Virtual event projection (memory, task, cron)

### Phase 4: Calendar Page
- `/chat/calendar` route with @schedule-x/react
- Month/week/day views
- Source filtering, event detail sheet
- Sidebar navigation link

### Phase 5: Event Styling
- Source style map (OUTLOOK=blue, LOCAL=purple, MEMORY=amber, TASK=green, CRON=gray)
- Category overrides (birthday=pink, medical=red, meeting=blue)

### Phase 6: Chat Content Blocks
- `calendar-day-summary` block
- `calendar-week-overview` block
- Registry additions

## Dependencies
- `@schedule-x/react` + `@schedule-x/theme-default` (apps/web)
- `rrule` (packages/plugins/calendar)
