# UI Redesign — Design Decisions Log

## Project Origin
- Interface originally derived from OpenClaw. Not happy with it — felt like things smashed together, didn't give enough control.

## Core Philosophy (established 2026-03-05)
- **Chat-first, always.** The conversation is the primary surface. But "chat-first" does NOT mean everything lives inside the chat messages. It means the chat is the primary activity and nothing should take away from it. Other elements are embedded into the INTERFACE, harmonious with the chat — not competing with it, not replacing it, not requiring you to leave it.
- **No dashboards.** Dashboards are a separate page you have to go to. If you have to leave chat to control music, you won't do it.
- **No three-column layouts (for now).** Maybe in the future for things like file diffs, but historically third columns don't get used — they end up too small, people prefer dedicated pages or full-page modals. A diff like "update agent soul from X to Y" would be better as a near-full-page modal than a cramped side panel.
- **No parallel interface.** Widgets are not a separate management surface. Chat IS the control surface. Widgets are visual feedback for things controlled through conversation.
- **Not everything is persistent.** Two distinct patterns for plugin UI:
  1. **Event cards (inline in chat)** — When the agent does something in response to your input, it can show a rich inline card right there in the conversation. "Lights set to 60%" with a little visual confirmation. That's a response to an event. It's fine in chat because it's part of the conversation flow. But it is NOT the primary control surface — it's a receipt.
  2. **Persistent widgets (bottom-left zone)** — For things with ongoing state that you might want to glance at or interact with at any time (music playback, active timers). These live outside the chat in the widget zone. They don't scroll away with messages.

## Widget Placement
- **NOT chips in the header** — user questioned whether header is even the right place. Needs to feel homogenous, not tacked on.
- **NOT a right-side context panel** — too much like master-detail / Zendesk pattern.
- **NOT inline in chat messages** — chat already has a lot going on (pipeline steps, thinking blocks, tool calls). Scrolling to find a play button would be frustrating.
- **Bottom-left area has potential** — currently just an "N" avatar. Dead space. Could house a compact Smart Stack.
- **iOS Smart Stack metaphor** — one small widget area that stacks multiple cards. Shows most relevant one. Flip through others. Not a grid of 10 things.
- **Music player needs real controls** — not just a chip. Needs prev/next, play/pause, timeline scrubber. But still compact.
- **Widgets should require minimal interaction** — like Spotify's mini player. It's there, it has everything, it condenses well because everyone knows the icons. It doesn't need to be explained. It lives there happily because it doesn't demand attention — you interact when you want to, not because you have to.
- **Full-page modals over side panels** — for things that need space (diffs, complex edits, detailed views), a near-full-page modal is better than a cramped third column. Modals are temporary, focused, and don't permanently steal layout space.

## What We Need
- **A design system, not a widget system.** The design system should answer "where does this new thing go?" before the new thing exists.
- **Element taxonomy** — define what TYPES of UI elements exist (persistent controls, transient events, status indicators) and where each type lives.
- **When someone asks "where do email notifications go?" the design system already has the answer.**

## Color & Visual Language (established 2026-03-05)
- **Light mode primary.** User uses light mode most of the time. Dark mode is a secondary mode for migraines, late night, etc. Both need to be first-class.
- **Automatic dark mode is a future plugin.** Cron job checks sunset time, triggers dark mode ~2 hours after. This is a real use case for the notification layer — "Enabling nighttime mode" notification appears, clickable for "triggered by [job name]" detail. Note this when building the notification system.
- **Color direction: soft white + purple.** Not neon, not saturated. The Dribbble reference (saved as color-ref-dribbble-white-purple.png) shows the vibe — soft pink/lavender gradient wash, white surfaces, gentle purple accents. That's the right softness. The gradient background is interesting but may become visually fatiguing — use selectively, not wall-to-wall.
- **Linear light mode as structural reference.** Flat surfaces, dividers create separation (not shadows or elevation). Select bar same white as header — just a divider between them. The sidebar/wrapper is the one thing that's slightly darker. Very clean, very considered. This is the structural model.
- **No heavy shadows or elevation layers in light mode.** Separation through dividers, not depth.

## Motion Language (established 2026-03-05)
- **Animation must convey intent.** Not decorative, not space-filling. Every animation should communicate: something happened, something changed, something is in progress. If you can't articulate what the animation is saying, remove it.
- **Fluid but snappy.** These can conflict, but Framer Motion gives enough control to thread the needle. The goal is motion that feels considered and comfortable, not robotic fast or dreamily slow.
- **Selective gradients/mesh backgrounds.** Interesting as an accent (like the Dribbble reference) but not wall-to-wall. Looking at animated gradients all day becomes fatiguing. Use them for moments, not as the base surface.
- **Framer Motion (v12) is the tool.** Spring physics, AnimatePresence, layout animations. The capability is there — the constraint is purposefulness.

## Design Ethos (established 2026-03-05)
- **High functionality, low engagement barrier.** The interface must encourage interaction. If it doesn't make you WANT to use it, you'll go elsewhere. This is non-negotiable.
- **Neurodivergent-friendly by design.** The user is high-functioning autistic. Things need to actively invite interaction — not just be functional, but be compelling. If something feels like a chore to interact with, it has failed.
- **Curated, not corporate.** Not "high-end" in the Microsoft sense (big company, lots of money). High-end in the Japanese craftsman sense — painstakingly crafted, every detail meticulously planned. Think 70-year scissor maker, not enterprise SaaS.
- **Every element has its ikigai.** Every component exists for a reason, serves its purpose perfectly, and brings joy through that purpose. No element should be there just because "apps have this." It earns its place.
- **Animations matter.** Not decorative — functional. They're part of what creates the "want to interact" feeling. The modern, crafted feeling that separates a tool you love from a tool you tolerate.
- **The feeling of craft.** The interface should feel like something that was made by someone who cares deeply, not assembled from templates. Every interaction should feel intentional.

## Visual References — REJECTED Directions
- Generic admin dashboards (ShadCN Vercel template, arhamkhnz Studio Admin) — too dashboard-y
- Cybersecurity/energy/crypto dashboards — information-dense but wrong paradigm entirely
- Bento grid layouts — Apple-style mixed-size cards are for marketing pages, not chat interfaces
- Master-detail / three-column layouts — squeezes chat, creates parallel interface
- Full-page widget grids — Home Assistant mushroom style is great for smart home, wrong for chat-first AI

## Visual References — USEFUL Patterns
- Home Assistant media player widget bar — compact, right form factor for music controls
- Home Assistant conditional chips — appear/disappear based on state (relevant for status indicators)
- Streamline cards template system — declarative descriptor → rendered card pattern
- Linear dark theme — OKLCH color system, elevation through luminance
- Telecom SaaS lavender accent — subtle purple accent on dark, card hierarchy

## Design Playground App
- **Location:** `apps/design/` — Vite + React + TypeScript, port 4001
- **Run:** `pnpm --filter design dev`
- **Font in use:** Figtree (Google Fonts) — warmer/lighter than Inter, proposed but not approved yet
- **Three sections:** Surfaces (start here), Colors, Components (stub)
- **Surfaces section:** Left = swatches with token names. Right = realistic Harness layout mock using all surfaces in context (sidebar, widget zone, chat, messages, event card, input). The mock is only for evaluating colors IN context — not the actual layout design.
- **Status: COLORS APPROVED (2026-03-05)**

## Approved Token Values (apps/design/src/tokens.css)
- `--surface-page`: oklch(1.000 0.000 285) — pure white
- `--surface-sidebar`: oklch(0.965 0.008 285)
- `--surface-card`: oklch(0.980 0.005 285)
- `--surface-hover`: oklch(0.945 0.013 285)
- `--surface-active`: oklch(0.920 0.020 285)
- `--border-subtle`: oklch(0.920 0.012 285)
- `--border`: oklch(0.878 0.018 285)
- `--border-strong`: oklch(0.820 0.025 285)
- `--accent`: oklch(0.540 0.165 285) — pulled back from 0.520/0.195; still clearly purple/interactive, fits palette
- `--accent-hover`: oklch(0.500 0.180 285)
- `--accent-subtle`: oklch(0.955 0.035 285) — user messages + selected rows
- `--accent-muted`: oklch(0.780 0.090 285)
- `--text-primary`: oklch(0.160 0.010 285)
- `--text-secondary`: oklch(0.440 0.015 285)
- `--text-tertiary`: oklch(0.640 0.010 285)
- `--text-on-accent`: oklch(1.000 0.000 285)
- `--success`: oklch(0.580 0.115 150) — sage green, soft
- `--warning`: oklch(0.680 0.105 70) — muted amber, user noted "a bit muddy but same hue family, that's important"
- `--destructive`: oklch(0.545 0.135 20) — dusty rose-red
- Key accent decision: old value (0.520/0.195) read as near-black at small sizes. New value (0.540/0.165) reads as clearly purple even small, fits palette, still louder than everything else by design.

## Visual References — COLLECTED
- 36 screenshots in `.claude/research/ui-redesign-2026-03/screenshots/`
- 38 chat-first screenshots in `.claude/research/ui-redesign-2026-03/screenshots/chat-first/`
- Index: `.claude/research/ui-redesign-2026-03/chat-first-inspiration.md`
- Key useful refs: Discord overlay independent widget cards, Discord voice widget (compact/collapsible), Spotify mini player pattern
- Key rejected refs: everything dashboard-y, bento grids, three-column layouts, split-pane patterns

## Motion — Spring Preferences (discovered 2026-03-05)
- **Preferred spring:** stiffness=165, damping=18, mass=1.2
- Feel described as: "snap into place but trails just enough, one nice bounce at the end — arrives stopped then settles in"
- Used as defaults in SpringExplorer
- Motion tab created with 6 real Framer Motion demos: spring explorer, AnimatePresence list, gesture demo (hover/tap/drag), layout animations, stagger list reveal, scroll-linked progress bar

## Typography — Status (2026-03-05)
- **Frontrunners:** Figtree, DM Sans
- **Maybe:** Manrope (good open G, comma is debatable)
- **Rejected:** Plus Jakarta Sans (square-line comma), Geist (square-line comma)
- User discovered preference through the font picker: prefers rhombus/slanted-dash comma (Figtree/DM Sans style) over square-with-line comma (Geist/Plus Jakarta)
- Monospace: JetBrains Mono — confirmed, no alternatives considered
- **Decision: Figtree** — approved 2026-03-05. Already set as `--font-sans` in tokens.css. Not spending more time on this.

## Component Refactor Targets (decided 2026-03-05)
Everything ends up in `packages/ui`. Nothing stays scattered in `apps/web`.

| Component | Destination | Notes |
|-----------|-------------|-------|
| Button | packages/ui | augment existing ShadCN |
| Input | packages/ui | augment existing ShadCN |
| Badge | packages/ui | augment existing ShadCN |
| Chat message bubble | packages/ui | new component |
| Pipeline indicator | packages/ui | new component |
| Widget card | packages/ui | new component |
| Chat input (Lexical) | packages/ui | move + theme; currently apps/web/src/app/(chat)/chat/_components/chat-input.tsx |

The Lexical chat input is complex: rich text editor, slash command autocomplete (BeautifulMentionsPlugin), CommandNode custom node, AgentSelector + ModelSelector in controls row. Full theming required — replace Tailwind class refs with CSS token variables. Slash command menu + mention chips need theming too.

Design playground compose bar = visual reference for what the Lexical input should look like post-theme.

User message bubbles also render Lexical rich text (not plain strings) — inline command chips like `/schedule` appear inside the bubble. Message bubble component in packages/ui must accept serialized Lexical state, not just a string. Chat input + message bubble are coupled — port them together.

## Blocks Section — Status (2026-03-06, updated)

Design playground Blocks tab is live (`apps/design/src/_sections/blocks-section.tsx`).

### Block Files (all in `apps/design/src/blocks/`)

| File | Exports | Key components used |
|------|---------|---------------------|
| `message-block.tsx` | `UserMessage`, `AssistantMessage`, `ToolCallRow`, `ThinkingRow` | `MarkdownContent`, motion |
| `thread-list-item.tsx` | `ThreadListItem`, `ThreadItem` | `Badge`, `DropdownMenu` |
| `event-card.tsx` | `EventCard`, `EventCardProps` | motion.button |
| `smart-stack.tsx` | `SmartStack`, `MusicWidgetContent`, `TimerWidgetContent`, `Widget` | `Badge`, `Progress` |
| `chat-input.tsx` | `ChatInput`, `ChatInputProps` | `Button`, `Kbd`, `DropdownMenu`, `Popover` |

### Widget Taxonomy — FINALIZED
Two distinct patterns. Pipeline is NOT a widget:

1. **Event Cards (inline chat receipts)** — appear in conversation flow when agent acts. Compact inline-flex cards with icon + title + detail + meta + optional action button. Scroll away with thread. Examples: "💡 Kitchen lights · 40%", "♫ Lo-Fi Study Beats · playing". These are receipts, not control surfaces. `EventCard` now renders INSIDE `AssistantMessage` as `children` — not below it as a separate section.

2. **Smart Stack (bottom-left persistent zone)** — one compact area, flip between plugin cards with pill dot nav. AnimatePresence slide animation (direction-aware x offset). Header icon/label cross-fades. Live pulse dot when live. Music card: album art, clickable scrubber, prev/play/pause/next. Timer card: Progress bar (non-interactive), countdown, play/pause. Width: 288px. State persisted to localStorage.

3. **Pipeline** — NOT a widget. Thinking blocks and tool calls collapse/expand inline inside `AssistantMessage`.

### Message Block Design — FINALIZED
Both messages redesigned for visual parity with the rest of the system.

**`AssistantMessage`** — card-based, grounded presence:
- `background: var(--surface-card)`, `border: 1px solid var(--border-subtle)`, `borderRadius: var(--radius-xl)`
- **Header row** (when `meta` provided): accent dot · agent name (optional) · model in mono · duration. Meta is a "from" header, not a footer afterthought.
- **Pre-content section**: thinking + tool calls in own padded zone with separator below. No left-border treatment (redundant inside a card).
- **Body**: children (EventCards) then text content. EventCards live INSIDE the message as `children` prop.
- `AssistantMessageProps` includes `children?: React.ReactNode` and `meta?: { model?, duration?, agent? }`.

**`UserMessage`** — refined bubble:
- No "You" label (right-alignment communicates ownership).
- `maxWidth: 80%`, right-aligned via `justifyContent: flex-end`.
- `borderRadius: var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)` — message-bubble shape (bottom-right corner sharp).
- `border: 1px solid var(--border-subtle)` — uses same border vocabulary as everything else.

### Chat Input — FINALIZED
**`ChatInput`** features:
- **Unified card**: popup + input share one border; shadow appears on card when commands are active.
- **Slash command popup**: floats above input (absolute), `border-bottom: var(--border-subtle)` as separator, input removes top border when active → single thin seam.
- **Keyboard navigation**: ArrowUp/Down to highlight, Tab to accept (inserts command chip), Escape to clear, Enter to send.
- **Command chip**: when a command is selected via Tab/click, the command appears as a styled chip (`var(--accent-subtle)` bg, mono font, `×` dismiss) inside the textarea area. Clicking chip restores raw `/commandname ` text. Separate textarea for args with `placeholder="Add details…"`.
- **Focus/blur**: popup only shows when textarea is focused (`focused` state). `onMouseDown` on popup prevents blur when clicking commands (standard race condition fix).
- **Ghost selectors**: agent + model use `SelectorTrigger` (ghost button with ⌄ chevron, `React.forwardRef`). Agent selector uses `Popover`, model selector uses `DropdownMenu`.
- **Showcase padding**: `paddingTop: 220px` to give popup room to extend upward without clipping.

### Blocks Tab Layout (current)
- Row 1 (BlockGrid): `MessageBlockShowcase` (left) + `ThreadListShowcase` (right)
- Row 2 (BlockGrid): `SmartStackShowcase` (left) + `ChatInputShowcase` (right)
- Row 3 (full width): `GooeyToastDemo`

### MessageBlockShowcase — unified conversation
Single showcase merged from previous `MessageBlockShowcase` + `EventCardShowcase`. Shows: UserMessage → AssistantMessage (thinking + EventCards for lights + music) → UserMessage → AssistantMessage (EventCard for weekly review). Event cards are `children` of AssistantMessage, not separate siblings.

## Components Section — Status (2026-03-06)

Design playground Components tab is live at http://localhost:4001 (Components tab).
All packages/ui primitives are present. User is reviewing one by one.

### Animation patterns established:
- **Buttons:** `whileHover` + `whileTap={{ scale: 0.97 }}`, spring stiffness=400 damping=20
- **Popups (Dropdown, Popover):** `AnimatePresence` + `forceMount` on Radix Content + inner `motion.div` with `transformOrigin: 'top left'`, `scale: 0.95→1` + `opacity: 0→1`. NO `y` offset — causes diagonal swooping with `align='start'` menus.
- **Collapsible:** `AnimatePresence` directly (bypassing `Collapsible.Content` entirely), `height: 0→'auto'` + `opacity`, `duration: 0.22` tween with `ease: [0.16,1,0.3,1]`. Spring is too choppy in Safari for height animations.
- **Switch:** Motion track color + thumb `x` spring stiffness=500 damping=30
- **Tabs:** `motion.div` with `layoutId='tab-indicator'` for underline, `whileTap` on buttons

### Known Safari issues:
- `height: 'auto'` springs are frame-droppy in Safari. Use fixed-duration tween `[0.16,1,0.3,1]` instead.
- `scale` on popup menus with non-centered transform origin can look diagonal — use `transformOrigin: 'top left'` always.

### Components present in playground:
Button, Badge, Label, Input, Textarea, Select (real Radix), Card, Alert, Table (left column)
Switch, Tabs, Progress, Skeleton, Tooltip, Separator, Collapsible, Scroll Area, Dropdown Menu, Popover, Dialog, Alert Dialog, Command (right column)

### Pending review:
User is currently going through each component individually. No approvals logged yet.
Chat input (Lexical), message bubbles, pipeline indicator, widget card — deferred to separate section.

## What Comes After Component Review
1. Port approved components to packages/ui (augment existing ShadCN)
2. Dark mode token set
3. Chat input + message bubble section (Lexical, coupled)
4. Widget card + pipeline indicator section
5. apps/web full refactor — replace Tailwind refs with CSS tokens, swap to packages/ui components
