# Turborepo Audit

**Date:** 2026-02-27
**Turbo version:** 2.8.10
**Scope:** Root `turbo.json`, all `package.json` scripts, CI workflow, workspace configuration

This audit compares the repo's Turbo usage against official best practices. Findings are rated:
- **Critical** — cache correctness risk (stale builds shipped)
- **Moderate** — missed performance or configuration inconsistency
- **Minor** — deviation from convention; intentional is fine, unintentional is worth fixing

---

## Critical

### 1. ✅ No environment variables declared in `turbo.json` — RESOLVED

**Fixed:** Added `globalEnv: ["NODE_ENV"]`, `globalDependencies: ["tsconfig.base.json"]`, and `env: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_ORCHESTRATOR_WS_URL"]` to the `build` task.

Turbo must be told which env vars affect task outputs via `globalEnv` or per-task `env`. Without these declarations, Turbo's cache hash ignores those variables — so changing `DATABASE_URL` or a `NEXT_PUBLIC_*` var won't bust the cache, and you could restore a stale build with wrong values baked in.

The `NEXT_PUBLIC_*` vars are inlined into the Next.js bundle at build time. `NODE_ENV` controls production optimizations. Runtime-only vars (`PORT`, `ORCHESTRATOR_URL`, `HARNESS_ENCRYPTION_KEY`, `DATABASE_URL`) don't need to be declared — they're read at runtime, not baked into build artifacts.

---

### 2. ✅ `plugin:generate` — `cache: false` contradicts declared `inputs`/`outputs` — RESOLVED

**Fixed:** Removed `cache: false` from the `plugin:generate` task. The `inputs`/`outputs` declarations are now active and Turbo will properly cache the code generation step.

The `generate-plugin-registry.ts` script reads filesystem globs and generates a static TypeScript file — it is deterministic (same schema inputs → same output), so caching is correct.

---

## Moderate

### 3. Hardcoded `"concurrency": "20"` in `turbo.json`

**File:** `turbo.json` — **Not yet resolved**

Turbo's default concurrency is dynamically based on available CPU cores (roughly `CPU count * 1.5`). Hardcoding `20` means:

- **GitHub Actions** (2 vCPUs): 20 concurrent tasks competing for 2 cores — severe context-switching overhead
- **Local dev**: Works on high-core machines, thrashes on laptops

The value `20` is also large enough to hit database connection limits if multiple tasks run DB operations simultaneously.

**Recommendation:** Remove the `concurrency` field and let Turbo use its CPU-based default. For environments with specific needs, override via the `TURBO_CONCURRENCY` environment variable (doesn't require a config change).

---

### 4. CI workflow doesn't use `--affected` and has no git depth

**File:** `.github/workflows/ci.yml` — **Not yet resolved**

The CI runs the full pipeline on every push. Two missed optimizations:

**a) `--affected` flag.** Turbo can compare the current branch against the base branch and skip tasks for packages that haven't changed. With ~13 packages, touching only `packages/ui` still runs typecheck/lint/build for the orchestrator, all plugins, and the database package.

**b) Shallow clone blocks `--affected`.** `actions/checkout@v4` defaults to `fetch-depth: 1`. The `--affected` flag needs enough git history to find the merge base. Without `fetch-depth: 0`, `--affected` falls back to running all packages anyway.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- run: pnpm turbo typecheck lint build --affected
```

---

### 5. No remote caching configured in CI

**File:** `.github/workflows/ci.yml` — **Not yet resolved**

Without remote caching (`TURBO_TOKEN` + `TURBO_TEAM`), every CI run rebuilds every package from scratch. The pnpm store cache reduces `pnpm install` time, but not Turbo's build/typecheck/test caches.

Not a correctness issue. When ready:

```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

Vercel provides remote caching for free for hobby use. Self-hosted alternatives exist (`ducktors/turborepo-remote-cache`).

---

### 6. ✅ Missing `globalDependencies: ["tsconfig.base.json"]` — RESOLVED

**Fixed:** Added alongside `globalEnv` in the same pass as finding #1.

---

### 7. ✅ `apps/web` package name was `"dashboard"` — RESOLVED

**Fixed:** `apps/web/package.json` renamed from `"dashboard"` to `"web"`. `pnpm --filter web` now correctly targets the web app.

---

### 8. ✅ `database` and `ui` used `"*"` instead of `"workspace:*"` — RESOLVED

**Fixed:** `apps/web/package.json` now declares `"database": "workspace:*"` and `"ui": "workspace:*"`, consistent with all other internal packages in the repo. Lockfile updated via `pnpm install`.

---

## Minor

### 9. ✅ `lint` used `dependsOn: ["^lint"]` — unnecessary serialization — RESOLVED

**Fixed:** Changed to `"lint": {}` (no `dependsOn`). All packages now lint in parallel rather than in topological order.

---

### 10. ✅ `database` typecheck ran `prisma generate` as a side effect — RESOLVED

**Fixed:** `packages/database/package.json` `typecheck` script changed from `prisma generate && tsc --noEmit` to just `tsc --noEmit`. Prisma generation is now solely the responsibility of the `db:generate` task (which has `cache: false` and always re-runs).

---

### 11. `typecheck` depends on `^build` — this is correct, not a violation

**File:** `turbo.json`

Worth noting explicitly: this is the right choice for this repo. Packages compile to `dist/` and consumers import from `dist/`. TypeScript's `--noEmit` needs the upstream `.d.ts` files to resolve imports. So `^build` (not `^typecheck`) is required.

---

## Summary Table

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Missing `globalEnv`/`env` for `NEXT_PUBLIC_*` vars | Critical | ✅ Resolved |
| 2 | `plugin:generate` has dead `inputs`/`outputs` with `cache: false` | Critical | ✅ Resolved |
| 3 | Hardcoded `concurrency: 20` | Moderate | ⏳ Open |
| 4 | CI missing `--affected` and shallow clone | Moderate | ⏳ Open |
| 5 | No remote caching | Moderate | ⏳ Open |
| 6 | `tsconfig.base.json` not in `globalDependencies` | Moderate | ✅ Resolved |
| 7 | `apps/web` named `"dashboard"` | Moderate | ✅ Resolved |
| 8 | `database`/`ui` use `"*"` not `"workspace:*"` | Moderate | ✅ Resolved |
| 9 | `lint` uses `^lint` (unnecessary serialization) | Minor | ✅ Resolved |
| 10 | Database `typecheck` runs `prisma generate` inline | Minor | ✅ Resolved |
| 11 | `typecheck` depends on `^build` | Note | ✅ Correct behavior, no change needed |
