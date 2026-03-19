# Research: React Calendar/Scheduling UI Libraries
Date: 2026-03-18

## Summary

Comprehensive survey of React calendar/scheduling libraries for a Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui stack. The user wants something more modern and styleable than Schedule-X. Key findings: react-big-calendar has React 19 support as of Feb 2025 but requires heavy CSS overriding for Tailwind; FullCalendar v7 is in active beta with a full React rewrite but React 19 support is unconfirmed; two strong "shadcn-native" options emerged (lramos33/big-calendar and @ilamy/calendar); TanStack Time is alpha-only with no UI components yet.

## Prior Research

None on this specific topic.

## Current Findings

---

### 1. react-big-calendar

**npm:** `react-big-calendar`
**Latest version:** 1.19.4
**Last published:** ~9 months ago (approximately June 2025)
**Weekly downloads:** ~754,000 (Snyk data) — "Influential project" tier
**GitHub stars:** 7,000+
**License:** MIT

**React 19 support:**
- Issue #2701 was opened requesting React 19 support; PR #2710 "feat: add support for React 19" was merged on **February 24, 2025**. React 19 is now a supported peer dependency.
- Separate issue #2785 remains open about an outdated JSX transform causing runtime warnings in React 18/19 (classic vs automatic JSX runtime). Not a breaking issue but generates console noise.

**Views:** Month, Week, Day, Agenda
**Drag-and-drop:** Yes, via react-dnd addon
**Timezone support:** Yes, via date-fns-tz or moment-timezone localizers

**Styling approach:**
- Ships compiled CSS (`react-big-calendar/lib/css/react-big-calendar.css`) which must be imported
- Also ships SCSS source with SASS variables for customization
- Tailwind CSS integration is **not native** — requires either overriding compiled CSS classes or using one of the community shadcn wrappers
- Community project `lramos33/big-calendar` provides a production-quality shadcn/Tailwind wrapper (915 stars, copy-paste, MIT)
- The `shadcn.io` template "Shadcn UI Big Calendar" also wraps react-big-calendar in shadcn/CSS variables for light/dark mode

**Bundle size:** ~95KB gzipped (from comparison article; includes core only, no localizer)

**Known issues:**
- v1.19.4 (the latest) was a revert — v1.19.3 introduced a regression in the dayjs localizer (casting dates as UTC instead of local time). Current state is stable but the dayjs story has been bumpy.
- JSX transform warning in React 19 (open issue, cosmetic)
- No active development of new features — maintainer appears to be in maintenance mode

**Assessment:** Mature, widely used, but the styling story for Tailwind/shadcn requires wrapping. Not "modern-looking" out of the box without the community wrappers.

---

### 2. FullCalendar

**npm:** `@fullcalendar/react` + `@fullcalendar/core` + plugins
**Stable version:** 6.1.20 (last published ~3 months ago)
**v7 beta:** v7.0.0-beta.8 (March 15, 2026) — not yet stable
**Weekly downloads:** High (specific number not retrieved; widely used enterprise library)
**License:** MIT core + premium plugins ($480/dev+)

**React 19 support:**
- v6 stable peer dependency: `react@^16.7.0 || ^17 || ^18` — **React 19 NOT officially listed**
- v7 beta: Full architectural rewrite — `@fullcalendar/react` is now fully implemented in React (not a thin Preact wrapper). SSR and StrictMode now work. React 19 not explicitly mentioned in beta release notes as of beta.8.
- In practice, React 19 likely works with `--legacy-peer-deps` but is not officially supported until v7 stable ships.

**Views:** Month, Week, Day, List/Agenda, Timeline (premium), Resource (premium)
**Drag-and-drop:** Yes (interaction plugin, free)
**Timezone support:** Yes, via temporal-polyfill (v7) or moment-timezone/luxon (v6)

**Styling approach:**
- v6: CSS files per plugin, requires importing multiple stylesheets
- v7: Major theming overhaul — CSS variables throughout, new theme system (themes.fullcalendar.io), a `colorScheme` prop added in beta.8
- **Not Tailwind-native.** CSS variables can be mapped to Tailwind design tokens but this requires manual effort.
- Community template "shadcn-ui-fullcalendar-example" exists on shadcn.io template gallery

**v7 breaking changes (for migration planning):**
- `@fullcalendar/core` removed as peer dependency (now bundled)
- `temporal-polyfill` now required as peer dep
- Moment/Luxon/Bootstrap theme packages removed
- Vanilla JS package renamed from `@fullcalendar/core` to `fullcalendar`

**Bundle size:** ~100KB gzipped for a typical setup (core + daygrid + interaction). Modular — only pay for plugins you use. A minimal month-only setup is ~43KB gzipped (older benchmark; likely similar).

**Pricing:** Core free (MIT). Resource/Timeline views, scheduler plugin = premium license. For a basic event calendar, fully free.

**Assessment:** Most feature-complete option, but heavyweight. v7 will be a significant improvement in React integration and theming. Not production-ready on v7 yet. Tailwind styling requires manual CSS variable mapping.

---

### 3. @ilamy/calendar

**npm:** `@ilamy/calendar`
**Announced:** July 21, 2025 (DEV.to post)
**Weekly downloads:** Low (new library, no specific numbers retrieved; npm page returned 403)
**License:** Free (MIT likely, but license not explicitly confirmed in sources)

**React version support:** Not explicitly stated by author
**Views:** Day, Week, Month, Year
**Drag-and-drop:** Yes ("intuitive drag-and-drop for creating, moving, and resizing events")
**Timezone support:** Yes ("full timezone support for international applications")
**Recurring events:** Yes (daily, weekly, monthly, yearly with exception handling)

**Styling approach:**
- **Zero CSS shipped** — completely headless/unstyled
- Uses Tailwind CSS via `@source` directive pointing into `node_modules/@ilamy/calendar` to scan for classes
- Designed explicitly for Tailwind/shadcn integration
- Full design control to the consumer

**Known limitations / gotchas:**
- Requires manually extending Day.js with plugins (`isSameOrAfter`, `isSameOrBefore`, `timezone`, `utc`) — runtime errors without this
- Tailwind must explicitly scan the package in `node_modules` (non-standard Tailwind config step)
- Very new — low community adoption, limited battle-testing
- Resource calendar coming "soon" (not yet available)

**Built with:** Bun, TypeScript, Day.js

**Assessment:** The most architecturally aligned with the user's stack. Zero CSS means no style conflicts. Tailwind-native by design. Major concern is maturity — released July 2025, low download count, untested at scale.

---

### 4. lramos33/big-calendar (shadcn-native copy-paste)

**Type:** Copy-paste component (not an npm package)
**Stars:** 915 (GitHub)
**Forks:** 118
**Last commit:** Active (168 commits on main)
**License:** MIT

**Views:** Day, Week, Month, Year, Agenda (5 views — more than react-big-calendar's default)
**Drag-and-drop:** Yes (move events between days in month view; adjust timing in week/day views)
**Timezone support:** Not explicitly mentioned
**Recurring events:** Not mentioned

**Styling approach:**
- Built **entirely with shadcn/ui + Tailwind CSS v3**
- Dark mode via shadcn's CSS variable system
- date-fns for date math
- React Context for state

**Tech stack:** Next.js 14, TypeScript, Tailwind v3, shadcn/ui, date-fns

**Note:** Built on Tailwind v3, not v4. Would need validation/migration for Tailwind v4 compatibility. Not built on react-big-calendar — it's a ground-up implementation.

**Assessment:** Best "looks polished out of the box" option with no external calendar library dependency. The copy-paste model means full ownership of the code. Tailwind v3 vs v4 is a potential friction point for this stack.

---

### 5. charlietlamb/calendar (shadcn copy-paste)

**Type:** Copy-paste component (not an npm package)
**Stars:** 548
**Last commit:** January 12, 2025
**License:** MIT

**Views:** Day, Week, Month
**Drag-and-drop:** Not mentioned
**Styling:** shadcn/ui + Radix UI + Tailwind CSS

**Assessment:** Smaller, less active than lramos33/big-calendar. Fewer views, last commit Jan 2025 (over a year ago). Lower priority option.

---

### 6. TanStack Time

**npm:** Not published (no npm package as of research date)
**Status:** Alpha — 1 commit on GitHub, last commit December 28, 2024
**Type:** Headless date/time **utilities** only — no UI calendar components

**What it is:** Utility library for date math using the TC39 Temporal API (with polyfill). Would replace Moment/Luxon/DayJS. Not a calendar rendering library.

**Assessment:** Not relevant for calendar UI. Monitor for future development. If it stabilizes, it could be a good replacement for Day.js as the date math engine inside a custom calendar.

---

### 7. Cal.com open source components

**Status:** Cal.com is an open-source scheduling application, but they do **not publish a standalone calendar component to npm**. Their UI is deeply integrated into their app's Next.js structure.

They publish `@calcom/atoms` for embedding booking flows, but this is a full scheduling widget (with availability, booking confirmation, etc.) — not a generic calendar view component.

**Assessment:** Not applicable for a generic calendar UI need. The atoms package is for embedding Cal.com's booking flow, not for building your own event calendar.

---

### 8. react-day-picker (honorable mention — the foundation)

**npm:** `react-day-picker`
**Downloads:** 6+ million weekly
**What shadcn/ui's `<Calendar>` is built on**

**Important distinction:** react-day-picker is a **date picker / date selection UI** — not a scheduling/event calendar. It shows a month grid for date selection, not a grid with timed event slots. It's not a replacement for react-big-calendar or FullCalendar.

**Assessment:** Already in the stack via shadcn. Not relevant for multi-view scheduling.

---

### 9. Mina Scheduler

**Type:** Next.js template (shadcn.io template gallery)
**npm:** Not a standalone package
**Views:** Day, Week, Month
**Drag-and-drop:** Mentioned in template description
**Styling:** shadcn/ui + Tailwind + Framer Motion animations
**License:** MIT

**Assessment:** A polished demo/template built on shadcn. Not a maintained library with versioned releases. Good for inspiration or as a starting base.

---

## Pricing / Licensing Summary

| Library | License | Cost |
|---------|---------|------|
| react-big-calendar | MIT | Free |
| FullCalendar core | MIT | Free |
| FullCalendar premium plugins | Commercial | $480/dev+ |
| @ilamy/calendar | MIT (likely) | Free |
| lramos33/big-calendar | MIT | Free |
| DHTMLX Scheduler | Commercial | $1,299–$5,799 |
| Bryntum Scheduler | Commercial | $2,040–$6,000 |
| DayPilot Lite | Apache | Free |
| DayPilot Pro | Commercial | $649+ |

---

## Key Takeaways

1. **React 19 support is patchy.** react-big-calendar added it in Feb 2025. FullCalendar v6 does not list React 19 in peer deps; v7 beta is a full rewrite but not stable. @ilamy/calendar's React version support is undocumented.

2. **Tailwind v4 compatibility is an open question for all libraries.** lramos33/big-calendar targets Tailwind v3 explicitly. @ilamy/calendar uses Tailwind classes but needs `@source` node_modules scanning. FullCalendar and react-big-calendar don't use Tailwind at all.

3. **For the harness stack (React 19 + Tailwind v4 + shadcn)**, the realistic options ranked:
   - **@ilamy/calendar** — architecturally best fit (headless, Tailwind-native, full views + DnD), but immature (released July 2025, low adoption)
   - **lramos33/big-calendar** — best "looks right immediately" option (shadcn-native, 915 stars), but copy-paste (full code ownership) and Tailwind v3 (needs v4 check)
   - **react-big-calendar + shadcn wrapper** — proven at scale, React 19 support confirmed, but requires CSS import + override dance
   - **FullCalendar v7 (when stable)** — most features, but heavyweight and React 19 unconfirmed until stable release

4. **Schedule-X problems context:** Schedule-X had framework compatibility issues (Angular 20 compat issue open). Its React adapter has similar architectural patterns to FullCalendar v6 (thin wrapper). The alternatives above all have cleaner React-first stories.

5. **TanStack Time and Cal.com components are not relevant** for this use case.

## Sources

- https://snyk.io/advisor/npm-package/react-big-calendar
- https://github.com/jquense/react-big-calendar/issues/2701 (React 19 PR merged Feb 24, 2025)
- https://github.com/jquense/react-big-calendar/issues/2785 (JSX transform warning)
- https://fullcalendar.io/docs/react
- https://github.com/fullcalendar/fullcalendar-workspace/releases/tag/v7.0.0-beta.7
- https://github.com/fullcalendar/fullcalendar-workspace/releases/tag/v7.0.0-beta.8
- https://www.npmpeer.dev/packages/@fullcalendar/react/compatibility
- https://ilamy.dev/
- https://dev.to/kcsujeet/introducing-ilamy-calendar-a-modern-react-calendar-built-for-developers-71p
- https://www.npmjs.com/package/@ilamy/calendar
- https://github.com/lramos33/big-calendar
- https://github.com/charlietlamb/calendar
- https://github.com/TanStack/time
- https://mina-scheduler.vercel.app/
- https://calendarcn.vercel.app/
- https://zoer.ai/posts/zoer/best-react-calendar-components-modern-apps
- https://dhtmlx.com/blog/best-react-scheduler-components-dhtmlx-bryntum-syncfusion-daypilot-fullcalendar/
- https://www.builder.io/blog/best-react-calendar-component-ai
- https://github.com/schedule-x/schedule-x
