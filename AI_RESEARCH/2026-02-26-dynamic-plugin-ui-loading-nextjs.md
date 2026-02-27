# Research: Dynamic Plugin UI Loading in Next.js 16 App Router Monorepo

Date: 2026-02-26

## Summary

Research into five approaches for dynamically loading plugin UI components (e.g., settings pages) in a Next.js 16 App Router pnpm monorepo where plugins exist as separate workspace packages. The core challenge: surface plugin-provided UI in an admin panel without statically bundling all plugin UI code when many plugins may be disabled.

## Context: This Codebase

- `apps/web` uses `transpilePackages: ['ui', 'database']` in `next.config.ts`
- Plugins live under `packages/plugins/*` (activity, context, delegation, discord, metrics, time, web)
- Plugin packages currently have NO UI — they are orchestrator-side Node.js only
- `PluginDefinition` type (in `packages/plugin-contract/src/index.ts`) has no UI field

---

## Approach 1: next/dynamic with Lazy Imports

### What It Is

`next/dynamic` is Next.js's wrapper around `React.lazy()` + `<Suspense>`. It defers the load of a Client Component to runtime, creating a separate JS chunk.

```tsx
// In a 'use client' component (required for code splitting to work)
const DiscordSettings = dynamic(() => import('@harness/plugin-discord/settings'))
const TimeSettings = dynamic(() => import('@harness/plugin-time/settings'))
```

### Does It Work with Next.js 16?

Yes, but with a critical constraint. Official docs (v16.1.6) state:

> "When a Server Component dynamically imports a Client Component, automatic code splitting is currently **not** supported."

Two open GitHub issues confirm this is still unresolved as of September 2025:
- [#61066](https://github.com/vercel/next.js/issues/61066): "Dynamic Import of Client Component from Server Component Not Code Split"
- [#54935](https://github.com/vercel/next.js/issues/54935): "Server side dynamic imports will not split client modules in multiple chunks"

**Code splitting DOES work** when `dynamic()` is called from inside a `'use client'` component — not from a Server Component.

### Bundle Size Implications

- If called from a Client Component wrapper with `'use client'`: each dynamic import gets its own lazy-loaded chunk — **code IS split**
- If called from a Server Component: all dynamically imported Client Components are included in the initial client bundle regardless of `Suspense` or conditional rendering — **code is NOT split**, defeating the purpose
- The workaround documented by the Next.js community: wrap the `dynamic()` calls in a `'use client'` component, never call `dynamic()` from a Server Component when the goal is code splitting

### Development Experience

Good. `next/dynamic` supports a `loading` fallback, `ssr: false` to skip SSR, and named exports via `.then(mod => mod.NamedExport)`. Standard React dev experience.

### Monorepo Implications

Plugin packages need to be added to `transpilePackages` in `next.config.ts` for Next.js to compile their TypeScript/JSX. Without this, the import fails because Next.js doesn't transpile `node_modules` by default, and workspace packages resolve through `node_modules`.

```ts
// next.config.ts
const nextConfig = {
  transpilePackages: ['ui', 'database', '@harness/plugin-discord', '@harness/plugin-time'],
};
```

`transpilePackages` causes Next.js to transpile the package, but only the modules actually imported (either statically or dynamically) are included in the bundle. Unused exports are tree-shaken out at the module graph level.

### Trade-offs

| Pro | Con |
|-----|-----|
| Native Next.js API, no extra tooling | Code splitting only works from Client Components |
| Suspense loading states built in | All listed `dynamic()` calls bundled even if plugin disabled at runtime |
| Good TypeScript support | Cannot truly exclude code for disabled plugins without build-time awareness |
| Simple mental model | Requires `transpilePackages` per plugin package |

**Key limitation for this use case:** "Disabled at runtime" does not mean "excluded from the bundle." If you write `dynamic(() => import('@harness/plugin-discord/settings'))` in a registry and the discord plugin is disabled in the DB, its code is still bundled. The UI is not rendered, but the JS ships to the browser.

---

## Approach 2: Module Federation (Webpack 5)

### What It Is

Webpack 5's Module Federation allows separately-built applications to expose and consume modules from each other at runtime. Each plugin would be built as its own MF remote, and the web app would load plugin UI on demand from those separate builds.

### Does It Work with Next.js 16?

**No.** The `@module-federation/nextjs-mf` package documentation explicitly states:

> "App Router Not Supported" and "Support for Next.js is ending"

The package only supports the Pages Router and Next.js versions 12-15. With Next.js 16 using Turbopack as the default bundler, Webpack 5 Module Federation is functionally incompatible with App Router.

The Rspack team (which provides a Webpack-compatible alternative) is in ongoing discussions with the Next.js team about improved support, but as of early 2026 there is no production-ready path.

**Additional complexity even if supported:**
- Requires each plugin package to be a separately deployed build artifact
- Significant DevOps overhead (separate CI, CDN hosting per plugin)
- Shared React version management (must ensure all remotes use the same React instance)
- SSR with Module Federation requires custom server configuration

### Trade-offs

| Pro | Con |
|-----|-----|
| True runtime isolation — disabled plugins are completely excluded | Not supported with App Router or Turbopack |
| Plugins can be updated independently | Requires separate build/deploy per plugin |
| Industry-proven (used in large micro-frontend systems) | Enormous complexity for a monorepo |
| | Breaks monorepo co-location model |

**Verdict: Not viable for this project.** Not supported by Next.js 16 App Router.

---

## Approach 3: Static Registry Pattern

### What It Is

A central file in `apps/web` imports all plugin settings components statically and maps plugin names to their components. The admin panel renders the appropriate component based on which plugins are enabled (queried from the DB at request time).

```tsx
// apps/web/src/app/(admin)/settings/_registry/plugin-settings-registry.ts
import { DiscordSettings } from '@harness/plugin-discord/settings';
import { TimeSettings } from '@harness/plugin-time/settings';
import type { ComponentType } from 'react';

export const PLUGIN_SETTINGS_REGISTRY: Record<string, ComponentType> = {
  discord: DiscordSettings,
  time: TimeSettings,
};
```

```tsx
// Then in the settings page (Server Component):
const enabledPlugins = await db.pluginConfig.findMany({ where: { enabled: true } });
return enabledPlugins.map(p => {
  const Component = PLUGIN_SETTINGS_REGISTRY[p.name];
  return Component ? <Component key={p.name} /> : null;
});
```

### Does It Work with Next.js 16?

Yes, fully. Server Components can import from workspace packages (with `transpilePackages`), render conditionally, and pass to Client Components.

### Bundle Size Implications

All statically imported plugin UI code is included in the bundle unconditionally. If 6 plugins are registered but 2 are enabled, 6 plugins' worth of UI ships to the browser.

However, for a **settings admin panel** specifically:
- Settings pages are rarely visited (admin-only, infrequent)
- Plugin UI components for settings are typically small (forms, toggles, API key inputs)
- The web app is already a server-rendered admin dashboard — initial page weight for an admin panel is a secondary concern vs. a public-facing page

Next.js's `optimizePackageImports` feature can help by transforming barrel imports to direct file imports, avoiding loading the entire plugin package for one export.

### How Strapi Does This

Strapi's Admin Panel API (v5) uses exactly this pattern. Plugins register via a `register(app)` lifecycle function that calls:
- `app.createSettingSection()` — adds a settings section
- `app.addSettingsLinks()` — adds specific settings routes with a `Component` prop

The components are static React imports provided at registration time. Strapi's admin panel is a single React SPA that bundles all registered plugin UI together at build time. There is no runtime dynamic loading — plugin code is included in the build if the plugin is installed.

### How Payload CMS Does This

Payload CMS v3 (the closest analog to this project — it also runs inside Next.js App Router) uses a configuration-driven static approach:
- Plugins extend the `payload.config.ts` with UI components passed as React component references
- These are statically imported by the app at build time
- Custom admin components are React Server Components by default (Next.js native)
- There is no runtime dynamic plugin discovery — all plugins must be declared in config at build time

### Trade-offs

| Pro | Con |
|-----|-----|
| Simple, zero special tooling | All registered plugin UI bundled regardless of enabled state |
| Full TypeScript inference | Adding a plugin requires touching the registry file |
| Works perfectly with App Router + RSC | Not truly "dynamic" — build-time coupling |
| Easy to test | |
| Matches how Strapi and Payload actually work | |

---

## Approach 4: React Server Components Dynamic Loading

### What It Is

Using RSC-specific patterns: Server Components fetch DB state and conditionally import plugin components using dynamic `import()` inside an `async` Server Component.

```tsx
// Server Component — true async dynamic import
const SettingsPage = async () => {
  const enabledPlugins = await db.pluginConfig.findMany({ where: { enabled: true } });

  const components = await Promise.all(
    enabledPlugins.map(async (plugin) => {
      try {
        const mod = await import(`@harness/plugin-${plugin.name}/settings`);
        return { name: plugin.name, Component: mod.default };
      } catch {
        return null;
      }
    })
  );

  return components.filter(Boolean).map(({ name, Component }) => (
    <Component key={name} />
  ));
};
```

### Does It Work with Next.js 16?

Partially, with significant caveats:

1. **Dynamic string template imports are problematic.** Webpack/Turbopack must be able to statically analyze import paths at build time to create chunks. Template literal imports like `` import(`@harness/plugin-${name}/settings`) `` either fail entirely or force Webpack to include ALL matching modules in the bundle (the "dynamic require context" problem).

2. **Static import() inside Server Components works for Server Component children.** If the imported module is a Server Component, no client bundle impact — it's all server-side. But plugin settings forms likely need `'use client'` for interactivity.

3. **For Client Components: the same code-splitting issue from Approach 1 applies.** Dynamically importing Client Components from Server Components does not result in code splitting — they're pulled into the initial client bundle.

4. **The `next/dynamic` docs note:** "`ssr: false` option is not supported in Server Components."

### RSC-Specific Pattern That Does Work

Server Components **are** automatically code-split from each other. If a Server Component imports another Server Component (which only does server-side work like DB queries and renders HTML), that RSC is handled by the server and sends only HTML to the client. This is relevant if plugin settings pages were pure RSC (server-rendered forms submitted via Server Actions) — in that case there is zero client-side bundle impact.

```tsx
// If DiscordSettings were a pure RSC (no 'use client'):
const DiscordSettings = async () => {
  const config = await db.pluginConfig.findUnique({ where: { name: 'discord' } });
  return <form action={saveDiscordConfig}>{/* fields */}</form>;
};
```

This is viable for simple settings forms using Server Actions.

### Trade-offs

| Pro | Con |
|-----|-----|
| Zero client bundle for pure RSC settings components | Dynamic string imports not statically analyzable |
| Server Actions eliminate client state for forms | Client interactivity (validation, previews) requires 'use client' |
| Genuinely conditional loading based on DB state | Complex mental model mixing static/dynamic import semantics |
| | Template literal imports break bundler static analysis |

---

## Approach 5: How Existing Plugin Systems Handle This

### Strapi v5

**Pattern: Static registration SPA.** Plugins provide an `admin/` folder with React components. The Strapi admin build concatenates all installed plugin admin folders into a single SPA at build time. Plugins call `app.createSettingSection()` in their `register(app)` lifecycle with a direct `Component` reference. No dynamic loading — everything is bundled together.

**Key takeaway:** Strapi does not attempt true runtime dynamic loading. The entire admin SPA bundles all plugin UI.

### Payload CMS v3

**Pattern: Config-as-code, static imports.** Plugin developers pass React components (either RSC or Client Components) directly as config properties. Payload uses Next.js App Router natively, making these RSCs by default. Plugin UI code is statically imported at build time. Payload's philosophy: "you install the plugin, it's in your build."

**Key takeaway:** Payload (the closest system to this project) uses static imports. RSC support means server-only plugin UI has zero client bundle impact.

### Grafana

**Pattern: SystemJS runtime loader with plugin.json manifests.** Each Grafana plugin is a separately-built and separately-hosted artifact. Grafana's backend registers enabled plugins and serves their metadata via `/api/frontend/settings`. The browser receives the list of enabled plugins and uses SystemJS (a runtime ES module loader) to lazily fetch each plugin's `module.js` from a CDN.

**Key takeaway:** This is the most isolated approach but requires each plugin to be an independently deployable build artifact — fundamentally incompatible with the monorepo co-location model. Grafana is actively evaluating moving from SystemJS to Webpack Module Federation (which itself is incompatible with Next.js App Router).

### Grouparoo (Next.js Plugin System)

**Pattern: Build-time shim registry.** Before building, a script scans installed plugins and generates "shim" files in a `tmp/plugins/` directory — one shim per plugin page. Each shim statically imports from the actual plugin. Next.js then compiles these shims with full code-splitting support. The result: only installed plugins get shims, only installed plugin UI is in the build.

**Key takeaway:** This is the only approach that gives true build-time conditional inclusion without runtime module loading complexity. But it requires a code generation step before `next build`, and the "conditional" aspect is installation-based (which package is in node_modules), not DB-configuration-based.

---

## Synthesis and Recommendation

### For This Specific Use Case (Admin Settings Panel, DB-Enabled Plugins)

The fundamental tension: the plugin enable/disable state is **runtime** (stored in the DB), but bundlers need to make code-inclusion decisions at **build time**. No Next.js 16 App Router approach cleanly bridges this gap without either accepting some bundled-but-unused code OR accepting significant architectural complexity.

### Recommended Approach: Static Registry + next/dynamic from Client Wrapper

The combination that best fits this monorepo:

1. **Static registry file** (`apps/web/src/app/(admin)/settings/_registry/index.ts`) maps plugin names to component factories using `next/dynamic` inside a `'use client'` wrapper component.

2. **Client wrapper component** does the dynamic dispatch (because `dynamic()` must be called from a Client Component for code splitting to work):

```tsx
// apps/web/src/app/(admin)/settings/_components/plugin-settings-panel.tsx
'use client';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

const REGISTRY: Record<string, () => Promise<{ default: ComponentType }>> = {
  discord: () => import('@harness/plugin-discord/settings'),
  time: () => import('@harness/plugin-time/settings'),
  // Add each plugin here when it gains UI
};

export const PluginSettingsPanel = ({ pluginName }: { pluginName: string }) => {
  const loader = REGISTRY[pluginName];
  if (!loader) return null;
  const Component = dynamic(loader);
  return <Component />;
};
```

3. **Server Component** queries enabled plugins from DB, renders `<PluginSettingsPanel name={plugin.name} />` for each.

**Why this over alternatives:**
- Module Federation: incompatible with App Router/Turbopack
- Pure RSC dynamic imports with template literals: break static analysis
- Grafana-style SystemJS: requires separate plugin build/deploy artifacts
- Grouparoo shims: overcomplicated for a small set of well-known plugins

**Bundle size reality check for this project:** Plugin settings components are small (forms, toggles, config fields). Admin settings pages are visited infrequently by a small number of users. Even if disabled plugins' UI is included in the bundle, the practical impact is negligible for an internal admin panel. The Strapi/Payload approach (pure static imports, no dynamic loading) is simpler and equally appropriate.

### Simplest Viable Approach: Pure Static Registry (No dynamic())

If bundle size for the admin panel is not a primary concern (it rarely is for internal tooling):

```tsx
// apps/web/src/app/(admin)/settings/_registry/index.ts
// NO 'use client' — this file just re-exports
export { DiscordSettings } from '@harness/plugin-discord/settings';
export { TimeSettings } from '@harness/plugin-time/settings';

// In the settings page (Server Component):
const REGISTRY = {
  discord: DiscordSettings,
  time: TimeSettings,
};
```

This is what Strapi and Payload both do. It is the lowest-complexity solution and works perfectly with Next.js 16.

### If True Isolation Is a Hard Requirement

Only Grafana-style separate builds + SystemJS/importmap achieve true runtime-conditional loading. This is not compatible with the monorepo architecture and requires a significant infrastructure investment. Not recommended here.

---

## Key Takeaways for Implementation

1. **Plugin packages must be in `transpilePackages`** in `next.config.ts` for Next.js to compile them. Each plugin added to the web's registry needs a new entry.

2. **`dynamic()` must be called from a `'use client'` component** for code splitting to work. Calling it from a Server Component includes the code in the initial bundle regardless.

3. **Pure RSC settings components** (forms submitted via Server Actions, no client interactivity) have zero client bundle impact and are the cleanest approach if plugin UIs can be implemented that way.

4. **The DB-enabled/disabled state cannot exclude code from the bundle** at request time. The bundler runs at build time. The best you can achieve is: code ships in a lazy chunk and is never loaded by the browser unless triggered — but it's still in the manifest.

5. **Adding plugin UI requires code changes to `apps/web`** (registry file + `transpilePackages`) under any of these approaches. There is no zero-touch plugin UI registration without Module Federation or SystemJS — both of which are incompatible or extremely complex.

6. **PluginDefinition type does not currently have a UI field.** A new convention would need to be established separately from the orchestrator plugin contract (which is server-side only).

---

## Sources

- [Next.js Lazy Loading Official Docs (v16.1.6)](https://nextjs.org/docs/app/guides/lazy-loading)
- [Next.js transpilePackages Docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)
- [GitHub Issue #61066: Dynamic Import of Client Component from Server Component Not Code Split](https://github.com/vercel/next.js/issues/61066)
- [GitHub Issue #54935: Server side dynamic imports will not split client modules in multiple chunks](https://github.com/vercel/next.js/issues/54935)
- [Module Federation Next.js Guide — App Router Not Supported](https://module-federation.io/guide/framework/nextjs.html)
- [Strapi v5 Admin Panel API Docs](https://docs.strapi.io/cms/plugins-development/admin-panel-api)
- [Grafana Plugin System — DeepWiki](https://deepwiki.com/grafana/grafana/11-plugin-system)
- [Grafana Plugin Anatomy](https://grafana.com/developers/plugin-tools/key-concepts/anatomy-of-a-plugin)
- [Grouparoo Next.js Plugin System](https://www.grouparoo.com/blog/nextjs-plugins)
- [Vercel: How We Optimized Package Imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
- [Demystifying RSC: next/dynamic](https://demystifying-rsc.vercel.app/client-components/next-dynamic/)
- [Payload CMS v3 Custom Components Docs](https://payloadcms.com/docs/admin/components)
