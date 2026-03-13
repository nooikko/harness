# Phase 8: Usage Dashboard

**Goal**: The one page that already has visual elements (charts, summary cards) — polish them to feel intentional.

**Current files**:
- `apps/web/src/app/admin/usage/page.tsx`
- `_components/usage-summary-section.tsx`, `usage-summary-cards.tsx`
- `_components/usage-by-model-table.tsx`
- `_components/tokens-over-time-chart.tsx`, `cost-over-time-chart.tsx`
- `_components/budget-warning.tsx`

---

## Current State Assessment

Looking at the screenshot, the usage page is actually the most "product-like" admin page — it has summary cards, charts, and a table. But it still feels like a dashboard template, not a designed dashboard.

Issues:
1. Summary cards are fine structurally but have no trend context ("2.0K tokens" — up or down from when?)
2. Charts are basic — flat bar charts with minimal styling
3. "Usage by Model" table shows full model ID (`claude-haiku-4-5-20251001`)
4. Budget bar has no color progression (green → amber → red as usage increases)
5. Layout doesn't feel cohesive — cards, then charts, then table, with no visual relationship

---

## Changes

### 1. Summary Cards: Add Trend Context

Not a percentage change (too complex without historical comparison logic), but a descriptive detail that gives context:

- "Total Tokens: 2.0K" + "across 3 runs" ← already exists, good
- "Total Cost: $0.0080" + "Estimated USD" ← already exists but could be "this period" with a period selector later

For now, keep what exists. The cards are the strongest element on this page.

### 2. Human-Readable Model Names

The `UsageByModelTable` shows `claude-haiku-4-5-20251001`. Use the humanizer from Phase 1:

```
claude-haiku-4-5-20251001 → "Haiku 4.5"
```

Show full ID in a tooltip for technical reference.

### 3. Budget Progress Bar Color

Current: single purple bar regardless of percentage.

Target:
- 0-60%: green (`--color-success`)
- 60-85%: amber (`--color-warning`)
- 85-100%: red (`--color-destructive`)

This is a standard pattern and communicates urgency at a glance.

### 4. Chart Styling

The charts use basic bars. Improvements:
- Rounded bar corners (already may be there)
- Subtle grid lines on the y-axis
- Better axis label formatting (dates, numbers)
- Tooltip on hover with exact values
- Use the primary color for bars, not the same purple as everything else — maybe a blue or teal to differentiate "data visualization" from "UI chrome"

### 5. Layout Refinement

Consider the dashboard grid:
```
[ Budget Bar - full width ]
[ Card ] [ Card ] [ Card ] [ Card ]
[ Tokens Chart        ] [ Usage by Model Table ]
[ Cost Chart          ] [                      ]
```

The charts and table should feel like a cohesive analytics section, not stacked independent components. Maybe wrap in a subtle bordered section or just ensure consistent card styling.

---

## Estimated Scope

- Model name humanizer (shared from Phase 1)
- Budget bar color logic (CSS/conditional classes)
- Chart styling refinements (depends on chart library in use)
- Relatively focused changes — the page structure is already good
