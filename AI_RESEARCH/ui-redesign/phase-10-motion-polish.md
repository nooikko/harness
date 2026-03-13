# Phase 10: Motion & Final Polish

**Goal**: The finishing layer that makes the interface feel alive without being noisy.

---

## Principle

Every animation must have a reason. Subtle entrance for new content (150-300ms ease-out). No animation is better than gratuitous animation.

The goal is not "add animations." The goal is "remove the jarring moments" — when content pops in without transition, when hover states snap on/off, when toggles flip with no acknowledgment.

---

## Specific Animations

### 1. Page Content Fade-In

When navigating between admin pages, the main content area should fade in rather than hard-swap.

```css
.admin-content {
  animation: fade-in 150ms ease-out;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

This is a tiny 4px upward slide + opacity transition. Nearly imperceptible but removes the "flash" feeling.

### 2. Table Row Hover

All table rows:
```css
tr {
  transition: background-color 200ms ease;
}
tr:hover {
  background-color: var(--color-muted) / 0.5;
}
```

### 3. Toggle Switch Animation

When a toggle flips (plugin enable/disable, cron job enable/disable), the knob should spring:

```css
.toggle-knob {
  transition: transform 150ms cubic-bezier(.2, .8, .2, 1);
}
```

The shadcn Switch component may already have this — verify and adjust timing if needed.

### 4. Row Menu Reveal

The `...` button that appears on row hover:

```css
.row-menu-trigger {
  opacity: 0;
  transition: opacity 150ms ease;
}
tr:hover .row-menu-trigger {
  opacity: 1;
}
```

### 5. Card Hover (Plugins, Agents)

Cards should acknowledge hover with a subtle border color shift:

```css
.card {
  transition: border-color 200ms ease;
}
.card:hover {
  border-color: var(--color-border-hover); /* slightly darker */
}
```

### 6. Skeleton → Content Crossfade

When Suspense resolves and content replaces the skeleton, there should be a brief crossfade rather than a hard swap. This is harder to achieve with React Suspense — may require a wrapper component that uses `startTransition` or a CSS approach.

Simpler approach: just ensure the content fades in (animation on the resolved component) while the skeleton was already the right dimensions (no layout shift).

### 7. Sidebar Active State Transition

When clicking a sidebar item:
```css
.sidebar-item {
  transition: background-color 200ms ease, color 200ms ease;
}
.sidebar-item:active {
  transform: scale(0.96);
  transition: transform 150ms cubic-bezier(.2, .8, .2, 1);
}
```

---

## What NOT to Animate

- Don't animate data values (token counts, costs)
- Don't animate table sorting (we're not doing client-side sorting)
- Don't animate breadcrumb changes
- Don't animate the sidebar opening/closing (it's always open in admin)
- Don't add loading spinners — skeleton loaders are better

---

## Estimated Scope

- Mostly CSS additions to globals.css or component-level classes
- No new dependencies
- Low effort but high perceived quality impact
- Should be sprinkled throughout as other phases are built, not done all at once
