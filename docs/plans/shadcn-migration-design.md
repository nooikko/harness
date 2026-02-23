# ShadCN Component Migration Design

Date: 2026-02-23

## Goal

Migrate the web app from hand-rolled Tailwind components to ShadCN primitives in the shared `packages/ui/` package. This gives every app in the monorepo a consistent, accessible component library.

## Approach

Manual port of ShadCN component source into `packages/ui/src/components/`. Each component follows the existing Button pattern: Radix primitive + CVA variants + `cn()` utility + `forwardRef`. No CLI usage — we own the files directly.

## Phase 1 — Direct Replacements

| Component | Radix Dependency | Replaces |
|---|---|---|
| Card | None | usage-summary-cards, budget-warning wrapper |
| Table | None | usage-by-model-table raw HTML table |
| Alert | None | budget-warning alert, notification-message |
| Progress | @radix-ui/react-progress | budget-warning CSS progress bar |
| Skeleton | None | loading.tsx animate-pulse divs |
| ScrollArea | @radix-ui/react-scroll-area | sidebar + message list overflow |
| Badge | None | thread kind labels, status indicators |

## Phase 2 — Future-Useful

| Component | Radix Dependency |
|---|---|
| Dialog | @radix-ui/react-dialog |
| Input | None |
| Label | @radix-ui/react-label |
| DropdownMenu | @radix-ui/react-dropdown-menu |
| Separator | @radix-ui/react-separator |
| Tooltip | @radix-ui/react-tooltip |

## File Organization

```
packages/ui/src/
  index.ts                 # Exports cn + all components
  components/
    button.tsx             # (existing)
    card.tsx
    table.tsx
    alert.tsx
    progress.tsx
    skeleton.tsx
    scroll-area.tsx
    badge.tsx
    dialog.tsx
    input.tsx
    label.tsx
    dropdown-menu.tsx
    separator.tsx
    tooltip.tsx
    __tests__/
      (one test per component)
```

## Migration Targets

**Usage dashboard** (`apps/web/src/app/usage/`):
- usage-summary-cards.tsx: wrap metrics in Card/CardHeader/CardContent
- budget-warning.tsx: Alert for warning states + Progress bar
- usage-by-model-table.tsx: Table/TableHeader/TableRow/TableCell
- usage-over-time-chart.tsx: Card wrapper

**Chat** (`apps/web/src/app/chat/`):
- thread-sidebar.tsx: ScrollArea for scrollable list
- message-list.tsx: ScrollArea for message container
- notification-message.tsx: Alert with variant
- loading.tsx: Skeleton components
- thread-kind-icon.tsx: Badge wrapper (optional)

## New Dependencies

Phase 1: `@radix-ui/react-progress`, `@radix-ui/react-scroll-area`
Phase 2: `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-separator`, `@radix-ui/react-tooltip`

## Testing

Each component gets a test covering: renders without crashing, applies variant classes, forwards refs, supports className override.
