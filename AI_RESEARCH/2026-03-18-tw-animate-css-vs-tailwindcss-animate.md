# Research: tw-animate-css vs tailwindcss-animate

Date: 2026-03-18

## Summary

Two npm packages exist for animation utilities in Tailwind CSS projects. `tailwindcss-animate` is the original v3-era JavaScript plugin by Jamie Builds. `tw-animate-css` is a pure CSS replacement built for Tailwind CSS v4's CSS-first architecture. shadcn/ui officially deprecated `tailwindcss-animate` in favor of `tw-animate-css` in March 2025. They are NOT 100% drop-in replacements — the class names are very similar but the integration mechanism is fundamentally different, and the author explicitly notes partial compatibility.

---

## Current Findings

### Package 1: tailwindcss-animate

**Source:** https://github.com/jamiebuilds/tailwindcss-animate
**Author:** Jamie Builds (jamiebuilds)
**Version:** 1.0.7 (last published, has not been updated for v4)
**Peer dependency:** `tailwindcss >= 3.0.0 || insiders` — does NOT include v4 explicitly

**Integration mechanism (Tailwind v3):**
```js
// tailwind.config.js
plugins: [
  require("tailwindcss-animate"),
]
```

**Integration mechanism (Tailwind v4 — workaround):**
```css
/* globals.css */
@plugin 'tailwindcss-animate';
```
Tailwind v4 supports loading legacy v3 JavaScript plugins via the `@plugin` CSS directive as a compatibility shim. This works but is not idiomatic v4 architecture.

**CSS custom properties (variables) it defines and uses:**
```css
/* Enter animation state variables */
--tw-enter-opacity
--tw-enter-scale
--tw-enter-rotate
--tw-enter-translate-x
--tw-enter-translate-y

/* Exit animation state variables */
--tw-exit-opacity
--tw-exit-scale
--tw-exit-rotate
--tw-exit-translate-x
--tw-exit-translate-y
```
Notable absence: no `--tw-enter-blur` or `--tw-exit-blur` variables.

**Class names provided:**
- Base: `animate-in`, `animate-out`
- Opacity: `fade-in`, `fade-in-{25|50|75}`, `fade-out`, `fade-out-{25|50|75}`
- Scale: `zoom-in`, `zoom-in-{50|75|95}`, `zoom-out`, `zoom-out-{50|75|95}`
- Rotate: `spin-in`, `spin-in-{1|6|75|90}`, `spin-out`, `spin-out-{1|6|75|90}`
- Translate: `slide-in-from-{top|bottom|left|right}-{48|72|96}`, `slide-out-to-{top|bottom|left|right}-{48|72|96}`
- Control: `duration-*`, `delay-*`, `ease-{linear|in|out|in-out}`, `running`, `paused`, `fill-mode-{none|forwards|backwards|both}`, `direction-{normal|reverse|alternate|alternate-reverse}`, `repeat-{0|1|infinite}`
- Accessibility: `motion-safe:`, `motion-reduce:`

**Does NOT include:** `blur-in`, `blur-out`, accordion/collapsible/caret-blink animations.

**Architecture:** Uses Tailwind's `addUtilities()` (static) and `matchUtilities()` (dynamic, responsive) plugin APIs. Generates CSS at build time via JavaScript. Uses `matchUtilities` for arbitrary value support.

---

### Package 2: tw-animate-css

**Source:** https://github.com/Wombosvideo/tw-animate-css
**Author:** Wombosvideo
**Version:** 1.4.0 (active development)
**Peer dependencies:** None — it is a plain CSS file, not a JavaScript plugin

**Integration mechanism (Tailwind v4):**
```css
/* globals.css */
@import "tw-animate-css";
```
This is idiomatic Tailwind v4 CSS-first architecture — import a CSS file directly, no JavaScript plugin system involved. Tailwind's bundler resolves the import from `node_modules`.

**CSS custom properties it defines:**

Uses `@property` declarations (modern CSS, non-inheriting):
```css
@property --tw-animation-delay { ... initial-value: 0s; }
@property --tw-animation-direction { ... initial-value: normal; }
@property --tw-animation-duration { ... }
@property --tw-animation-fill-mode { ... initial-value: none; }
@property --tw-animation-iteration-count { ... initial-value: 1; }

@property --tw-enter-blur { ... }
@property --tw-enter-opacity { ... }
@property --tw-enter-rotate { ... }
@property --tw-enter-scale { ... }
@property --tw-enter-translate-x { ... }
@property --tw-enter-translate-y { ... }

@property --tw-exit-blur { ... }
@property --tw-exit-opacity { ... }
@property --tw-exit-rotate { ... }
@property --tw-exit-scale { ... }
@property --tw-exit-translate-x { ... }
@property --tw-exit-translate-y { ... }
```

**Keyframes:**
- `enter` / `exit` — the core animation keyframes using the custom properties above
- `accordion-down` / `accordion-up` — uses `--radix-accordion-content-height`
- `collapsible-down` / `collapsible-up` — uses `--radix-collapsible-content-height`
- `caret-blink` — 1.25s opacity animation

**Class names provided (superset of tailwindcss-animate):**
- Base: `animate-in`, `animate-out`
- Opacity: `fade-in`, `fade-in-*`, `fade-out`, `fade-out-*`
- Scale: `zoom-in`, `zoom-in-*`, `zoom-out`, `zoom-out-*`
- Rotate: `spin-in`, `spin-in-*`, `spin-out`, `spin-out-*`
- Translate (directional): `in-from-top`, `in-from-bottom`, `in-from-left`, `in-from-right`, `in-from-start`, `in-from-end`, `out-to-top`, `out-to-bottom`, `out-to-left`, `out-to-right`, `out-to-start`, `out-to-end`
- Slide aliases: `slide-in-from-*`, `slide-out-to-*` (compatibility aliases)
- Blur: `blur-in`, `blur-in-*`, `blur-out`, `blur-out-*` (NEW — not in tailwindcss-animate)
- Control: `duration-*`, `delay-*`, `ease-*`, `running`, `paused`, `fill-mode-*`, `direction-*`, `repeat-*`, `play-state-*`
- Ready-to-use: `animate-accordion-down`, `animate-accordion-up`, `animate-collapsible-down`, `animate-collapsible-up`, `animate-caret-blink`

**Tree-shaking:** Because it's a CSS import consumed by Tailwind's bundler, unused classes are automatically excluded from the output CSS. The plugin does not inject everything unconditionally.

**Prefixed variant:** The package exports `./prefix` which provides `tw-animate-css` classes with a prefix to avoid conflicts.

---

## Key Differences

| Dimension | tailwindcss-animate | tw-animate-css |
|-----------|---------------------|----------------|
| **Type** | JavaScript Tailwind plugin | Pure CSS file |
| **Integration (v3)** | `plugins: [require(...)]` in `tailwind.config.js` | N/A |
| **Integration (v4)** | `@plugin 'tailwindcss-animate'` (legacy compat) | `@import "tw-animate-css"` (native) |
| **Peer deps** | `tailwindcss >= 3.0.0` | None |
| **Last version** | 1.0.7 (stale for v4) | 1.4.0 (active) |
| **Blur animations** | No | Yes (`blur-in`, `blur-out`) |
| **Accordion/collapsible** | No | Yes (built-in) |
| **Caret-blink** | No | Yes |
| **CSS `@property`** | No | Yes (non-inheriting vars) |
| **Logical directions** | No | Yes (`in-from-start`, `in-from-end`) |
| **Arbitrary values** | Via `matchUtilities()` | Via Tailwind's native `[value]` syntax |
| **shadcn/ui standard** | Deprecated (March 2025) | Current standard |

---

## shadcn/ui Standard

**Confidence: HIGH** — confirmed from official shadcn/ui documentation.

As of March 19, 2025, shadcn/ui officially deprecated `tailwindcss-animate` in favor of `tw-animate-css`.

Migration steps documented by shadcn/ui:
1. Uninstall `tailwindcss-animate`
2. Install `tw-animate-css`
3. In `globals.css`, remove `@plugin 'tailwindcss-animate'` and add `@import "tw-animate-css"`

New shadcn/ui projects initialized with the CLI automatically use `tw-animate-css`.

---

## Drop-in Replacement Compatibility

**They are NOT 100% drop-in replacements.** The author of `tw-animate-css` explicitly states: "I use only a small portion of the original plugin, so it might not be a 100% compatible drop-in replacement."

**Where they ARE compatible:**
- Core class names: `animate-in`, `animate-out`, `fade-in`, `fade-out`, `zoom-in`, `zoom-out`, `spin-in`, `spin-out` work identically
- `slide-in-from-*` and `slide-out-to-*` naming — tw-animate-css includes these as aliases for backward compatibility
- Same CSS custom property names: `--tw-enter-opacity`, `--tw-enter-scale`, `--tw-enter-rotate`, `--tw-enter-translate-x`, `--tw-enter-translate-y` (and exit equivalents)
- Control utilities: `duration-*`, `delay-*`, `ease-*`, `running`, `paused`, `fill-mode-*`, `direction-*`, `repeat-*`

**Where they DIFFER:**
- `tailwindcss-animate` uses numeric step values like `slide-in-from-top-48` (Tailwind spacing scale). `tw-animate-css` uses arbitrary values via Tailwind's `[value]` syntax natively.
- `tw-animate-css` adds `blur-in`/`blur-out`, accordion, collapsible, and caret-blink that `tailwindcss-animate` does not have.
- `tw-animate-css` adds logical direction variants (`in-from-start`, `in-from-end`).
- `tw-animate-css` uses CSS `@property` for non-inheriting custom properties, which affects browser inheritance behavior (though in practice this is rarely an issue for animation utilities).

---

## Tailwind CSS v4 Compatibility

**tailwindcss-animate with v4:**
- Works via `@plugin 'tailwindcss-animate'` in CSS (v4's compatibility shim for legacy plugins)
- The plugin's peer dependency spec (`>= 3.0.0 || insiders`) does not formally include v4
- No v4-specific updates have been published — the package appears unmaintained for v4
- The v3 JavaScript plugin API (`addUtilities`, `matchUtilities`) is still supported in v4 via the `@plugin` directive but is not the idiomatic approach

**tw-animate-css with v4:**
- Designed specifically for v4's CSS-first architecture
- `@import "tw-animate-css"` is idiomatic v4 usage
- Uses modern CSS features (`@property`, CSS cascade layers)
- Works natively with Tailwind v4's bundler and tree-shaking pipeline
- Does not require JavaScript config at all

---

## Breaking Changes When Migrating

When migrating from `tailwindcss-animate` to `tw-animate-css`:

**No changes needed for:**
- `animate-in`, `animate-out`
- `fade-in`, `fade-out`, `zoom-in`, `zoom-out`, `spin-in`, `spin-out`
- `duration-*`, `delay-*`, `ease-*`, `running`, `paused`
- `slide-in-from-{top|bottom|left|right}` and `slide-out-to-{top|bottom|left|right}` (aliases preserved)

**Potentially breaking:**
- Numeric step values (e.g., `slide-in-from-top-48`): these relied on Tailwind's spacing scale values being registered by the plugin. In tw-animate-css you use arbitrary values like `slide-in-from-top-[48px]`. If you were using `tailwindcss-animate`'s pre-registered step values, you'll need to switch to explicit units.
- If you used `zoom-in-50`, `zoom-in-75`, `zoom-in-95` etc. as named scales, verify equivalents exist or switch to arbitrary values.
- Any custom theme extensions for `tailwindcss-animate` scales in `tailwind.config.js` do not translate (since tw-animate-css has no JS config).

**Integration change (always required):**
- Remove `require("tailwindcss-animate")` from `tailwind.config.js` plugins array (v3) or `@plugin 'tailwindcss-animate'` from CSS (v4)
- Add `@import "tw-animate-css"` to your CSS entry point

---

## Key Takeaways

1. `tw-animate-css` is the current shadcn/ui standard as of March 2025 — use it for new Tailwind v4 projects.
2. `tailwindcss-animate` still works in v4 via the `@plugin` compatibility directive but is not maintained for v4 and has been deprecated by shadcn/ui.
3. Class name compatibility is very high for common usage patterns, but exact numeric step values (`fade-in-25`, `zoom-in-50`, `slide-in-from-top-48`) may need to be converted to arbitrary value syntax.
4. `tw-animate-css` adds blur animations, accordion/collapsible helpers, and caret-blink that `tailwindcss-animate` lacks — useful for shadcn/ui components.
5. The integration mechanism is fundamentally different: plugin vs. CSS import. This affects where in your config the dependency lives.
6. Neither package requires the other — they are mutually exclusive.

---

## Sources

- https://github.com/Wombosvideo/tw-animate-css (README and package.json — accessed 2026-03-18)
- https://github.com/jamiebuilds/tailwindcss-animate (README, package.json, index.js — accessed 2026-03-18)
- https://ui.shadcn.com/docs/tailwind-v4 (deprecation notice, March 2025 — accessed 2026-03-18)
- https://ui.shadcn.com/docs/installation/next (installation docs — accessed 2026-03-18)
- Direct source code inspection of tailwindcss-animate/index.js (CSS custom properties, plugin output structure)
- Direct source code inspection of tw-animate-css/src/tw-animate.css (@property declarations, keyframes, utility classes)
