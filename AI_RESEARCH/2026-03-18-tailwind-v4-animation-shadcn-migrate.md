# Research: Tailwind CSS v4 Animation — shadcn/ui Migration from tailwindcss-animate to tw-animate-css
Date: 2026-03-18

## Summary

shadcn/ui has officially deprecated `tailwindcss-animate` in favor of `tw-animate-css` for Tailwind CSS v4. The switch is from a JavaScript plugin loaded via `@plugin` to a pure CSS file loaded via `@import`. This is confirmed by shadcn/ui's own v4 globals.css and their migration documentation published February 2025.

## Prior Research
None — first research on this topic.

## Current Findings

### 1. shadcn/ui Official Position: tw-animate-css (Confidence: HIGH)

shadcn/ui published a Tailwind v4 migration guide in February 2025 and updated all components. Their v4 demo app (`apps/v4/styles/globals.css` on GitHub main branch) uses:

```css
@import "tailwindcss";
@import "tw-animate-css";
```

There is NO `@plugin 'tailwindcss-animate'` in their v4 configuration. The migration guide explicitly states:

> "We've deprecated `tailwindcss-animate` in favor of `tw-animate-css`."

**New projects** created with the shadcn/ui CLI get `tw-animate-css` by default.
**Existing projects** must manually swap the `@plugin` directive for an `@import`.

Migration steps per official docs:
1. Remove `@plugin 'tailwindcss-animate';` from globals.css
2. `npm install tw-animate-css --save-dev`
3. Add `@import "tw-animate-css";` to globals.css

Source: `https://ui.shadcn.com/docs/tailwind-v4` and `https://github.com/shadcn-ui/ui/blob/main/apps/v4/styles/globals.css`

### 2. Does tailwindcss-animate v1.0.7 Work with Tailwind v4? (Confidence: MEDIUM)

**Technically loadable via @plugin, but officially deprecated and effectively unmaintained.**

Key facts:
- `tailwindcss-animate` peer dep: `"tailwindcss": ">=3.0.0 || insiders"` — does NOT explicitly declare v4 support
- Last commit: **August 28, 2023** (v1.0.7) — project is effectively abandoned, no v4 compatibility work done
- The plugin uses the standard Tailwind `plugin()` API (`require("tailwindcss/plugin")`), which IS loadable via Tailwind v4's `@plugin` directive

**Tailwind v4's `@plugin` directive:** Tailwind v4 includes a `@plugin` compatibility shim specifically for loading v3-era JavaScript plugins. Per official Tailwind docs:

> "Use the `@plugin` directive to load a legacy JavaScript-based plugin."

So `@plugin 'tailwindcss-animate'` would technically load and work in v4 — the plugin API it uses (`addUtilities`, `matchUtilities`, `theme`) is supported by the compat layer. However:
- It's documented as a **legacy compatibility mechanism**, not the recommended approach
- CSS-first definitions via `@utility`, `@theme`, `@variant` are the v4 way
- shadcn/ui explicitly moved away from it

**Bottom line:** `@plugin 'tailwindcss-animate'` will likely work in v4 through the compatibility shim, but it's the wrong path forward. `tw-animate-css` is the correct replacement.

Source: `https://tailwindcss.com/docs/functions-and-directives` (functions-and-directives#plugin section)

### 3. What is tw-animate-css? (Confidence: HIGH — inferred from shadcn docs)

`tw-animate-css` is a **pure CSS file** (not a JavaScript plugin) that provides the same animation utility classes as `tailwindcss-animate`. Because it's plain CSS, it integrates with Tailwind v4 via `@import` rather than `@plugin` — no JavaScript plugin API required, no compatibility layer needed.

This aligns with Tailwind v4's CSS-first philosophy where configuration and extensions live in CSS, not JavaScript config files.

The package is installed as a dev dependency and imported in globals.css:
```css
@import "tw-animate-css";
```

Note: Direct npm page returned 403 during research. Package existence is confirmed by shadcn/ui official documentation and their v4 source code.

### 4. Tailwind v4 @plugin Directive — Full Picture (Confidence: HIGH)

Tailwind v4 does support JavaScript plugins via `@plugin`, but frames it explicitly as a **legacy compatibility mechanism**:

- `@plugin "package-name"` — loads a v3-era JS plugin
- Accepts package names or local paths
- Designed for **incremental migration** from JS config to CSS-based config
- CSS-defined features take precedence over plugin-defined ones when conflicts exist
- NOT the recommended pattern for new v4 projects

The v4 idiomatic equivalents:
| v3 JS Plugin concept | v4 CSS equivalent |
|---------------------|-------------------|
| `addUtilities()` | `@utility` directive |
| `theme.extend` | `@theme` directive |
| `addVariant()` | `@variant` / `@custom-variant` |

Source: `https://tailwindcss.com/docs/functions-and-directives`

## Key Takeaways

1. **Use `tw-animate-css`, not `tailwindcss-animate`** — this is shadcn/ui's official position as of February 2025
2. **The migration is trivial**: swap `@plugin 'tailwindcss-animate'` for `@import "tw-animate-css"` and install the package
3. **`tailwindcss-animate` is abandoned** — last commit August 2023, no v4 work, peer dep only covers `>=3.0.0`
4. **`@plugin` does work in v4** for legacy JS plugins, but it's the wrong direction — `tw-animate-css` avoids the JS plugin system entirely
5. **New shadcn/ui installations** get `tw-animate-css` automatically

## Sources
- `https://ui.shadcn.com/docs/tailwind-v4` — shadcn/ui Tailwind v4 migration guide
- `https://github.com/shadcn-ui/ui/blob/main/apps/v4/styles/globals.css` — shadcn/ui v4 globals.css (primary source, confirms @import "tw-animate-css")
- `https://tailwindcss.com/docs/functions-and-directives` — @plugin directive documentation
- `https://github.com/jamiebuilds/tailwindcss-animate` — tailwindcss-animate repo (last commit: 2023-08-28)
- `https://github.com/jamiebuilds/tailwindcss-animate/blob/main/package.json` — peer dep: `tailwindcss >= 3.0.0 || insiders`
