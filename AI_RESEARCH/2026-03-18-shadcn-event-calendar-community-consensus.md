# Research: shadcn/ui Full Event Calendar — Community Consensus
Date: 2026-03-18

## Summary

The shadcn/ui ecosystem has NOT converged on a single "blessed" full event calendar the way it converged on react-table for data grids. There is no official shadcn block or registry entry for a full week/month/day event calendar. The community discussion (Discussion #3214) is still active and unsettled. However, two projects have emerged as the leading community favorites, with a third gaining momentum.

## Prior Research

See `AI_RESEARCH/2026-03-18-react-calendar-scheduling-libraries.md` for full library landscape (react-big-calendar, FullCalendar, @ilamy/calendar, lramos33/big-calendar, etc.).

---

## Current Findings

### What the Official shadcn/ui Provides

The official `<Calendar>` component (built on React DayPicker) is exclusively a **date picker / date selection** component — not an event calendar. It supports single-date, range, and multi-date selection modes. No event display. No week/month/day view switching.

In June 2025, shadcn/ui shipped an upgrade to the Calendar component with React DayPicker and "30+ calendar blocks." These blocks are date-picker variants (booked dates, pricing per day, presets, etc.) — not event scheduling calendars.

**Source:** https://ui.shadcn.com/docs/changelog/2025-06-calendar and https://ui.shadcn.com/docs/components/calendar (confirmed by direct fetch)

---

### The Community Discussions

**Discussion #3214** — "[blocks]: Full calendar" — is the primary shadcn community thread on this topic.

Key signals from the discussion:
- Multiple community members have built solutions and shared them
- **No single solution was officially endorsed by the shadcn maintainers**
- The top-praised solutions (by community upvotes) are:
  1. **ilamy-calendar** (by @kcsujeet) — called "hands down the best" by multiple members; praised for smooth UI, resource calendars, RRule recurring events, drag-and-drop
  2. **lramos33/big-calendar** — praised for "vanilla shadcn components" and having "the best attempt" at the composition pattern
  3. **yassir-jeraidi/full-calendar** — also mentioned positively (year view, agenda toggle, drag-and-drop, event resizing)

**Discussion #2300** — "Any idea of adding a new event calendar component?" — earlier thread with similar outcome: no official adoption, community pointed to react-big-calendar + list-jonas/shadcn-ui-big-calendar as a workaround.

**Source:** https://github.com/shadcn-ui/ui/discussions/3214 and https://github.com/shadcn-ui/ui/discussions/2300

---

### The Leading Community Candidates (Ranked by Evidence)

#### 1. lramos33/big-calendar — The "Most Shadcn-Native" Option

| Attribute | Value |
|-----------|-------|
| GitHub Stars | 915 |
| License | MIT |
| Type | Copy-paste (not npm) |
| Views | Day, Week, Month, Year, Agenda (5 views) |
| Drag-and-drop | Yes |
| Recurring events | Not mentioned |
| Built on | React Context + date-fns (no external calendar lib) |
| Tailwind version | v3 (not v4) |
| Stack | Next.js 14 + TypeScript + shadcn/ui |

**Why it's popular:** Built entirely from scratch using shadcn/ui components and Tailwind — no external calendar library. "Full ownership" of code. The copy-paste model fits the shadcn philosophy. Dark mode works via shadcn CSS variables. 5 view modes including Year and Agenda.

**Key limitation:** Built on Tailwind v3. For a Tailwind v4 project, migration work would be needed (primarily syntax changes in `@theme` vs `theme.extend`, CSS variable naming). Not an npm package — changes are manually imported.

**Source:** https://github.com/lramos33/big-calendar (915 stars, 118 forks, 168 commits)

---

#### 2. @ilamy/calendar — The "Most Feature-Complete" Option

| Attribute | Value |
|-----------|-------|
| GitHub Stars | ~244 (as of March 2026) |
| npm Package | `@ilamy/calendar` |
| License | MIT |
| Type | npm package |
| Views | Day, Week, Month, Year + Resource (horizontal/vertical timelines) |
| Drag-and-drop | Yes (dnd-kit) |
| Recurring events | Yes (RFC 5545 / RRule) |
| Built on | TypeScript + Tailwind + shadcn/ui + dayjs + dnd-kit + rrule.js |
| Latest version | 1.4.0 (March 1, 2026) |
| Test coverage | Claims 100% |

**Why it's gaining:** RRule recurring events, resource calendar views (unique among shadcn-ecosystem options), iCalendar export (.ics), 100+ locale support, active versioned releases. Called "hands down the best" in Discussion #3214 by multiple community members.

**Key limitation:** An npm package (not copy-paste) that depends on shadcn being installed. Requires Tailwind to scan `node_modules/@ilamy/calendar` via `@source` directive — a non-standard Tailwind step. Also requires manually extending dayjs with timezone/utc plugins. Fewer stars than lramos33 (244 vs 915), but more actively developed with versioned releases.

**Source:** https://github.com/kcsujeet/ilamy-calendar, https://www.npmjs.com/package/@ilamy/calendar, https://ilamy.dev/

---

#### 3. yassir-jeraidi/full-calendar — The "Most Views" Option

| Attribute | Value |
|-----------|-------|
| GitHub Stars | 364 |
| License | MIT |
| Type | Copy-paste / shadcn registry installable |
| Views | Day, Week, Month, Year, Agenda (5 views) |
| Drag-and-drop | Yes + event resizing |
| Multi-user support | Yes (with filtering) |
| Built on | Next.js + shadcn/ui + Tailwind |

**Why it's notable:** Installable via a custom shadcn registry (closer to the "npx shadcn add" workflow). Has multi-user filtering (color-coded by user). 174 commits, live demo at calendar.jeraidi.dev.

**Source:** https://github.com/yassir-jeraidi/full-calendar

---

#### 4. list-jonas/shadcn-ui-big-calendar — The "react-big-calendar Wrapper" Option

| Attribute | Value |
|-----------|-------|
| GitHub Stars | 215 |
| License | MIT |
| Type | CSS wrapper over react-big-calendar |
| Views | Month, Week (inherits from react-big-calendar) |
| Drag-and-drop | Via react-big-calendar |
| Built on | Pure CSS + shadcn CSS variables |

**Why it exists:** Purely a theming layer — maps shadcn CSS variables to react-big-calendar's stylesheet. No JS changes. The simplest integration path if you're already using react-big-calendar and just want it to look like shadcn.

**Key limitation:** You're inheriting all of react-big-calendar's limitations and styling model. No new functionality over stock react-big-calendar. Only 215 stars vs lramos33's 915.

**Source:** https://github.com/list-jonas/shadcn-ui-big-calendar

---

### The "Full Event Calendar" by Charlie Depps (fulleventcalendar.com)

A premium, paid product ($299 one-time) that appears in search results on allshadcn.com. Claims 5 views (Month, Week, Day, Year, List), recurring events, multi-day/all-day support, built with shadcn/ui + Radix UI + Framer Motion.

**Not open source.** Source code only available after purchase. Not a community-maintained option.

**Source:** https://allshadcn.com/tools/full-event-calendar/

---

## Is There a React-Table Equivalent? (The "Community Blessed" Question)

**No.** There is no equivalent to TanStack Table for full event calendars in the shadcn ecosystem. The reasons:

1. **The official shadcn team has not adopted any solution.** No official block or registry entry exists for a full event calendar.

2. **The leading option (lramos33/big-calendar) has 915 stars** — significant for this niche, but far from the adoption signal of TanStack Table (20k+ stars) or the way react-table was endorsed in shadcn's official "DataTable" docs.

3. **The shadcn maintainers are aware of the gap** (Discussion #3214 is open) but have not shipped a solution. The June 2025 Calendar update addressed the date-picker story, not the event-calendar story.

4. **The ecosystem is fragmented** across 4+ competing approaches: copy-paste full implementations (lramos33, yassir-jeraidi, charlietlamb), npm packages (@ilamy/calendar), CSS wrappers over existing libs (list-jonas), and external library integrations (FullCalendar with shadcn theming).

**Closest analog to a community choice:** lramos33/big-calendar has the highest stars (915), is built most faithfully to the shadcn copy-paste pattern, and was specifically called out in Discussion #3214 as the best attempt at composition with vanilla shadcn components. It's the de facto leader but not a true consensus pick.

---

## Key Takeaways

1. **No official shadcn block exists** for a full event calendar. Official Calendar = date picker only. This is a known gap (Discussion #3214).

2. **lramos33/big-calendar** is the community leader by star count (915) and most aligned with the shadcn copy-paste philosophy. Tailwind v3 — needs testing for v4 compatibility.

3. **@ilamy/calendar** is the most feature-complete npm package option (RRule, resource views, dnd-kit, 100+ locales) with active versioned releases and strong Discussion #3214 endorsements. Lower star count but faster-growing.

4. **yassir-jeraidi/full-calendar** offers the closest thing to a `npx shadcn add` install flow via custom registry. Good middle ground.

5. **The paid "Full Event Calendar" by Charlie Depps** ($299) is the only commercially polished option but is not open source.

6. **For this stack (Next.js 16 + React 19 + Tailwind v4 + shadcn):**
   - Verify Tailwind v4 compatibility before committing to lramos33 (built on v3)
   - @ilamy/calendar's `@source node_modules` requirement works fine with Tailwind v4's `@source` directive
   - Neither option has an official React 19 compatibility statement — test with `--legacy-peer-deps` and check for console warnings

---

## Gaps Identified

- No data on React 19 compatibility testing for lramos33/big-calendar or yassir-jeraidi/full-calendar
- No Tailwind v4 migration notes confirmed for lramos33/big-calendar
- @ilamy/calendar download counts not retrievable (npm returned 403)
- Discussion #3214 comment count / total upvote distribution not captured (GitHub login required for detail)

## Sources

- https://github.com/shadcn-ui/ui/discussions/3214 — Full calendar community discussion
- https://github.com/shadcn-ui/ui/discussions/2300 — Earlier "add event calendar" request
- https://ui.shadcn.com/docs/components/calendar — Official Calendar component (date picker only)
- https://ui.shadcn.com/docs/changelog/2025-06-calendar — June 2025 calendar upgrade (30+ blocks, date picker variants)
- https://github.com/lramos33/big-calendar — 915 stars, 5 views, no external lib
- https://github.com/kcsujeet/ilamy-calendar — 244 stars, RRule, resource views, v1.4.0 (Mar 2026)
- https://ilamy.dev/ — ilamy-calendar official site
- https://www.npmjs.com/package/@ilamy/calendar — npm package
- https://github.com/yassir-jeraidi/full-calendar — 364 stars, shadcn registry installable
- https://github.com/list-jonas/shadcn-ui-big-calendar — 215 stars, CSS wrapper over react-big-calendar
- https://github.com/charlietlamb/calendar — 548 stars, day/week/month, last commit Jan 2025
- https://allshadcn.com/tools/full-event-calendar/ — Paid option ($299, not open source)
