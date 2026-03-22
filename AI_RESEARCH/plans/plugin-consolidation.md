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

## Pre-Implementation Audit Results

### Cross-Plugin Imports
**No cross-plugin imports exist.** Every plugin imports only from `@harness/plugin-contract` and `@harness/database` — never from another plugin. This means no intra-package relative import rewrites are needed.

### Existing `packages/plugins/package.json`
A placeholder already exists at `packages/plugins/package.json`:
```json
{ "name": "plugins", "version": "0.0.0", "private": true }
```
This will be **replaced** with the new unified package manifest.

### Web App Impact
The web app (`apps/web`) imports only `@harness/plugin-contract` (not any plugin directly):
- `apps/web/package.json` — depends on `@harness/plugin-contract` only (stays unchanged)
- `apps/web/next.config.ts` — `transpilePackages` lists `@harness/plugin-contract` (stays unchanged)
- `apps/web/src/app/admin/plugins/[name]/_actions/_helpers/build-settings-payload.ts` — imports from `@harness/plugin-contract` (stays unchanged)

**No web app changes needed.**

### `src/` Directory Decision
**Keep `src/` as-is.** Every plugin has `<plugin>/src/index.ts` with `_helpers/` and `__tests__/` inside `src/`. Moving files would be a massive diff for zero benefit. The tsup entry points will reference `<plugin>/src/index.ts`.

---

## Implementation Plan

### Task Type
- [x] Backend (orchestrator + packages)
- [ ] Frontend
- [ ] Fullstack

### Step 1: Replace `packages/plugins/package.json` with unified manifest

**Expected deliverable**: Single package.json with multi-entry exports, merged dependencies

The existing placeholder `{ "name": "plugins" }` is replaced. Dependencies are the union of all 16 individual plugin package.json files.

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
    "bonjour-service": "^1.3.0",
    "castv2-client": "^1.2.0",
    "cors": "^2.8.6",
    "croner": "^9.1.0",
    "discord.js": "^14.25.1",
    "express": "^5.2.1",
    "ws": "^8.19.0",
    "youtubei.js": "^14.0.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/cors": "<from web plugin>",
    "@types/express": "<from web plugin>",
    "@types/node": "^22.19.11",
    "@types/ws": "<from web plugin>",
    "@vitest/coverage-v8": "^4.0.18",
    "tsup": "^8.5.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

**Action items:**
- Script to extract and merge all deps from `packages/plugins/*/package.json`
- Delete all 16 individual `package.json` files after merging

### Step 2: Create unified `tsup.config.ts`

**Expected deliverable**: Multi-entry tsup config

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "activity/index": "activity/src/index.ts",
    "audit/index": "audit/src/index.ts",
    "auto-namer/index": "auto-namer/src/index.ts",
    "context/index": "context/src/index.ts",
    "cron/index": "cron/src/index.ts",
    "delegation/index": "delegation/src/index.ts",
    "discord/index": "discord/src/index.ts",
    "identity/index": "identity/src/index.ts",
    "metrics/index": "metrics/src/index.ts",
    "music/index": "music/src/index.ts",
    "project/index": "project/src/index.ts",
    "summarization/index": "summarization/src/index.ts",
    "time/index": "time/src/index.ts",
    "validator/index": "validator/src/index.ts",
    "web/index": "web/src/index.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: true,
  clean: true,
});
```

### Step 3: Create unified `tsconfig.json`

**Expected deliverable**: Single tsconfig covering all plugin source

The current per-plugin tsconfigs all extend `../../../tsconfig.base.json` with `rootDir: ./src` and `outDir: ./dist`. The new config extends `../../tsconfig.base.json` (one level up since `packages/plugins/` is now the package root) and includes all `*/src/**/*.ts`.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["*/src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/__tests__/**"]
}
```

**Action items:**
- Delete all 16 individual `tsconfig.json` files
- Verify `tsc --noEmit` passes from `packages/plugins/`

### Step 4: Create unified `vitest.config.ts`

**Expected deliverable**: Single vitest config that runs all plugin tests

Currently each plugin has its own `vitest.config.ts` with a unique `name` field (e.g., `plugin-identity`). The new config runs tests across all plugin directories from a single invocation.

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "plugins",
    environment: "node",
    include: ["*/src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
    },
  },
});
```

**Action items:**
- Delete all 16 individual `vitest.config.ts` files
- Verify `vitest run` from `packages/plugins/` finds all tests

### Step 5: Update root `vitest.config.ts`

**Expected deliverable**: Root vitest config with 16 plugin entries collapsed to 1

**Before** (root `vitest.config.ts`):
```ts
projects: [
  'apps/web',
  'apps/orchestrator',
  'packages/ui',
  'packages/logger',
  'packages/plugin-contract',
  'packages/plugins/context',    // ← 16 individual entries
  'packages/plugins/discord',
  'packages/plugins/web',
  'packages/plugins/delegation',
  'packages/plugins/activity',
  'packages/plugins/metrics',
  'packages/plugins/summarization',
  'packages/plugins/identity',
  'packages/plugins/auto-namer',
  'packages/plugins/audit',
  'packages/plugins/time',
  'packages/plugins/cron',
  'packages/plugins/project',
  'packages/plugins/music',
  'packages/database',
]
```

**After:**
```ts
projects: [
  'apps/web',
  'apps/orchestrator',
  'packages/ui',
  'packages/logger',
  'packages/plugin-contract',
  'packages/plugins',             // ← 1 entry
  'packages/database',
]
```

### Step 6: Update `scripts/coverage-gate.py`

**This is the trickiest part.** The coverage gate has a hardcoded `PROJECT_DIRS` list that maps file paths to per-package vitest invocations. It runs vitest separately per package to avoid ESM race conditions with `vite-tsconfig-paths`.

**Before** (`PROJECT_DIRS` in `coverage-gate.py`):
```python
("packages/plugins/context/", "packages/plugins/context"),
("packages/plugins/discord/", "packages/plugins/discord"),
("packages/plugins/web/", "packages/plugins/web"),
# ... 16 entries total
```

**After:**
```python
("packages/plugins/", "packages/plugins"),
```

All 16 plugin directory prefixes collapse into one entry. The coverage gate will now invoke vitest once from `packages/plugins/` instead of 16 separate invocations.

**Risk:** The original per-package design was specifically to avoid an ESM race condition when multiple vitest configs load simultaneously. With a single `packages/plugins/vitest.config.ts`, there's only one config to load — the race condition should not apply. However, this needs verification. If the unified vitest invocation hits the same race, we can use vitest's `--pool=forks` or `--poolOptions.threads.isolate` to work around it.

**Also update:**
- The `packages/plugins/music/` exclusion pattern in `EXCLUDED_PATTERNS` stays as-is (it matches the directory path, not the package name)

### Step 7: Update the orchestrator

**Expected deliverable**: Updated imports in `plugin-registry/index.ts` and `package.json`

**`apps/orchestrator/src/plugin-registry/index.ts`** — 16 import path changes:
```ts
// Before
import { plugin as activityPlugin } from '@harness/plugin-activity';
import { plugin as cronPlugin } from '@harness/plugin-cron';
// ...

// After
import { plugin as activityPlugin } from '@harness/plugins/activity';
import { plugin as cronPlugin } from '@harness/plugins/cron';
// ...
```

**`apps/orchestrator/package.json`** — replace 16 deps with 1:
```json
// Before
"@harness/plugin-activity": "workspace:*",
"@harness/plugin-audit": "workspace:*",
// ... 14 more

// After
"@harness/plugins": "workspace:*",
```

Keep `@harness/plugin-contract` as a separate dependency (it stays its own package).

### Step 8: Update integration tests

**Expected deliverable**: Updated imports in 13+ test files and `tests/integration/package.json`

**`tests/integration/package.json`** — replace 15 deps with 1:
```json
// Before
"@harness/plugin-activity": "workspace:*",
"@harness/plugin-audit": "workspace:*",
// ... 13 more

// After
"@harness/plugins": "workspace:*",
```

Keep `@harness/plugin-contract` (used for types in `create-harness.ts` and some tests).

**Test files to update** (13 files, mechanical find-and-replace):
| File | Import Change |
|------|--------------|
| `context-plugin.test.ts` | `@harness/plugin-context` → `@harness/plugins/context` |
| `cron-plugin.test.ts` | `@harness/plugin-cron` → `@harness/plugins/cron` |
| `delegation-plugin.test.ts` | `@harness/plugin-delegation` → `@harness/plugins/delegation` |
| `identity-plugin.test.ts` | `@harness/plugin-identity` → `@harness/plugins/identity` |
| `metrics-plugin.test.ts` | `@harness/plugin-metrics` → `@harness/plugins/metrics` |
| `time-plugin.test.ts` | `@harness/plugin-time` → `@harness/plugins/time` |
| `summarization-plugin.test.ts` | `@harness/plugin-summarization` → `@harness/plugins/summarization` |
| `auto-namer-plugin.test.ts` | `@harness/plugin-auto-namer` → `@harness/plugins/auto-namer` |
| `discord-plugin.test.ts` | `@harness/plugin-discord` → `@harness/plugins/discord` |
| `validator-plugin.test.ts` | `@harness/plugin-validator` → `@harness/plugins/validator` |
| `web-plugin.test.ts` | `@harness/plugin-web` → `@harness/plugins/web` |
| `activity-plugin.test.ts` | `@harness/plugin-activity` → `@harness/plugins/activity` |
| `project-plugin.test.ts` | `@harness/plugin-project` → `@harness/plugins/project` |
| `audit-plugin.test.ts` | `@harness/plugin-audit` → `@harness/plugins/audit` |
| `full-pipeline.test.ts` | `@harness/plugin-activity`, `-context`, `-identity`, `-metrics`, `-summarization`, `-time` → `@harness/plugins/*` |

Also update `tests/integration/CLAUDE.md` which has an example import path on line 99.

### Step 9: Update workspace configuration

**Expected deliverable**: Root `package.json` workspace globs updated

**Before** (root `package.json`):
```json
"workspaces": [
  "apps/*",
  "packages/*",
  "packages/plugins/*"
]
```

**After:**
```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```

The `packages/*` glob already matches `packages/plugins` as a workspace. The `packages/plugins/*` glob was needed when each plugin subdirectory was its own package — no longer needed.

### Step 10: Update `scripts/generate-plugin-registry.ts`

**Expected deliverable**: Verify the codegen script still works

The script uses glob patterns to discover plugins:
- `packages/plugins/*/src/_helpers/settings-schema.ts` — for settings schemas
- `packages/plugins/*/src/index.ts` — for tool registration

Both patterns match the `<plugin>/src/` directory structure which is **preserved**. The script dynamically imports from file paths (not package names), so **no changes needed** — but verify by running `pnpm plugin:generate` after the merge.

### Step 11: Delete per-plugin config files

**Expected deliverable**: 48 files deleted (16 package.json + 16 tsconfig.json + 16 vitest.config.ts)

```bash
# Delete per-plugin configs (source files untouched)
rm packages/plugins/*/package.json
rm packages/plugins/*/tsconfig.json
rm packages/plugins/*/vitest.config.ts
```

### Step 12: Clean up and verify

**Expected deliverable**: Everything builds, typechecks, lints, and tests pass

```bash
# 1. Remove old node_modules from individual plugin dirs
rm -rf packages/plugins/*/node_modules

# 2. Reinstall with new workspace layout
pnpm install

# 3. Verify build
pnpm build

# 4. Verify typecheck
pnpm typecheck

# 5. Verify tests (unit)
pnpm test

# 6. Verify lint
pnpm lint

# 7. Verify codegen
pnpm plugin:generate

# 8. Verify coverage gate
pnpm test:coverage-gate --skip-coverage
```

If vitest hits the ESM race condition when running all plugin tests from a single directory, fall back to `--pool=forks` in the plugins vitest config.

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/plugins/package.json` | Replace | Unified package manifest with multi-entry exports + merged deps |
| `packages/plugins/tsconfig.json` | Replace | Unified TypeScript config covering `*/src/**/*.ts` |
| `packages/plugins/tsup.config.ts` | Create | Multi-entry tsup build config (16 entries) |
| `packages/plugins/vitest.config.ts` | Replace | Unified test config matching `*/src/**/__tests__/**` |
| `packages/plugins/*/package.json` | Delete (16) | Remove individual package manifests |
| `packages/plugins/*/tsconfig.json` | Delete (16) | Remove individual tsconfigs |
| `packages/plugins/*/vitest.config.ts` | Delete (16) | Remove individual vitest configs |
| `vitest.config.ts` (root) | Modify | Collapse 16 plugin project entries → 1 |
| `scripts/coverage-gate.py` | Modify | Collapse 16 `PROJECT_DIRS` entries → 1 |
| `apps/orchestrator/src/plugin-registry/index.ts` | Modify | 16 import path changes |
| `apps/orchestrator/package.json` | Modify | Replace 16 deps with 1 |
| `tests/integration/package.json` | Modify | Replace 15 deps with 1 |
| `tests/integration/*.test.ts` (13+ files) | Modify | Import path changes |
| `tests/integration/CLAUDE.md` | Modify | Example import path |
| `package.json` (root) | Modify | Remove `packages/plugins/*` workspace glob |

**Total file operations:** ~3 creates, ~48 deletes, ~20 modifies

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| tsup multi-entry build is slower than parallel single-entry | `splitting: true` enables code sharing; net build time should be faster (1 process vs 16). Benchmark before/after. |
| Losing Turbo cache granularity (one plugin change rebuilds all) | True, but `plugin-contract` changes already invalidate all 16. The practical cache hit rate for individual plugins is low. |
| ESM race condition in unified vitest run | The original per-package vitest design avoided a `vite-tsconfig-paths` race. With one config, no race. If it surfaces, use `--pool=forks` or `--poolOptions.threads.isolate`. |
| Coverage gate `PROJECT_DIRS` mapping breaks | Collapse 16 entries to 1. The gate runs vitest from the package dir — one dir means one invocation. Test with `pnpm test:coverage-gate`. |
| `sherif` dependency validation fails | sherif checks workspace dependencies. After removing 16 workspace packages, re-run `pnpm sherif` to verify no dangling references. |
| `pnpm install` workspace resolution issues | Test with `pnpm install --force` after workspace changes. |
| Coverage gate barrel detection | Verify each plugin's `index.ts` has real implementation (defines `PluginDefinition`), not just barrel re-exports. Already confirmed — all do. |
| `moduleResolution` compatibility | Wildcard `exports` requires `moduleResolution: "bundler"` or `"node16"`. Already using `"bundler"`. |

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
