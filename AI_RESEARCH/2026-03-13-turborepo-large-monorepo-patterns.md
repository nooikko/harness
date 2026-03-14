# Research: Turborepo Large Monorepo Patterns — Many Packages & Plugin Systems

Date: 2026-03-13

## Summary

Research into how large TypeScript monorepos handle 10–20+ tightly-coupled internal packages, with emphasis on Turborepo official guidance, real-world examples (Payload CMS, Next.js itself, T3 Turbo, TanStack), and the fundamental Just-in-Time vs. Compiled package tradeoff. The Turborepo maintainers explicitly acknowledge that performance impact comes from the tools running inside packages, not from Turborepo itself — and that JIT packages shift compilation burden to consuming applications, which degrades at scale.

## Prior Research

No directly related prior research found in AI_RESEARCH/.

---

## Current Findings

### 1. Turborepo's Three Package Compilation Strategies

Source: https://turborepo.dev/docs/core-concepts/internal-packages (PRIMARY — official Turborepo docs)

Turborepo recognizes three compilation strategies for internal library packages:

**Just-in-Time (JIT) Packages**
- Export raw TypeScript source files with no build step
- `package.json` `main`/`types` fields point directly to `.ts` source (e.g., `./src/index.ts`)
- The consuming application's bundler (Next.js/Turbopack, Vite, webpack) transpiles at app-build time
- Turborepo cannot cache a JIT package because it has no build step
- Cannot use TypeScript `paths` configuration inside the package
- Best for: small repos where simplicity matters more than cache efficiency

**Compiled Packages**
- Handle their own compilation via `tsc` (not bundlers — bundlers add unnecessary complexity)
- Emit compiled JS + `.d.ts` to a `dist/` directory
- Turborepo can cache the `dist/` output — subsequent builds that haven't changed are instant
- Best for: repos where Turborepo caching pays off, or where consumers can't transpile TS
- Requires more configuration but enables incremental build savings

**Publishable Packages**
- Strictest requirements; for npm distribution
- Out of scope for internal plugin systems

**Performance warning from official docs (direct quote):**
> "Adding more internal packages is identical to adding more source code to that consuming application, which can result in slower builds of the consuming application (as there is just more work to do) but potentially faster (and less complicated) overall build time. When/if overall build time begins to suffer, you might decide to convert your larger internal packages back into 'regular' packages with .d.ts files and with normal TypeScript build steps."

Source: https://turborepo.dev/docs/core-concepts/internal-packages

### 2. Official Turborepo Guidance: "When to Merge vs. Keep Separate"

Source: https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package (PRIMARY)
Source: https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository (PRIMARY)

**Official recommendation:** Design packages around **one specific purpose**. The docs explicitly call this "not a strict science or rule" but cite two benefits:
1. **Discoverability** — developers find what they need in a scaled repo
2. **Dependency pruning** — fewer deps per package lets Turborepo prune the package graph more effectively

**On package count:** The official docs do not specify a maximum or optimal package count. The only structural constraint is: avoid deeply nested `packages/**/**` layouts (Turborepo doesn't support them; use flat patterns like `packages/group/*` instead).

**Turborepo maintainer stance on package count vs. performance** (GitHub Discussion #6347):
Source: https://github.com/vercel/turborepo/discussions/6347 (PRIMARY — official repo)

A team with ~20 packages asked if Turborepo could handle 100+ packages. Maintainer **Anthony Shew** responded:
- Turborepo's own overhead is "likely not even 1% of resource usage"
- The performance burden comes from the **tools running within packages** (TypeScript compiler, webpack, etc.), not Turborepo
- Recommended mitigation: use `--filter` to run only the package graph needed for current work
- Recommended alternative: use the Internal Package pattern so frameworks handle compilation instead of running separate `dev` tasks per package
- No benchmarks were provided; maintainers stated variability made standardized recommendations impossible

### 3. JIT Packages and Node.js Servers — Known Limitation

Source: https://github.com/vercel/turborepo/discussions/4509 (PRIMARY — official repo discussion)

The JIT pattern works well with frontend frameworks (Next.js, Vite) that understand TypeScript natively. For **Node.js server applications**, production builds require additional steps because the Node.js runtime cannot consume raw TypeScript.

Community-tested solutions (none are perfect):
- `tsup` with `noExternal` to inline internal packages at bundle time
- `publishConfig` field to swap compiled paths only in production
- Package `exports` field with conditional production/default keys
- `tsc-alias` post-compilation path remapping

The official maintainer response was to update documentation rather than provide a built-in solution.

**Relevance to Harness:** The orchestrator is a Node.js server. The 14 plugin packages in `packages/plugins/` that are consumed by `apps/orchestrator` would face this JIT limitation if not compiled.

### 4. TypeScript Project References vs. Internal Packages

Source: https://turborepo.dev/blog/you-might-not-need-typescript-project-references (PRIMARY — official Turborepo blog)
Source: https://github.com/0x80/mono-ts (SECONDARY — well-documented community implementation)

**Official Turborepo position (Jared Palmer):**
> "Once you add references to your project you now need to continuously update them whenever you add or remove packages. That kinda blows."

The JIT internal package pattern is proposed as the alternative to project references. Two rules apply:
1. The consuming app must transpile and typecheck the internal package
2. Never publish internal packages to npm

**When the recommendation shifts:** Palmer explicitly states that as repos grow and build times suffer, you "might decide to convert your larger internal packages back into 'regular' packages with `.d.ts` files and with normal TypeScript build steps."

**Community counter-approach (0x80/mono-ts):**
A hybrid approach that uses `tsdown` bundler for compilation plus TypeScript project references for IDE support only, with Turborepo managing build ordering. Solves:
- IDE navigation goes to source `.ts` files, not compiled output
- No `tsbuildinfo` files cluttering the repo
- Turborepo caches compiled artifacts
Source: https://github.com/0x80/mono-ts

### 5. Real-World Example: Payload CMS (44 packages, plugin system)

Source: https://github.com/payloadcms/payload/tree/main/packages (PRIMARY — official repo)

Payload CMS is the clearest real-world analog to Harness's plugin architecture. It has **44 packages** organized into:

| Category | Count | Examples |
|---|---|---|
| Core | 1 | `payload` |
| Framework integration | 2 | `next`, `admin-bar` |
| Database adapters | 5 | `db-postgres`, `db-mongodb`, `db-sqlite`, `db-d1-sqlite`, `db-vercel-postgres` |
| Storage adapters | 6 | `storage-s3`, `storage-azure`, `storage-gcs`, `storage-r2`, etc. |
| Plugins | 13 | `plugin-seo`, `plugin-search`, `plugin-form-builder`, `plugin-stripe`, etc. |
| Rich text editors | 2 | `richtext-lexical`, `richtext-slate` |
| Live preview | 3 | `live-preview`, `live-preview-react`, `live-preview-vue` |
| Email adapters | 2 | `email-nodemailer`, `email-resend` |
| Developer tools | 8 | `sdk`, `graphql`, `eslint-config`, `typescript-plugin`, etc. |
| Utilities | 2 | `create-payload-app`, `ui` |

Key pattern: Payload separates adapter types into distinct packages. Each plugin is its own package. This mirrors the Harness plugin pattern at significantly larger scale.

### 6. Real-World Example: Vercel's Next.js (19 packages)

Source: https://github.com/vercel/next.js/tree/canary/packages (PRIMARY — official repo)

Next.js itself has **19 packages** in its monorepo:
- Core: `next`, `next-swc` (Rust/WASM), `react-refresh-utils`
- Tooling: `eslint-config-next`, `eslint-plugin-next`, `eslint-plugin-internal`
- CLI: `create-next-app`, `next-codemod`
- Integrations: `next-bundle-analyzer`, `next-mdx`, `next-playwright`, `next-plugin-storybook`, `next-rspack`
- Polyfills: `next-polyfill-module`, `next-polyfill-nomodule`
- Misc: `font`, `next-routing`, `next-env`, `third-parties`

Notable: Next.js does NOT use Turborepo for its own build — it uses a custom build system. This means the Next.js repo is not a direct Turborepo pattern guide.

### 7. Real-World Example: T3 Turbo (8 packages, official Turborepo template)

Source: https://github.com/t3-oss/create-t3-turbo (SECONDARY — widely-referenced community template)
Source: https://turbo.t3.gg/ (SECONDARY)

T3 Turbo is the most widely referenced real-world Turborepo template for full-stack TypeScript:
- `@acme/api` — tRPC router (dev-only in clients, preventing backend code leakage)
- `@acme/auth` — Better Auth
- `@acme/db` — Drizzle ORM
- `@acme/ui` — shadcn-ui components
- `@acme/eslint`, `@acme/prettier`, `@acme/tailwind`, `@acme/typescript` — tooling configs

Pattern: The `@acme/api` package is a **dev dependency only** in client apps — TypeScript types are erased at build time, so clients get full type safety without bundling server code. This is the tRPC monorepo best practice.

### 8. Real-World Example: TanStack (Nx-based, not Turborepo)

Source: https://tanstack.com/config/latest/docs/package-structure (PRIMARY)
Source: https://deepwiki.com/TanStack/config/2.1-monorepo-setup (TERTIARY)

TanStack (Query, Router, Table, etc.) uses **Nx**, not Turborepo. Build characteristics:
- All packages have `"type": "module"` (ESM-first)
- Uses Vite for building with dual ESM/CJS output
- Nx manages task orchestration and caching
- TypeScript composite project setup for incremental builds

Not directly applicable as a Turborepo pattern, but demonstrates that large plugin-style ecosystems (TanStack has 10+ packages) use compiled output with dual ESM/CJS.

### 9. shadcn/ui Monorepo Pattern

Source: https://ui.shadcn.com/docs/monorepo (PRIMARY — official shadcn docs)
Source: https://turborepo.dev/docs/guides/tools/shadcn-ui (PRIMARY)

shadcn/ui's monorepo is deliberately minimal — only 2 workspaces by default:
- `apps/web` — consuming application
- `packages/ui` — shared component library (`@workspace/ui`)

The `packages/ui` package is a JIT package — imports are direct from source (e.g., `@workspace/ui/components/button`). The CLI handles path configuration automatically.

This is a small-scale pattern and doesn't demonstrate multi-package plugin systems.

### 10. Turborepo Official Examples Repository

Source: https://github.com/vercel/turborepo/tree/main/examples (PRIMARY)
Source: https://turborepo.dev/docs/getting-started/examples (PRIMARY)

28 official examples exist. None specifically demonstrate a plugin system architecture with 10+ tightly-coupled packages. Most relevant to this research:
- `basic` — foundational setup (apps + packages)
- `design-system` — shared component library across apps
- `kitchen-sink` — comprehensive feature showcase
- `with-microfrontends` — module federation (most complex package graph)
- `with-prisma` — DB package pattern

No example exists for: plugin registry pattern, many-plugin-package monorepo, or Node.js server with many internal packages.

### 11. Performance Issue at 43 Packages

Source: https://github.com/vercel/turborepo/issues/8801 (PRIMARY — official issue tracker)

One confirmed performance report at 43 packages. Root cause was **Turborepo's TUI (Terminal User Interface)** triggering macOS XProtectService on first builds. Resolution: disable the TUI via `"ui": "tui"` removal from `turbo.json`. This was a macOS-specific issue, not a fundamental Turborepo scaling limitation.

No maintainer fix was shipped; the issue was user-resolved.

---

## Key Takeaways

### For a Harness-like system (14+ plugin packages, Node.js orchestrator)

1. **JIT packages are problematic for Node.js server consumers.** Since `apps/orchestrator` is a Node.js process (not a browser bundler), JIT packages would require bundling plugins into the orchestrator at build time. The community workaround is `tsup` with `noExternal`, but this defeats the independent-package caching benefit.

2. **Compiled packages (tsc to dist/) are the correct choice.** Each plugin compiles independently; Turborepo caches the `dist/` output; the orchestrator imports from compiled JS. This matches how Payload CMS structures its 13 plugin packages.

3. **14 packages is not a performance concern for Turborepo itself.** The overhead is under 1% per official guidance. The performance concern is TypeScript compilation time across all packages, which is mitigated by Turborepo's caching — once compiled, unchanged packages don't recompile.

4. **`--filter` is the development ergonomics escape hatch.** When working on a single plugin, `pnpm --filter @harness/plugin-identity dev` avoids compiling all other packages.

5. **No official guidance exists on "when to merge."** The Turborepo team's position is: one purpose per package, use `--filter` for development, accept that overall build time grows linearly with package count.

6. **Payload CMS (44 packages, 13 plugins) is the closest real-world analog.** Their pattern: each plugin is a compiled package with its own `package.json`, separate npm-publishable, consumed by the core package. Each adapter (db, storage, email) follows the same pattern.

7. **The hybrid approach (tsdown/tsup + project references for IDE)** from 0x80/mono-ts solves the developer experience friction: IDE navigation goes to source, not compiled output, while Turborepo caches the compiled artifact.

### What Vercel's own tooling reveals

Vercel does not appear to use Turborepo internally for the Next.js codebase itself. Next.js has its own custom build system. The inference is that Turborepo is positioned for application-layer monorepos, not framework development.

---

## Gaps Identified

- No official Turborepo benchmarks for TypeScript compilation time across N packages
- Vercel's internal monorepo structure (beyond public repos) is not publicly documented
- No official Turborepo example for a plugin-registry pattern with 10+ plugin packages
- TanStack's detailed build pipeline is documented only in community sources (DeepWiki)

---

## Sources

| Source | Type | URL |
|---|---|---|
| Turborepo: Internal Packages | PRIMARY | https://turborepo.dev/docs/core-concepts/internal-packages |
| Turborepo: Package Types | PRIMARY | https://turborepo.dev/docs/core-concepts/package-types |
| Turborepo: Creating an Internal Package | PRIMARY | https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package |
| Turborepo: Structuring a Repository | PRIMARY | https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository |
| Turborepo blog: You might not need TS project references | PRIMARY | https://turborepo.dev/blog/you-might-not-need-typescript-project-references |
| Turborepo: Getting Started / Examples | PRIMARY | https://turborepo.dev/docs/getting-started/examples |
| Turborepo GitHub Examples | PRIMARY | https://github.com/vercel/turborepo/tree/main/examples |
| GitHub Discussion #6347: Package count vs performance | PRIMARY | https://github.com/vercel/turborepo/discussions/6347 |
| GitHub Discussion #4509: Internal packages in Node.js server | PRIMARY | https://github.com/vercel/turborepo/discussions/4509 |
| GitHub Issue #8801: Slow at 43 packages | PRIMARY | https://github.com/vercel/turborepo/issues/8801 |
| Payload CMS packages directory | PRIMARY | https://github.com/payloadcms/payload/tree/main/packages |
| Next.js packages directory (canary) | PRIMARY | https://github.com/vercel/next.js/tree/canary/packages |
| T3 Turbo (create-t3-turbo) | SECONDARY | https://github.com/t3-oss/create-t3-turbo |
| shadcn/ui monorepo docs | PRIMARY | https://ui.shadcn.com/docs/monorepo |
| Turborepo shadcn/ui guide | PRIMARY | https://turborepo.dev/docs/guides/tools/shadcn-ui |
| TanStack Config: Package Structure | PRIMARY | https://tanstack.com/config/latest/docs/package-structure |
| 0x80/mono-ts (TypeScript monorepo quest) | SECONDARY | https://github.com/0x80/mono-ts |
