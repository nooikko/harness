# Phase 5: Plugin Cards Refinement

**Goal**: Keep cards (right shape for plugins) but make them tighter, more interactive, less noisy.

**Current file**: `apps/web/src/app/admin/plugins/_components/plugins-table.tsx`

---

## What's Wrong Now

1. "Updated 7d ago" on every card — no one acts on this, pure noise
2. "Disable" is a full button, always visible — should be a toggle switch
3. "Settings" button is always visible — could appear on hover for cleaner cards
4. "No configurable settings" text fills space on plugins that don't have settings
5. All cards same size despite different content — plugins with settings look same as those without

---

## Changes

### 1. Remove "Updated Xd ago"
Nobody makes decisions based on when a plugin config was last updated. Delete it.

### 2. Replace "Disable" Button with Toggle Switch
Same pattern as cron-jobs (Phase 4b). A switch in the card header, next to the plugin name:

```
┌─────────────────────────────┐
│ identity            [=====] │  ← toggle switch replaces badge + button
│ 6 settings                  │
│                    ⚙        │  ← gear icon, appears on hover
└─────────────────────────────┘
```

The switch replaces BOTH the "Enabled"/"Disabled" badge AND the "Disable"/"Enable" button. One element, two functions.

### 3. Settings Button → Hover-Reveal Gear Icon
Only show the gear icon on card hover. Plugins without configurable settings don't show it at all (no "No configurable settings" text needed — absence of the icon IS the signal).

### 4. Tighter Card Layout
Remove CardContent section entirely. The card becomes:
- Header: plugin name (left) + toggle switch (right)
- Footer: settings count if >0 (left) + gear icon on hover (right)

This roughly halves the card height.

### 5. Visual Grouping by State
Consider sorting: enabled plugins first, disabled plugins after — with a subtle divider or opacity difference. Disabled plugins could be slightly desaturated.

---

## Estimated Scope

- 1 file primarily: `plugins-table.tsx`
- 1 new client component: `PluginToggle` (switch + server action)
- Remove Badge, simplify structure
- Tests need updating
