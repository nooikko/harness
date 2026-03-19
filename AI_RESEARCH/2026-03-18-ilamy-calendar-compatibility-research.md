# Research: @ilamy/calendar Compatibility with Stack

Date: 2026-03-18

## Summary

`@ilamy/calendar` v1.4.0 is a React-first calendar component library with drag-and-drop, multiple views, recurring events, and timezone support. It is explicitly built against React 19, Tailwind CSS v4, and shadcn/ui. It is **client-only** — SSR is not supported and components must be wrapped in `'use client'`. The `@source` directive approach for Tailwind v4 is fully documented and officially supported. Day.js plugins required are all built-in to Day.js (no extra installs needed). The dependency list is heavy (motion, dnd-kit, Radix UI, react-day-picker, rrule).

## Prior Research

See `2026-03-18-react-calendar-scheduling-libraries.md` for the broader calendar library landscape.

## Current Findings

### 1. Peer Dependencies (Confidence: HIGH)

From `registry.npmjs.org/@ilamy/calendar/1.4.0`:

```json
"peerDependencies": {
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "tailwindcss": "^4.1.11",
  "tailwindcss-animate": "^1.0.7"
}
```

Key points:
- React peer dep starts at `^19.1.0` — React 18 is explicitly excluded. This is not a ^18.x lib that happens to work with 19; it is pinned to 19.
- Tailwind peer dep starts at `^4.1.11` — requires Tailwind v4, not v3.
- `tailwindcss-animate` is a **peer dependency**, not a regular dep — the consumer must install it. This package is the community-maintained animation plugin (distinct from `tw-animate-css`).
- No peerDependenciesMeta entries (no optional peer deps declared).

Stack compatibility: React 19 + Tailwind v4 = exact match. This is designed for the stack.

### 2. Tailwind v4 @source Directive (Confidence: HIGH)

The official docs at `ilamy.dev/docs/getting-started/usage` specify:

```css
@source "../node_modules/@ilamy/calendar/dist";
```

This is added to `globals.css`. The path is relative to the CSS file. For a Next.js project where globals.css lives at `app/globals.css`, the path would be:

```css
@source "../../node_modules/@ilamy/calendar/dist";
```

(Adjust relative depth to match your project structure.)

**Is this pattern officially documented by Tailwind?** Yes (Confidence: HIGH). The Tailwind v4 docs explicitly describe `@source` as the mechanism to scan node_modules that would otherwise be ignored:

> "This is especially useful when you need to scan an external library that is built with Tailwind, since dependencies are usually listed in your .gitignore file and ignored by Tailwind by default."

The example in the Tailwind docs:
```css
@import "tailwindcss";
@source "../node_modules/@acmecorp/ui-lib";
```

This is a first-class, documented pattern in v4 — not a workaround.

**Important caveat:** The path in the `ilamy.dev` docs uses `../node_modules/@ilamy/calendar/dist` which points specifically to the `dist/` folder. Tailwind scans for class name strings in the file content. The compiled JS in `dist/` will contain Tailwind class strings, so this is correct. You do NOT need to point at the source `.tsx` files.

### 3. Day.js Version and Plugins (Confidence: HIGH)

From the package manifest, the declared dependency is:

```json
"dayjs": "^1.11.19"
```

The latest Day.js stable is `1.11.20`. Both are in the `1.11.x` range.

**The four required plugins** (`isSameOrAfter`, `isSameOrBefore`, `timezone`, `utc`) are all **built-in Day.js plugins** shipped as part of the core `dayjs` package. No additional npm packages are needed. They are available in all Day.js releases since at least 1.8.x. They are imported from:

```js
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
```

The setup is required **only if your project already uses Day.js as a direct dependency** and you need to configure it globally. The ilamy calendar ships its own Day.js instance internally via its `dependencies` entry — if your project does not directly use Day.js, you may not need to extend anything at the project level. However, the docs warn that failure to configure causes "isSameOrBefore is not a function" errors in projects that do have Day.js as a direct dep and initialize it separately.

**Best practice for Next.js:** Add this to a client-side entry point (a `_providers.tsx` or similar), not a Server Component:

```ts
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
```

### 4. Open GitHub Issues — React 19 or Tailwind v4 (Confidence: HIGH)

Repository: `github.com/kcsujeet/ilamy-calendar`
Open issues at time of research: 9

Issues are:
- #87 — Duplicate React Keys in ResourceWeekHorizontal (Mar 3, 2026)
- #86 — Feature: hide daily hours in week/day view (Mar 2, 2026)
- #81 — Package does not export RecurrenceEditor and EventForm (Feb 25, 2026)
- #79 — Feature: WorkingHours enhancement (Feb 17, 2026)
- #71 — Cannot create event in far future (Jan 19, 2026)
- #65 — Translation label sync (Jan 14, 2026)
- #63 — State sync to external system (Jan 13, 2026)
- #43 — Make UI pluggable (Dialog, Button, etc.) (Dec 23, 2025)
- #39 — Feature: Event break support (Dec 11, 2025)

**Zero open issues mention React 19, Tailwind v4, or SSR/App Router compatibility problems.** The issues are all about features or minor bugs in functionality (event dates, translations, export surface).

Notable: Issue #81 (RecurrenceEditor/EventForm not exported) is relevant if you need those internal components — they are not currently part of the public API.

### 5. SSR Compatibility (Confidence: HIGH)

**This is client-only.** Multiple sources confirm:

- The jqueryscript.net article on ilamy calendar states explicitly: "No Server Rendering: This is exclusively a client-side component — no SSG or SSR support."
- The same source states: "Next.js Integration: Mark components with `'use client'` directive."
- The package's main entry (`./dist/index.js`) does NOT include a `'use client'` directive in the source barrel (`src/index.ts`). This means the package does not self-declare itself as a client component — **you must add `'use client'` to the wrapper component in your app**.

**Practical implication for Next.js App Router:** Any page or component that imports `IlamyCalendar` or `IlamyResourceCalendar` must either:

1. Have `'use client'` at the top of the file, OR
2. Be wrapped in a client boundary component that has `'use client'`

A typical pattern:

```tsx
// app/calendar/calendar-client.tsx
'use client';

import { IlamyCalendar } from '@ilamy/calendar';

export const CalendarClient = () => {
  return <IlamyCalendar />;
};
```

```tsx
// app/calendar/page.tsx  (Server Component — fine)
import { CalendarClient } from './calendar-client';

export default function CalendarPage() {
  return <CalendarClient />;
}
```

The Astro integration note (use `client:only="react"`, NOT `client:load`) suggests the component uses browser APIs that cannot run during SSR at all — not just interactivity. This is a meaningful signal: it likely relies on `window`, `document`, or `ResizeObserver` internally.

### 6. Bundle Size (Confidence: LOW)

Direct bundle size data could not be retrieved from Bundlephobia or pkg-size.dev (both returned empty pages). However, the dependency list from the package manifest is heavy:

Direct dependencies bundled into `@ilamy/calendar`:
- `@dnd-kit/core` + `@dnd-kit/modifiers` — drag-and-drop
- `@radix-ui/react-checkbox`, `dialog`, `label`, `popover`, `scroll-area`, `select`, `slot`, `tabs` — 8 Radix UI packages
- `motion` (formerly Framer Motion) v12 — animation
- `react-day-picker` v9 — date picker sub-component
- `rrule` — recurring events
- `dayjs` — date handling
- `lucide-react` — icons
- `class-variance-authority`, `clsx`, `tailwind-merge` — styling utilities

The package declares `"sideEffects": false`, which means tree-shaking is supported in theory. However, the heavy dependency chain (especially `motion` v12 and `rrule`) means the install footprint is substantial even with tree-shaking.

**Estimated install size:** Given the dependency list, expect 5-15MB on disk post-install. Bundle size (what ships to the browser) will depend heavily on tree-shaking but `motion` alone is ~100-200KB gzipped.

To get exact numbers: run `npx bundlesize` locally or check `https://bundlephobia.com/package/@ilamy/calendar` in a browser.

### 7. @source Directive — Documented vs. Workaround (Confidence: HIGH)

The `@source` directive for node_modules is **officially documented by Tailwind CSS v4**, not a workaround. From the Tailwind v4 docs:

> "@source explicitly registers a source path that wouldn't be detected by automatic content detection"
> "especially useful when you need to scan an external library built with Tailwind"

The pattern `@source "../node_modules/@acmecorp/ui-lib"` appears verbatim in official Tailwind documentation. The `@ilamy/calendar` usage is identical in structure.

## Key Takeaways

1. **Stack match is exact** — the library was built for React 19 + Tailwind v4. No compatibility shims needed.
2. **tailwindcss-animate is a required peer dep** — must be installed alongside the package. It is NOT bundled.
3. **Client-only** — wrap in `'use client'` boundary. No SSR. The library likely uses browser APIs internally.
4. **Day.js plugins are built-in** — no extra npm installs, just `.extend()` calls at app entry.
5. **@source directive is official** — not a workaround. Adjust the relative path for your project's CSS file location.
6. **No React 19 or Tailwind v4 open issues** — the issue tracker is clean of compatibility complaints.
7. **Heavy dependency footprint** — motion, dnd-kit, 8 Radix UI packages, rrule, react-day-picker all bundle together.
8. **Missing exports** — `RecurrenceEditor` and `EventForm` are not public API (issue #81 open). If you need those UI components standalone, they are inaccessible.
9. **Timezone/Locale caveat** — Day.js operates outside React's lifecycle. Changing `timezone` or `locale` props requires forcing a component re-render via `key` prop change.

## Sources

- [npm registry manifest v1.4.0](https://registry.npmjs.org/@ilamy/calendar/1.4.0)
- [ilamy.dev usage docs](https://ilamy.dev/docs/getting-started/usage/)
- [ilamy.dev introduction](https://ilamy.dev/docs/introduction)
- [GitHub repository: kcsujeet/ilamy-calendar](https://github.com/kcsujeet/ilamy-calendar)
- [GitHub issues list](https://github.com/kcsujeet/ilamy-calendar/issues)
- [Tailwind v4 @source documentation](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [Day.js isSameOrAfter plugin docs](https://day.js.org/docs/en/plugin/is-same-or-after)
- [DEV.to introduction article by kcsujeet](https://dev.to/kcsujeet/introducing-ilamy-calendar-a-modern-react-calendar-built-for-developers-71p)
- [jqueryscript.net ilamy calendar article](https://next.jqueryscript.net/next-js/full-featured-ilamy-calendar/)
