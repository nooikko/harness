# Research: Premium UI Patterns — Linear, Vercel Dashboard, Raycast

Date: 2026-03-12

## Summary

Concrete, implementable UI/UX patterns that create the "premium product" feeling across Linear, Vercel Dashboard, and Raycast. Sourced from official design documentation (Geist Design System), official API documentation (Raycast developers.raycast.com), Raycast blog posts, Linear's method page, cmdk library documentation, and rauno.me design craft analysis.

## Prior Research

- `AI_RESEARCH/2026-03-05-joy-inducing-ui-design-shadcn-customization.md` — adjacent research on joy-inducing UI
- `AI_RESEARCH/2026-03-05-ui-standardization-audit.md` — existing component audit

---

## Current Findings

---

### 1. LINEAR — Table/List Row Patterns

**Confidence: MEDIUM** (derived from Linear's public method page, changelog analysis, and design craft posts; direct CSS inspection not available)

#### Row Structure & Interaction Model

Linear's issue list operates on a **two-tier click model**: every interactive element within a row is a distinct target, and only the row's title/name area navigates to the detail view. All other cells (status, priority, assignee, label) open popovers or inline selectors in-place without navigating.

- **Row height**: Approximately 36px for compact list view, 44px for standard list view. Items use `line-height: 28px` with `padding: 4px 0` (inferred from sidebar craft analysis showing 28px line-height as the base unit for list rows)
- **Hover state**: Subtle background color shift using the gray scale Color 2 (hover background) — never a border or shadow, purely a fill change. Transition is ~100ms ease-out
- **Status indicator**: A colored circle (approximately 16px diameter) that is its own click target. Clicking it opens a popover status selector (not inline radio buttons — a floating panel with all states listed)
- **Priority**: A small icon (16×16px) with a tooltip. Clicking opens a priority picker popover
- **Assignee**: An avatar (20px circle) that opens an assignee picker popover
- **The title**: The only element that navigates to the issue detail. Clicking anywhere on the title text navigates; clicking adjacent whitespace does not
- **Drag handle**: Appears on hover at the far left, 16px wide, only visible on hover
- **Checkbox**: Appears on hover at far left (replaces drag handle when multi-select mode is active)

#### Filter Pattern

- Filter bar sits above the list, not inline with it
- Each active filter is a pill/badge with a dismiss X. Clicking the pill body opens a popover to change the filter value; clicking X removes it
- The filter input uses a command-palette-style dropdown: type to search filter types, then type to search filter values
- Group-by and sort controls are separate from filters — they live in the view toolbar as icon+label buttons

#### Keyboard Navigation

Linear is documented as keyboard-first:
- `C` — create new issue (global shortcut, works from any list)
- `↑/↓` — navigate items in the list without clicking
- `Enter` — open selected item
- `E` — edit title inline
- `P` — set priority
- `A` — set assignee
- `L` — set label
- `Backspace` — delete (with confirmation)
- `/` — open filter command palette

---

### 2. VERCEL DASHBOARD — Design System (Geist)

**Confidence: HIGH** (sourced directly from vercel.com/geist official documentation)

#### Color System — The Scale That Drives Interaction

Vercel's Geist uses a **10-step scale per color** with semantic names:

| Step | Semantic role |
|------|--------------|
| Color 1 | Default background |
| Color 2 | **Hover background** |
| Color 3 | **Active/pressed background** |
| Color 4 | Default border |
| Color 5 | Hover border |
| Color 6 | Active border |
| Color 7 | High contrast background |
| Color 8 | Hover high contrast background |
| Color 9 | Secondary text and icons |
| Color 10 | Primary text and icons |

Implementation rule: "If your UI component's default background is Background 1, you can use Color 1 as your hover background and Color 2 as your active background."

Two foundational backgrounds: Background 1 (default) and Background 2 (subtle secondary).

CSS custom properties pattern: `--ds-gray-800`, `--ds-blue-800`, `--ds-background-100`.

P3 wide-gamut colors are used on supported browsers/displays — the vivid greens and blues are richer on modern displays.

#### Material Elevation System

Vercel uses four **base material levels** and four **floating material levels**:

**Base (in-page surfaces):**
- Material Base — everyday use, radius 6px
- Material Small — slightly raised, radius 6px
- Material Medium — further raised, radius 12px
- Material Large — further raised, radius 12px

**Floating (overlays):**
- Material Tooltip — lightest shadow, radius 6px. **Tooltips are the only floating element with a triangular stem.**
- Material Menu — lift from page, radius 12px
- Material Modal — further lift, radius 12px
- Material Fullscreen — biggest lift, radius 16px

The radius progression (6 → 12 → 16px) corresponds directly to elevation. Smaller = more embedded, larger = more floating.

#### Typography Scale (Tailwind-driven)

Font families: **Geist Sans** (UI) and **Geist Mono** (code/technical). Both are proprietary typefaces designed specifically for developer tools.

Scale names (not raw sizes, but the named levels):
- Heading 72, 64, 56, 48, 40, 32, 24, 20, 16, 14 (decreasing levels; 32 and below support a "Subtle" modifier)
- Button 16, 14 (default), 12 (for input prefix/suffix)
- Label 20, 18 (marketing), 16 (+ Strong modifier), 14 (+ Strong), 14 Mono, 13 (+ Strong, Tabular), 13 Mono, 12 (+ Strong, caps), 12 Mono
- Copy 24, 20, 18, 16 (+ Strong modifier), 14 (+ Strong), 13 (secondary text), 13 Mono (inline code)

The Label/Copy distinction: Labels are single-line UI labels; Copy is multi-line readable text.

#### Standard Interaction Timing

- Hover transitions: `transition-colors` with **200ms duration**, `delay-[0ms]`
- Focus rings: 2px blue-700 border, `opacity-0` → `opacity-100` transition
- Active/pressed: Color 3 background (one step darker than hover)

#### Status Dots (Deployment States)

Five states, each with a distinct color: QUEUED, BUILDING, ERROR, READY, CANCELED. The `label` boolean prop toggles whether the text state label renders alongside the dot. Usage: always in flex rows for list views; color coding gives instant recognition without reading text.

#### Entity Component (The Core List Row Pattern)

The **Entity component** is Vercel's named pattern for list rows — not a generic `<tr>`. It uses a two-column layout:
- **Left column**: Arbitrary content (avatar + name + metadata)
- **Right column**: Controls and actions (secondary/small buttons, status indicators)
- **Entity.Content**: Nested component for title + description text pairs
- **Entity.List**: Wrapper that stacks multiple Entity rows

Key detail: right-side actions use **secondary button styling** (not primary) at **small size** — never large buttons in list rows.

#### Card Pattern

Cards in Vercel's dashboard use a consistent "group" hover state: when you hover the card container, child elements can reveal or shift using Tailwind's `group-hover:` prefix. Box-shadow transition on hover, **6px border-radius**, border color steps from Color 4 (default) to Color 5 (hover).

#### Button Variants

Three sizes (Small, Medium, Large) × five types:
- **Default** (primary, filled)
- **Secondary** (outlined or muted background)
- **Tertiary** (text-only, minimal)
- **Error** (destructive, red)
- **Warning** (amber)

Icon-only buttons require `svgOnly` prop + `aria-label`. The naming is explicit: the destructive action is typed `error`, not `danger` or `destructive` — important because it maps to the red color scale.

#### Modal/Dialog Pattern

Structure: `Modal.Header` → `Modal.Title` + `Modal.Subtitle` → `Modal.Body` → `Modal.Actions`. The subtitle is the description sentence that explains what the modal is for. `Modal.Actions` is a footer row, not inline with the body. A `sticky` prop locks the header in place for long-form modals (settings, token creation). Initial focus is controllable. `onClickOutside` is the dismiss handler — clicking backdrop closes.

#### Empty State Component

Four archetypes:
1. **Blank Slate** — first-run experience, minimal UI
2. **Informational** — includes inline CTAs and docs links
3. **Educational** — contextual onboarding
4. **Guide** — starter content that enables interaction

Structure: centered vertical composition with `EmptyState.Icon` (configurable, 32px default), Title, Description, optional CTA button. Background uses `background-200` class. The rule: "help users progress" rather than just explaining the feature.

#### Skeleton Loaders

Three shape variants: **Pill**, **Rounded**, **Squared** (default). The component wraps children — when children are null, it shows the skeleton placeholder; when children arrive, it reveals them automatically via the `show` prop. Width/height are configurable numerically or as percentages. A "No animation" variant exists. The key pattern: **reserve the exact space** before content loads to prevent layout shift (CLS prevention).

#### Toast Notifications

Five variants: Default, Success, Warning, Error, Loading. Support for action buttons (e.g., "Undo") within the toast. Supports JSX/rich content via `preserve: true`. Implementation: `useToasts()` hook returns `toasts.message({ text })` — not a global imperative import.

---

### 3. RAYCAST — Command Palette & Keyboard-First Patterns

**Confidence: HIGH** (sourced from developers.raycast.com official API documentation and Raycast blog)

#### The Root Navigation Model

Raycast's entire UX is built on a **search-first paradigm**:
1. Open with a keyboard shortcut (Cmd+Space by default)
2. Type to filter extensions and commands — fuzzy matching against both extension name and command name
3. Press Enter to activate a command view
4. Within a command view: arrow keys navigate, Enter activates, Escape goes back

There is no mouse-required interaction in the happy path. Every view has a defined keyboard exit (Escape) and primary action (Enter or Cmd+Enter).

#### List Item Structure

A Raycast List item has five optional display areas:
- **Icon** (left, ImageLike — can be URL, system symbol, emoji, or file icon)
- **Title** (required, the primary label)
- **Subtitle** (right of title, dimmed — supports `{ value, tooltip }` object for hover details)
- **Accessories** (right-aligned array, each independently typed):
  - Text accessory: string with optional color
  - Date accessory: formatted relatively ("now", "1d", "3w")
  - Icon accessory
  - Tag accessory: string or date with optional color overlay
  - Tooltip accessory: hover text

Accessories use **relative time** by default for dates — "3 days ago" not "March 9, 2026". This is a deliberate UX choice: relative time is always faster to parse in a list.

#### Sections

Lists can be divided into `List.Section` groups with optional headings and subtitles. The `filtering.keepSectionOrder` prop controls whether fuzzy filtering respects section boundaries. Sections are visually separated but do not add significant height — they use a compact header label.

#### Action Panel (The Context Menu)

The `ActionPanel` is Raycast's equivalent of a right-click context menu, but **always keyboard-accessible** and surfaced via a dedicated key (Cmd+K within a view). Key patterns:
- First action = primary action (gets default Enter shortcut)
- Second action = secondary action (gets Cmd+Enter shortcut)
- Subsequent actions = available via ActionPanel only
- `ActionPanel.Section` groups related actions with a heading — recommended when there are many actions
- `ActionPanel.Submenu` replaces the current panel with its children — used for "choose one of many" flows (e.g., "Assign to..." shows a person picker)
- Submenus support lazy loading via `onOpen` callback

The ordering rule: **always put the most important action first** — it gets the keyboard shortcut automatically.

#### Empty View

`List.EmptyView` renders when no items match the current search. Accepts Icon, Title, Description, and optional ActionPanel. Critically: **never displays if `isLoading` is true** — the loading spinner takes priority over empty state to avoid flickering the empty state during load.

#### Form Patterns

Raycast forms are declarative — components stack vertically, labels auto-align, titles appear left. Validation fires on blur, shows red borders on error fields, and clears on change. The `useForm` hook handles the validation lifecycle. `Form.Separator` creates visual breaks between logical field groups. The submit action (`Action.SubmitForm`) does not fire `onSubmit` if any field has an error — silent prevention, not an error toast.

#### Design Philosophy: Fast, Simple, Delightful

The Raycast redesign (2022) documented specific decisions:
- Search bar was **enlarged** to signal its importance and improve scanning
- Action bar moved to **bottom of window**: left = navigation title + toast notifications, right = available actions + keyboard shortcuts displayed inline
- New icon set: outline style, bolder stroke width, consistent corner radii and stroke width rules
- **Compact Mode**: minimal interface that optimizes the core flow (open → type → enter), blurring non-essential elements
- Toasts moved **inside the app window** (not macOS system notifications) with a dedicated keyboard shortcut to expand them

---

### 4. CMDK — Command Palette Library (Used by Linear and Vercel)

**Confidence: HIGH** (sourced from github.com/pacocoursey/cmdk official README)

cmdk is the underlying command palette library used by Linear, Vercel, and many other premium products. It is intentionally **unstyled** — the pattern is implemented but the visual skin is entirely custom.

#### Architecture

- `Command.Root` — container, manages state
- `Command.Input` — search field
- `Command.List` — scrollable container; uses CSS variable `--cmdk-list-height` for animated height transitions ("height 100ms ease")
- `Command.Group` — section with optional heading; uses `hidden` attribute (not unmounting) when filtered out
- `Command.Item` — individual row
- `Command.Empty` — renders when no results match
- `Command.Loading` — conditional display during async operations
- `Command.Dialog` — wraps Command in Radix UI's Dialog primitive

#### Key Data Attributes for Styling

- `[cmdk-item]` — individual items
- `[data-selected]` — currently highlighted item (not clicked, just keyboard-focused)
- `[data-disabled]` — unavailable items

These attributes are how you style the selected state, hover state, and disabled state — not class names.

#### Filtering Behavior

Custom filter function signature: `(value: string, search: string, keywords?: string[]) => number`. Returns a numeric rank (0 = hidden, 1 = shown/matched). Keywords are invisible aliases — they influence filtering but don't render. Set `shouldFilter={false}` for fully custom server-side or async filtering.

#### The Height Animation Pattern

The `--cmdk-list-height` CSS variable updates dynamically as results filter. Apply `transition: height 100ms ease` on the list element to get the smooth height animation that Linear uses when typing in the command palette.

#### Navigation Loop

The `loop` prop on `Command.Root` enables wrapping: pressing Down at the last item wraps to the first, and Up at the first wraps to the last. Linear uses this.

---

### 5. CROSS-CUTTING PATTERNS

**Confidence: HIGH for Geist-sourced items; MEDIUM for Linear-inferred items**

#### Sidebar Navigation

From rauno.me craft analysis (CSS inspection of a premium sidebar):
- List item height: **28px line-height** (not padding-box height — the text sits in a 28px container)
- Left padding: **16px**
- Icon size: **16×16px**, color `--colors-gray11`, shifts to `--colors-gray12` on hover/active
- Hover transition: `color 100ms ease-out` — color only, no background transition on hover for nav items (background is reserved for active state)
- Active state: `data-active="true"` attribute + `box-shadow: 0 0 0 1px` border styling
- Section dividers: 1px height, `background: var(--colors-gray6)`
- Nested item marker: 4×4px circles with 1px borders using `::before` pseudo-element
- Press animation: `scale(0.96)` on active, with `cubic-bezier(.2, .8, .2, 1)` easing, `150ms ease-out`

The pattern: sidebar items use **color transitions** (not background transitions) for hover, reserving background changes for the active/selected state. This creates a clear visual hierarchy: hover = color, selected = filled background.

#### Empty States

**Vercel's rule**: empty states have four archetypes (blank slate, informational, educational, guide) and should always help users take action, not just explain the absence of data.

**Raycast's rule**: never show an empty view while `isLoading` is true — the skeleton/spinner takes priority.

**The structural pattern** across all three products:
1. Centered icon (32px, from the design system's icon set, not an emoji or illustration)
2. Short headline (2-5 words)
3. One sentence description (what this section is for, or what to do to populate it)
4. One primary CTA button (never two competing actions)

#### Destructive Actions (Delete Confirmation)

None of these products use a separate "Are you sure?" modal page. The pattern is:
- **First click** on delete: changes the button to a red confirmation state ("Click again to confirm" or changes label to "Delete permanently")
- **Second click** within ~3 seconds: executes the deletion
- If the user clicks elsewhere, the first-click state resets

Alternatively for destructive actions in modals (Vercel pattern): the modal has a `type="error"` `Modal.Action` button — it's visually distinct (red) but still in the same modal. No secondary confirmation modal is stacked.

#### Animation/Motion

**Vercel Geist standard**:
- Color transitions: 200ms, no delay
- Focus ring appearance: opacity-based (0→1), same duration
- Skeleton pulse: built-in animation, "No animation" variant available

**cmdk / command palette**:
- List height: `height 100ms ease` via `--cmdk-list-height` CSS variable

**rauno.me sidebar craft**:
- Nav transitions: `150ms ease-out`
- Easing for press: `cubic-bezier(.2, .8, .2, 1)` — this is a "spring-like" ease that starts fast and decelerates
- Press scale: `transform: scale(0.96)` — subtle, not bouncy

**Raycast redesign 2022**:
- No specific timing values published
- Philosophy: "fast, simple, delightful" — animations serve function (feedback), not decoration

The consistent principle: **sub-200ms for hover state transitions**, **100-150ms for micro-interactions** (press, expand), and **never animate structural layout** (no width/height animations for content that loads — use skeleton placeholders that reserve space instead).

#### Form Premium Feel Checklist

Based on Geist documentation patterns:
1. **Label above field**, not placeholder-as-label (placeholder disappears when typing)
2. **Subtitle/description** below the label in smaller gray text explains the field's purpose
3. **Error state**: red border + error message below the field (never a toast for field-level errors)
4. **Error clears on change** — not on submit, not on blur
5. **Button placement**: submit at bottom-right (or full-width on mobile), cancel at bottom-left. Never two equal-weight buttons next to each other without visual distinction
6. **Destructive button**: `type="error"` — explicitly styled red, not just a secondary button
7. **Modal subtitle**: always present to provide context ("Enter a unique name for your token to differentiate it from other tokens and then select the scope")
8. **Sticky header in long forms** — keeps the modal title visible while scrolling through many fields

#### What Makes Settings Pages Feel Premium

From Vercel modal documentation and Entity component usage:
- Settings are **grouped into sections**, not one long scrollable form
- Each section has a clear heading and optional description sentence
- Individual settings use the **Entity component pattern**: setting name + description on the left, the control (toggle/select/button) on the right
- Destructive settings (delete account, revoke token) are always **at the bottom** of their section, separated visually
- The save action is per-section or per-field (immediate save on toggle), not a single global "Save all" button at the bottom

---

## Key Takeaways

1. **Row interaction model**: Split clickable zones in list rows. Title navigates; status/priority/assignee open popovers. Never make the entire row a single link.

2. **The color scale is the hover system**: Use semantic Color 2 for hover backgrounds, Color 3 for active. This one rule eliminates the "should I use opacity or a new color?" question.

3. **Material elevation = border radius**: 6px for embedded components, 12px for menus/modals, 16px for full-screen overlays. Radius signals depth.

4. **Sidebar items use color (not background) for hover**: Background changes only for the active/selected item. This is the clearest visual hierarchy pattern across all three products.

5. **cmdk's `--cmdk-list-height` variable**: Apply `transition: height 100ms ease` on `[cmdk-list]` to get Linear's smooth palette height animation for free.

6. **Empty states are action prompts, not error messages**: Always include a primary CTA. The four archetypes (blank slate / informational / educational / guide) determine the CTA intensity.

7. **Destructive confirms via button state flip, not modal stack**: Two-click pattern within the same control. Never open a second modal to confirm a delete.

8. **Form errors clear on change** (not blur or submit). This eliminates the "my field looks broken even though I just fixed it" frustration.

9. **Skeleton loaders reserve space**: Use `width`/`height` props to match the loaded content's dimensions exactly. This prevents CLS and makes loading feel stable.

10. **Sub-200ms for hover, 100-150ms for micro-interactions**: Color transitions at 200ms. Press/expand animations at 100-150ms with `cubic-bezier(.2, .8, .2, 1)` easing.

---

## Gaps Identified

- **Linear's exact row heights**: Not available from official sources. 36px compact / 44px standard is inferred from observation patterns, not official documentation. Linear does not publish a public design system or Figma kit.
- **Linear's exact color tokens**: Linear uses a custom dark/light theme system but does not publish CSS token values publicly.
- **Vercel Table component exact row height and padding**: The Geist docs describe the Table compound component pattern but do not publish specific pixel values — only size variants (striped, bordered, virtualized).
- **Raycast's exact color palette**: Raycast does not publish a public design system or color tokens.
- **Vercel modal animation specifics**: Entry/exit animation details are not in the Geist documentation.

---

## Recommendations for Next Steps

1. **Inspect Linear in-product** using browser DevTools to capture exact CSS values for issue rows — the research above provides strong directional guidance but not pixel-perfect measurements.
2. **Adopt Geist's color scale naming convention** (`--ds-[color]-[step]`) for the Harness design token system — it's the most documented and principled system available from these three products.
3. **Use cmdk** for any command palette implementation (`pnpm add cmdk`) — it is already validated by Linear and Vercel, and the `--cmdk-list-height` animation pattern is documented.
4. **Apply the Entity component pattern** to admin table rows in Harness — two-column layout (content left, controls right) with secondary/small action buttons.
5. **Implement the sidebar item pattern** from rauno.me: 28px line-height, 16px left padding, `color 100ms ease-out` hover transition, scale(0.96) press animation.

---

## Sources

- Vercel Geist Design System: https://vercel.com/geist (colors, typography, materials, components)
- Vercel Geist Components: button, input, badge, status-dot, skeleton, modal, empty-state, entity (https://vercel.com/geist/[component])
- Raycast Developer Documentation: https://developers.raycast.com/api-reference/user-interface/list
- Raycast ActionPanel docs: https://developers.raycast.com/api-reference/user-interface/action-panel
- Raycast Form docs: https://developers.raycast.com/api-reference/user-interface/form
- Raycast Best Practices: https://developers.raycast.com/information/best-practices
- Raycast Blog — "A fresh look and feel" (July 2022): https://www.raycast.com/blog/a-fresh-look-and-feel
- cmdk library README (GitHub): https://github.com/pacocoursey/cmdk
- rauno.me Sidebar craft post: https://rauno.me/craft/sidebar
- Linear Method page: https://linear.app/method
