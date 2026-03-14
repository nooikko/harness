# Plugin Package Consolidation Plan

## Problem Statement

The harness monorepo has 16 plugin packages under `packages/plugins/*/`, each configured as a **compiled package** with its own `tsup` build step. This means Turbo's task graph has 25 build tasks (17 are plugins), and every `turbo build`, `turbo typecheck`, `turbo lint`, and `turbo test` must traverse all of them. While Turbo handles this functionally, the overhead is real:

- **Cold build overhead**: Even with `concurrency: 30`, each plugin invokes `tsup` separately — 16 process spawns for tiny packages
- **Developer friction**: Adding a new plugin requires creating a full package (package.json, tsconfig.json, tsup config, vitest.config.ts, workspace reference in orchestrator)
- **Cache invalidation blast radius**: Changing `plugin-contract` invalidates all 16 plugin builds simultaneously anyway
- **No publishing benefit**: All plugins are `private: true` — the main advantage of separate packages (independent versioning/publishing) doesn't apply. Payload CMS keeps plugins separate because they publish to npm individually; we don't.

Note: Turborepo maintainers confirm task graph overhead at 16+ packages is under 1% ([Discussion #6347](https://github.com/vercel/turborepo/discussions/6347)). The real cost is the 16 redundant `tsup` process spawns, not Turbo's graph traversal.

## Research Findings

### Turborepo's Three Package Strategies

Per [official Turborepo docs](https://turborepo.dev/docs/core-concepts/internal-packages):

| Strategy | Build Step | Cacheable | Config Complexity |
|----------|-----------|-----------|-------------------|
| **Just-in-Time** | None (consumer compiles) | No build to cache | Minimal |
| **Compiled** | Own build (tsup/tsc) | Yes | Moderate |
| **Publishable** | Own build + publish config | Yes | Maximum |

**Current state**: All 16 plugins use the **Compiled** strategy (tsup → dist/).

**Key insight**: These plugins are `private: true`, consumed only by the orchestrator (a Node.js app that runs via `tsx watch` in dev and `tsc` for prod build). They are never published to npm. The compiled strategy gives us caching but costs us 16 separate build processes.

### The "Just-in-Time" Option (NOT recommended for us)

Just-in-Time packages export raw `.ts` files and let the consumer's bundler compile them. This works great for Next.js apps (which have a bundler), but our primary consumer is the **orchestrator** — a plain Node.js app that uses `tsc` for production builds. `tsc` doesn't handle external package compilation the way a bundler does; it expects resolved JavaScript or declaration files from dependencies.

**Verdict**: JIT is designed for bundler-based consumers (Next.js, Vite). Our orchestrator uses `tsc` → Node.js directly. JIT would require fundamentally changing how the orchestrator builds.

### Recommended Approach: Consolidate Into a Single `@harness/plugins` Package

The best-of-both-worlds solution is to **merge all 16 plugin directories into a single package** while keeping them logically separated as subdirectories.

**Why this works:**
1. **One build task** instead of 16 — `tsup` can compile multiple entry points in a single invocation
2. **Logical separation preserved** — each plugin remains in its own directory with its own `index.ts`, `_helpers/`, `__tests__/`
3. **Multiple exports** via `package.json` `exports` field — consumers import `@harness/plugins/identity`, `@harness/plugins/cron`, etc.
4. **Tests still isolated** — vitest can run per-directory, and each plugin's `__tests__/` stays where it is
5. **No architectural changes** — the orchestrator's `plugin-registry/index.ts` just changes import paths

## Implementation Plan

### Task Type
- [x] Backend (orchestrator + packages)
- [ ] Frontend
- [ ] Fullstack

### Step 1: Create unified `@harness/plugins` package structure

**Expected deliverable**: Single package.json with multi-entry exports

```
packages/plugins/
├── package.json            ← NEW: single package manifest
├── tsconfig.json           ← NEW: single tsconfig
├── vitest.config.ts        ← NEW: single vitest config
├── activity/
│   ├── index.ts            ← KEEP (unchanged source)
│   ├── _helpers/
│   └── __tests__/
├── audit/
│   └── ...
├── auto-namer/
│   └── ...
├── context/
│   └── ...
├── cron/
│   └── ...
├── delegation/
│   └── ...
├── discord/
│   └── ...
├── identity/
│   └── ...
├── metrics/
│   └── ...
├── music/
│   └── ...
├── project/
│   └── ...
├── summarization/
│   └── ...
├── time/
│   └── ...
├── validator/
│   └── ...
└── web/
│   └── ...
```

The new `package.json`:
```json
{
  "name": "@harness/plugins",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./*": {
      "types": "./dist/*/index.d.ts",
      "import": "./dist/*/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@harness/database": "workspace:*",
    "@harness/logger": "workspace:*",
    "@harness/plugin-contract": "workspace:*",
    "croner": "...",
    "discord.js": "...",
    "express": "...",
    "ws": "..."
  }
}
```

The new `tsup.config.ts`:
```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "activity/index": "activity/index.ts",
    "audit/index": "audit/index.ts",
    "auto-namer/index": "auto-namer/index.ts",
    "context/index": "context/index.ts",
    "cron/index": "cron/index.ts",
    "delegation/index": "delegation/index.ts",
    "discord/index": "discord/index.ts",
    "identity/index": "identity/index.ts",
    "metrics/index": "metrics/index.ts",
    "music/index": "music/index.ts",
    "project/index": "project/index.ts",
    "summarization/index": "summarization/index.ts",
    "time/index": "time/index.ts",
    "validator/index": "validator/index.ts",
    "web/index": "web/index.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: true,   // shared helpers are deduplicated across entries
  clean: true,
});
```

### Step 2: Merge dependencies from all 16 package.json files

**Expected deliverable**: Single unified dependency list in the new package.json

- Union all `dependencies` from each plugin's package.json
- Union all `devDependencies`
- Remove the 16 individual package.json files
- Remove the 16 individual tsconfig.json files

### Step 3: Remove `src/` nesting from plugin directories

**Expected deliverable**: Flattened directory structure

Currently each plugin has `packages/plugins/cron/src/index.ts`. After merge, the structure is `packages/plugins/cron/index.ts` (the `src/` level is redundant since the parent package now owns the source root).

**Alternative**: Keep the `src/` nesting and adjust tsup entry points to `cron/src/index.ts`. This avoids moving files but makes the exports map uglier. **Decision: keep `src/` to minimize file moves — it's fine to have `cron/src/index.ts` as the entry.**

Updated tsup entries would be:
```ts
entry: {
  "activity/index": "activity/src/index.ts",
  "audit/index": "audit/src/index.ts",
  // ...
}
```

### Step 4: Update the orchestrator's imports

**Expected deliverable**: Updated `plugin-registry/index.ts` and `package.json`

Before:
```ts
import { plugin as cronPlugin } from "@harness/plugin-cron";
```

After:
```ts
import { plugin as cronPlugin } from "@harness/plugins/cron";
```

And `orchestrator/package.json` replaces 16 `@harness/plugin-*` dependencies with one:
```json
{
  "dependencies": {
    "@harness/plugins": "workspace:*"
  }
}
```

### Step 5: Update workspace configuration

**Expected deliverable**: Updated root package.json and pnpm-workspace.yaml

Remove `"packages/plugins/*"` from workspaces (it's now a single package at `"packages/plugins"`). The `packages/*` glob already catches `packages/plugins` as a workspace.

Actually — `packages/*` matches `packages/plugins` already, so the `packages/plugins/*` glob just needs to be removed.

### Step 6: Update turbo.json if needed

The `plugin:generate` task has `inputs` referencing `packages/plugins/*/src/_helpers/settings-schema.ts` — this path stays the same since the directory structure is preserved.

No changes needed to turbo.json task definitions.

### Step 7: Update test configuration

**Expected deliverable**: Single vitest.config.ts for the plugins package

The consolidated vitest config runs all tests across plugin directories. Each plugin's `__tests__/` directory remains in place.

### Step 8: Update import paths in plugin source files

**Expected deliverable**: Any cross-plugin imports updated

Check if any plugin imports from another plugin (e.g., does delegation import from validator?). These become relative imports within the same package instead of workspace imports.

### Step 9: Update CI, coverage gate, and lint-staged

**Expected deliverable**: Updated scripts that reference plugin packages

- Coverage gate script may reference individual plugin packages — needs updating
- lint-staged configuration may filter by package path — verify
- Integration tests import from `@harness/plugin-*` — update to `@harness/plugins/*`

### Step 10: Verify and clean up

- Run `pnpm install` to regenerate lockfile
- Run `pnpm build` to verify single-build works
- Run `pnpm typecheck` to verify types resolve
- Run `pnpm test` to verify all tests pass
- Run `pnpm lint` to verify biome is happy
- Delete old `node_modules` directories from individual plugin folders

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/plugins/package.json` | Create (replace 16) | Unified package manifest with multi-entry exports |
| `packages/plugins/tsconfig.json` | Create (replace 16) | Unified TypeScript config |
| `packages/plugins/tsup.config.ts` | Create | Multi-entry tsup build config |
| `packages/plugins/vitest.config.ts` | Create | Unified test config |
| `packages/plugins/*/package.json` | Delete (16 files) | Remove individual package manifests |
| `packages/plugins/*/tsconfig.json` | Delete (16 files) | Remove individual tsconfigs |
| `apps/orchestrator/src/plugin-registry/index.ts` | Modify | Update import paths |
| `apps/orchestrator/package.json` | Modify | Replace 16 deps with 1 |
| `package.json` (root) | Modify | Remove `packages/plugins/*` workspace |
| `tests/integration/*.test.ts` | Modify | Update import paths |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| tsup multi-entry build is slower than parallel single-entry | `splitting: true` enables code sharing; net build time should be faster (1 process vs 16). Benchmark before/after. |
| Losing Turbo cache granularity (one plugin change rebuilds all) | True, but these plugins change together frequently and share `plugin-contract`. The current cache hit rate for individual plugins is likely low. |
| Cross-plugin dependency issues during merge | Audit all import paths before merging. Create a script to find all `@harness/plugin-*` imports. |
| Breaking integration tests | Integration tests import from `@harness/plugin-*` — update in the same PR. |
| `pnpm install` workspace resolution issues | Test with `pnpm install --force` after workspace changes. |
| Coverage gate barrel detection | The coverage gate rejects files that only re-export (`export * from`). Verify each plugin's `index.ts` has real implementation, not just barrel re-exports. Most do (they define `PluginDefinition`), but audit before merging. |
| `moduleResolution` compatibility | Wildcard `exports` requires `moduleResolution: "bundler"` or `"node16"`. The repo already uses `"bundler"` — no change needed. |

## Impact Assessment

**Before**: 25 build tasks, 16 plugin build processes, ~16 tsup invocations
**After**: 10 build tasks, 1 plugin build process, 1 tsup invocation with 16 entries

**Net reduction**: 15 fewer Turbo task graph nodes for `build`. Similar reductions for `typecheck`, `lint`, and `test` (though tests may still run in a single vitest process).

**Developer experience**: Adding a new plugin = add a directory + add an entry to tsup.config.ts + add an export to package.json. No new workspace package needed.

## What We Preserve

- Directory-per-plugin isolation (each plugin is still a directory with its own index.ts, _helpers/, __tests__)
- Independent test files (each plugin's __tests__/ is untouched)
- Import ergonomics (`@harness/plugins/cron` is just as clean as `@harness/plugin-cron`)
- Plugin contract as a separate package (`@harness/plugin-contract` stays independent — it defines the interface)
- Runtime enable/disable via database (unchanged — this is a build-time change only)

## Alternatives Considered

### Hybrid (Keep Large Plugins Separate)

Could keep the 3-4 largest plugins (identity, delegation, web, discord) as separate packages and merge only the smaller ones. **Rejected** because:
- Adds complexity (some plugins here, some there)
- The same person usually works on multiple plugins at once
- Consistency is more valuable than micro-optimization

### Just-in-Time (No Build Step)

Turborepo's recommended JIT pattern exports raw `.ts` source files. The consumer's bundler compiles them. **Rejected** because:
- The orchestrator uses `tsc` for production builds — it can't compile external `.ts` packages
- JIT only works when the consumer has a bundler (Next.js, Vite) or runs via `tsx`
- Would require fundamentally changing how the orchestrator builds
- See [Turborepo Discussion #4509](https://github.com/vercel/turborepo/discussions/4509)

### Do Nothing (Keep 16 Separate Packages)

Turborepo maintainers say overhead is under 1% at this scale. **Considered viable** — but the developer friction of creating a full package per plugin and the 16 redundant `tsup` spawns still justify consolidation.

## Research Sources

| Source | Type | URL |
|--------|------|-----|
| Turborepo: Internal Packages | PRIMARY | https://turborepo.dev/docs/core-concepts/internal-packages |
| Turborepo: Creating an Internal Package | PRIMARY | https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package |
| Turborepo: Package and Task Graph | PRIMARY | https://turborepo.dev/docs/core-concepts/package-and-task-graph |
| Turborepo Discussion #6347 (package count) | PRIMARY | https://github.com/vercel/turborepo/discussions/6347 |
| Turborepo Discussion #4509 (JIT + Node.js) | PRIMARY | https://github.com/vercel/turborepo/discussions/4509 |
| Node.js: `exports` field | PRIMARY | https://nodejs.org/api/packages.html#exports |
| Payload CMS (44 packages, 13 plugins) | PRIMARY | https://github.com/payloadcms/payload/tree/main/packages |
| Turborepo blog: Project References | PRIMARY | https://turborepo.dev/blog/you-might-not-need-typescript-project-references |
