# Research: @ilamy/calendar Styling and Customization API

Date: 2026-03-18

## Summary

`@ilamy/calendar` v1.4.0 has a deliberately limited but coherent customization model. It ships zero CSS and is Tailwind-only, which is the good news. The bad news is that `classesOverride` exposes exactly one field (`disabledCell`), so most internal sub-elements have no `className` hook. Two named className props (`headerClassName`, `viewHeaderClassName`) target specific zones. Three render props (`renderEvent`, `renderEventForm`, `renderCurrentTimeIndicator`) let you fully replace those sub-trees. For everything else — the time grid, the sidebar, the view switcher position, day cell backgrounds — you are locked into whatever Tailwind classes the library ships internally.

## Prior Research

- `2026-03-18-ilamy-calendar-compatibility-research.md` — stack compatibility, SSR constraints, peer deps, bundle size. Read that first.

## Current Findings

### 1. What Props Actually Exist (Confidence: HIGH — from published `dist/index.d.ts`)

The authoritative source is the published TypeScript definitions at `unpkg.com/@ilamy/calendar@1.4.0/dist/index.d.ts`. The complete props for `IlamyCalendarProps`:

**Styling-relevant props:**

| Prop | Type | Default | What it targets |
|------|------|---------|-----------------|
| `headerClassName` | `string` | `''` | The top-of-calendar header bar (navigation, title, view switcher) |
| `viewHeaderClassName` | `string` | `''` | The day-of-week column headers in week/day views |
| `classesOverride` | `CalendarClassesOverride` | `undefined` | Object with one field: `disabledCell?: string` |

**`CalendarClassesOverride` shape** (from `index.d.ts`):
```typescript
{
  disabledCell?: string;  // cells outside business hours and days from other months in month view
}
```

That is the entire object. One field.

**Render props (full component replacement):**

| Prop | Type | What it replaces |
|------|------|-----------------|
| `renderEvent` | `(event: CalendarEvent) => ReactNode` | Individual event card rendering in all views |
| `renderEventForm` | `(props: EventFormProps) => ReactNode` | The create/edit event form (dialog content) |
| `renderCurrentTimeIndicator` | `(props: RenderCurrentTimeIndicatorProps) => ReactNode` | The "now" line in week/day views |
| `headerComponent` | `ReactNode` | The entire header bar (replaces the built-in nav) |

**Per-event color overrides (on the event data object, not a prop):**
```typescript
interface CalendarEvent {
  backgroundColor?: string;  // hex — sets event card background
  color?: string;             // hex — sets event card text color
  // ...
}
```

### 2. Tailwind Classes Are Baked Into the Compiled Bundle (Confidence: HIGH)

The published `dist/index.js` (582 KB) is minified. It contains hardcoded Tailwind utility strings such as:
- `"bg-secondary text-muted-foreground pointer-events-none"`
- `"flex items-center justify-center gap-2"`
- `"rounded-md border p-6 shadow-lg"`
- `"h-9 px-4 py-2"`
- `"bg-primary text-primary-foreground"`

These class strings are compiled into the JS bundle. Tailwind uses semantic tokens (`bg-primary`, `bg-secondary`, `text-muted-foreground`) rather than raw colors, which means you can retheme via CSS variable overrides at the Tailwind config level — but you cannot reach individual elements by targeting their class names.

The `@source` directive approach is how Tailwind discovers what classes the library uses:
```css
@source "../node_modules/@ilamy/calendar/dist";
```
This tells Tailwind to scan the dist JS and generate the utility classes used there. You get no extra className injection ability from this — it is purely for class discovery.

### 3. Theming Model: CSS Variables via Tailwind v4 (Confidence: HIGH)

The library uses Tailwind's semantic color tokens (`bg-primary`, `bg-secondary`, `text-muted-foreground`, etc.) which map to CSS variables at the `@theme` level. This means you **can** retheme the entire calendar by redefining those CSS variables in your `globals.css`:

```css
@theme {
  --color-primary: oklch(0.7 0.2 250);        /* changes button/accent color */
  --color-background: oklch(0.12 0.01 250);   /* dark background */
  --color-foreground: oklch(0.95 0 0);         /* text */
  --color-secondary: oklch(0.2 0.01 250);      /* secondary surface */
  --color-muted-foreground: oklch(0.6 0 0);    /* dimmed text */
  /* etc. */
}
```

**What this can change:** overall background color, primary accent color (selected state, today indicator, buttons), text colors, border colors — anything that maps to a named semantic token.

**What this cannot change:** layout, spacing, font sizes, the position of the view switcher, whether the sidebar is on the left or right. Those are structural Tailwind classes (`flex`, `w-48`, `border-r`, etc.) baked into the component tree.

Light/dark mode is managed via `data-theme` attribute on `document.documentElement` and `localStorage` key `ilamy-calendar-theme`. The library auto-detects system preference. You can control the theme externally by setting `document.documentElement.setAttribute('data-theme', 'dark')`.

### 4. `headerComponent` — the Key Override for View Switcher Position (Confidence: HIGH)

The `headerComponent` prop accepts a `ReactNode` and replaces the built-in header entirely. The docs confirm it receives no props in this `ReactNode` form — it is a static replacement, not a render prop with `currentDate`/`onNavigate` injected automatically.

The docs also mention a `headerComponent` function form that receives `{ currentDate, onNavigate }`. The `index.d.ts` types it as `React.ReactNode`, but the docs describe a callback variant. This is a minor documentation/type discrepancy — testing in practice is needed to confirm whether `(props: { currentDate, onNavigate }) => ReactNode` is accepted.

**Implication for Fantastical-style layout:** If you want the view switcher at the top center, or the date title on the right, or a custom "Today" button style, you must build your own header component entirely and pass it via `headerComponent`. There is no prop to reorder or reposition elements within the default header — it is all or nothing.

### 5. `renderEvent` — Full Event Card Replacement (Confidence: HIGH)

`renderEvent` is the most powerful customization hook. It receives a `CalendarEvent` object and must return a `ReactNode`. The library renders your JSX inside its event container (handles positioning/sizing), but the visual content is entirely yours.

From the docs example:
```tsx
renderEvent={(event) => (
  <div className="flex items-center gap-1 px-1 text-xs truncate">
    {event.data?.priority === 'high' && <AlertCircle className="h-3 w-3 text-red-500" />}
    <span className="truncate">{event.title}</span>
  </div>
)}
```

You can use arbitrary Tailwind classes, custom icons, any JSX. This is the primary path to Fantastical-style event cards (colored left border, time badge, description preview, etc.).

**Limitation:** `renderEvent` cannot change the event's container dimensions or positioning — the library controls layout placement. You control only the interior visual.

### 6. Source Readability — Can You Fork Individual Pieces? (Confidence: HIGH)

The published `dist/index.js` is minified (single-letter variable names, no whitespace). It is not readable.

The GitHub repository (`github.com/kcsujeet/ilamy-calendar`) contains the TypeScript source, but GitHub returned 404 for direct file paths under `packages/react/src/` during this research session (may be a routing issue with the monorepo structure). The repo has 348 commits and 25 releases, indicating active development with readable source in-tree.

**Forking is feasible at the source level** (MIT license, source available), but you would be maintaining a fork of a library that releases frequently. Individual piece extraction (e.g., "just the time grid") would require understanding the full component tree and context dependencies — non-trivial but possible.

### 7. What You Cannot Reach (Confidence: HIGH)

Based on the published API, there are no `className` hooks for:
- The time grid (the hour column in week/day view)
- The sidebar (time labels on the left)
- Individual day columns in week view
- The "more events" overflow button
- Day cell backgrounds in month view (except `disabledCell` for non-business cells)
- The resource calendar columns/rows
- The year view grid

If you need to restyle these, your options are:
1. **CSS variable override** — only if the element uses semantic color tokens
2. **Global CSS targeting** — use a scoped wrapper and target the HTML structure with descendant selectors (fragile, breaks on library updates)
3. **Fork the source** — modify the TSX directly

### 8. The Fantastical Assessment

Can you make it look like Fantastical?

**Yes, partially:**
- Custom event cards via `renderEvent` — full control over event appearance
- Custom header via `headerComponent` — full control over navigation zone
- Color theming via CSS variables — controls surface/accent colors globally
- Per-event colors via `backgroundColor`/`color` on event data

**No, not without forking or global CSS hacks:**
- View switcher position (within default header) — only moveable by replacing the header entirely
- Time grid typography/spacing
- Sidebar style (time labels)
- Day column header style beyond `viewHeaderClassName` (a single class string for the entire row)
- Month day cell headers (date numbers in top corner)

The library is designed for functional correctness and developer customization of content, not deep visual transformation. It is closer to a FullCalendar-style library than a shadcn-style headless library.

## Key Takeaways

1. **Two named className props**: `headerClassName` (header bar) and `viewHeaderClassName` (day-of-week row). These accept a single `string` of Tailwind classes. No className props exist for any other sub-element.
2. **`classesOverride` is sparse**: The published type has exactly one field — `disabledCell`. Not the rich shadcn-style `classNames` object that covers every zone.
3. **Theming works via CSS variables**: The library uses semantic Tailwind tokens (`bg-primary`, `text-muted-foreground`, etc.) that map to CSS variables you can override in `@theme`. This is the main global theming path.
4. **`renderEvent` is the power lever**: Full JSX replacement for event cards. This is where Fantastical-style event appearance lives.
5. **`headerComponent` for layout changes**: Replacing the header entirely is the only way to reposition the view switcher or change navigation layout.
6. **Compiled bundle is minified**: Not fork-friendly from npm. The GitHub source is readable but you'd be maintaining a fork.
7. **No slots/headless mode**: This is not a headless/compound component library. It is an opinionated visual library with escape hatches, not a render-everything-yourself API.

## Gaps Identified

- `headerComponent` as render prop (vs ReactNode) — type definition says `ReactNode`, docs suggest a function variant with `currentDate`/`onNavigate`. Needs hands-on testing.
- `CalendarClassesOverride` may have grown since 1.4.0 — check `index.d.ts` after installing to see if additional fields were added.
- GitHub source file paths were 404ing during research — the exact internal component structure (what Tailwind classes each sub-element uses) could not be verified from source.

## Sources

- `unpkg.com/@ilamy/calendar@1.4.0/dist/index.d.ts` — authoritative TypeScript definitions (19.5 kB)
- `unpkg.com/@ilamy/calendar@1.4.0/dist/index.js` — published bundle (582 kB, minified, confirming Tailwind class strings)
- `ilamy.dev/docs/components/calendar/` — official props reference
- `ilamy.dev/docs/customization/components/` — render prop and component override docs
- `ilamy.dev/docs/customization/styling/` — Tailwind v4 @source directive and CSS variable theming
- `github.com/kcsujeet/ilamy-calendar` — repo overview (source available, MIT)
