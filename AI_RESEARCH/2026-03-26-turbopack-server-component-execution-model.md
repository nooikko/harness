# Research: Turbopack Server Component Execution Model

Date: 2026-03-26

## Summary

`next dev` with Turbopack runs server components in a **single Node.js child process** (forked from the CLI parent). All server component module evaluations — including Prisma client instantiation — happen in that same process, sharing one `globalThis` and one `process.env`. Turbopack's Rust engine handles *compilation* in worker threads/Rust parallelism but is strictly separate from *execution*. The `require.cache` in the server child process is the module cache for all server-side code.

## Prior Research

None — this is the first research on Turbopack's execution model in this project.

## Current Findings

### 1. Process Architecture: Two Processes, Not One

`next dev` uses **two Node.js processes**:

**Process 1 — CLI supervisor (parent)**
- Entry: `packages/next/src/cli/next-dev.ts`
- Responsible for: watching for restarts, handling signals, managing dev session lifecycle
- Key code (source-verified):
  ```ts
  child = fork(startServerPath, {
    stdio: 'inherit',
    execArgv,
    env: {
      ...defaultEnv,   // = initialEnv || process.env (snapshot at CLI start)
      TURBOPACK: process.env.TURBOPACK,
      __NEXT_DEV_SERVER: '1',
      NEXT_PRIVATE_WORKER: '1',
      // ... additional vars
    },
  })
  ```
- `defaultEnv` is `initialEnv || process.env` — a **snapshot** of `process.env` at CLI launch time, spread into the child

**Process 2 — Dev server worker (child)**
- Entry: `packages/next/src/server/lib/start-server.ts`
- Responsible for: HTTP server, Turbopack HMR, serving all routes, executing server components
- This is the process that runs your app code

**Key implication:** There is only one "app process". Server components, server actions, API routes, and Prisma all run in Process 2. There are no per-route or per-component child processes.

Source: `packages/next/src/cli/next-dev.ts` (verified via GitHub API, line ~280 in current canary)

---

### 2. process.env in the Child Process

The child process receives `process.env` via the `env:` option to `fork()`. The spread is:

```ts
const defaultEnv = (initialEnv || process.env) as typeof process.env
// ...
env: {
  ...defaultEnv,
  // Turbopack-specific and Next.js internal vars overridden on top
}
```

`initialEnv` comes from `@next/env`, which loads `.env` files before the fork. This means:

- **.env files are loaded by the parent** before forking — the child receives the fully-resolved env
- **process.env in Process 2 is a point-in-time snapshot** — mutations to `.env` files after server start require a restart
- **process.env is NOT re-read from disk** on each hot reload cycle; only the module that changed is re-evaluated
- The child's `process.env` is a **plain JS object** — all routes and modules in Process 2 share it

**For `import 'dotenv/config'` in `@harness/database`:**
- `dotenv/config` calls `dotenv.config()` which reads `.env` and merges into `process.env`
- In Next.js dev mode, this runs once at first module evaluation in Process 2
- Because `require.cache` caches modules, subsequent imports of `@harness/database` do NOT re-run `import 'dotenv/config'` — the module is only initialized once
- After the `dotenv/config` side effect runs, `process.env` is mutated in-place in Process 2 — visible to all subsequent code in that process

---

### 3. Module Evaluation: require.cache, Not VM Contexts

Server components (App Router, Node.js runtime) are evaluated using Node.js's standard `require()` mechanism with `require.cache`. They do **not** use VM sandbox contexts.

The sandbox context (`packages/next/src/server/web/sandbox/context.ts`) is specifically for the **Edge Runtime** only — it creates isolated `EdgeRuntime` VMs with per-module `globalThis` contexts. This does NOT apply to server components in the Node.js runtime.

For Node.js runtime server components:
- Module evaluation uses the standard Node.js module system
- `require.cache` is the module registry — one entry per file path
- All modules in Process 2 share the same `globalThis`

Source: `packages/next/src/server/web/sandbox/context.ts` — confirmed this is Edge Runtime only via the `NEXT_RUNTIME: 'edge'` polyfill and `EdgeRuntime` class usage

Source: `packages/next/src/server/lib/render-server.ts`:
```ts
let sandboxContext: undefined | typeof import('../web/sandbox/context')

if (process.env.NODE_ENV !== 'production') {
  sandboxContext =
    require('../web/sandbox/context') as typeof import('../web/sandbox/context')
}

export function clearAllModuleContexts() {
  return sandboxContext?.clearAllModuleContexts()
}
```
`sandboxContext` is only used for Edge Runtime clearing — Node.js RSC uses `deleteCache()` on `require.cache` directly.

---

### 4. Server Fast Refresh and require.cache

From Next.js 16.2 (March 2026), Turbopack uses "Server Fast Refresh" which replaces the previous behavior:

**Previous behavior (pre-16.2 with Turbopack, and current webpack behavior):**
- On file change: clears `require.cache` for the changed module AND all modules in its import chain
- Often evicted unchanged `node_modules` unnecessarily

**New behavior (Turbopack 16.2+ Server Fast Refresh):**
- Turbopack's knowledge of the module graph means **only the module that actually changed** is evicted from `require.cache`
- Unchanged modules (including `node_modules`, including `@prisma/client`) remain cached
- Source: Next.js 16.2 blog: *"The previous system cleared the `require.cache` for the changed module and all other modules in its import chain. [...] The new system brings the same Fast Refresh approach used in the browser to your server code."*

**For Prisma singleton pattern:**
- With Server Fast Refresh, if you change a server component file, Prisma's module is NOT evicted (it's in `node_modules` and didn't change)
- `globalThis.prisma` guard is still a best practice for the case where a full server restart occurs or if `require.cache` is cleared for the database module's import chain
- The `globalThis` singleton pattern works because `globalThis` in Process 2 persists across `require.cache` evictions

---

### 5. globalThis in Turbopack Dev Mode

**For Node.js runtime server components (App Router):**
- `globalThis` is the **global object of Process 2**
- It is shared across all module evaluations in that process
- It persists across `require.cache` evictions (module hot reloads)
- Setting `globalThis.prisma = new PrismaClient()` in the database module and checking `if (!globalThis.prisma)` before re-instantiating works correctly because `globalThis` survives hot reloads even when `require.cache` is cleared for that module

**For Edge Runtime (Middleware, Edge API routes):**
- `globalThis` is the context of the `EdgeRuntime` VM instance
- It is isolated per module context key (see `sandbox/context.ts`)
- Prisma does NOT work in the Edge Runtime — this is a separate concern

**Turbopack compilation workers (Rust parallelism):**
- The Turbopack bundler compiles modules in parallel using Rust worker threads
- These are for **compilation** (parsing ASTs, transforming TypeScript, etc.) — NOT for executing your app code
- PostCSS runs in a "Node.js worker pool" (per official docs) for loader execution — also compilation, not app execution
- None of these workers share `globalThis` with app code — they are in a separate process/thread space

---

### 6. Specific Case: @harness/database with dotenv/config + PrismaClient

The database package does:
```ts
import 'dotenv/config'
// ...
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Execution path in `next dev` with Turbopack:

1. **First import** of `@harness/database` in any server component or server action
   - Process 2's module system evaluates `packages/database/src/index.ts`
   - `import 'dotenv/config'` runs — reads `packages/database/.env` and merges into `process.env`
   - `globalThis.prisma` is undefined — `new PrismaClient()` runs
   - `globalThis.prisma = prisma` stores the instance
   - Module cached in `require.cache`

2. **Subsequent imports** in the same process lifecycle
   - `require.cache` returns the cached module — neither `dotenv/config` nor `new PrismaClient()` re-run
   - All code gets the same `prisma` singleton

3. **Hot reload** (e.g., you change a server component file)
   - With Turbopack Server Fast Refresh: only the changed module is evicted from `require.cache`
   - `@harness/database` is NOT evicted (it's in `node_modules`, unchanged)
   - `globalThis.prisma` still holds the existing PrismaClient instance

4. **Hot reload that touches the database module's import chain** (unlikely but possible)
   - `require.cache` entry for `@harness/database` is evicted
   - Module re-evaluates: `import 'dotenv/config'` runs again (but `process.env` already has the vars — dotenv is idempotent by default)
   - `globalThis.prisma` is checked — it still exists (globalThis survived the cache eviction)
   - `new PrismaClient()` is NOT called again — the existing instance is reused

**Conclusion:** The `globalThis.prisma` singleton pattern works correctly with Turbopack because:
- `globalThis` outlives `require.cache` evictions
- dotenv/config is idempotent (won't overwrite already-set vars by default)
- Turbopack Server Fast Refresh is actually less aggressive than the old system, so evictions are rarer

---

### 7. Distinction: Compilation Workers vs Execution Context

A source of confusion: Turbopack documentation mentions "worker processes" and "worker pools" in a few places:

| Worker Type | What It Does | Shares process.env with app? | Shares globalThis with app? |
|---|---|---|---|
| Turbopack Rust engine | AST parsing, module graph building, code generation (written in Rust) | NO — separate Rust process | NO |
| PostCSS Node.js worker pool | Runs PostCSS transformations on CSS files during compilation | YES (forked from same env) | NO (separate Node.js workers) |
| webpack-loader-runner | Executes webpack-compatible loaders (babel-loader, etc.) during compilation | Compilation context only | NO |
| Process 2 (dev server) | **Executes your app code** — server components, server actions, API routes | YES — this IS your app's env | YES — this IS your app's global |

Turbopack compiles code in Rust. That compiled code is then **loaded and executed by Process 2 via Node.js's standard module system**. The execution context is always Process 2.

---

## Key Takeaways

1. **One app process.** `next dev` forks exactly one child process (Process 2) that runs your application. All server components, server actions, Prisma, and dotenv execute in this process.

2. **process.env is inherited at fork time.** The parent CLI process loads `.env` files via `@next/env` before forking. The child receives a snapshot. Mutations to `.env` after server start require a restart.

3. **globalThis is fully shared** across all server component module evaluations in Node.js runtime. It persists across `require.cache` evictions. The `globalThis.prisma` singleton pattern works correctly.

4. **Server Fast Refresh (16.2+)** only evicts the changed module from `require.cache`, not its entire dependency tree. Prisma (in `node_modules`) is almost never evicted during normal development.

5. **Edge Runtime is different.** The `sandbox/context.ts` VM isolation applies ONLY to middleware and Edge API routes. App Router server components use the plain Node.js module system with `require.cache`.

6. **Turbopack compilation workers** (Rust engine, PostCSS worker pool) are for *compiling code*, not *executing it*. They do not affect `process.env` or `globalThis` in your app.

7. **`import 'dotenv/config'` in `@harness/database`** runs once per process lifecycle (first import). Because `require.cache` is shared and the module is almost never evicted, this is effectively a one-time initialization per `next dev` session.

## Sources

- `packages/next/src/cli/next-dev.ts` — fork() call with env spreading (verified via GitHub API, vercel/next.js canary)
- `packages/next/src/server/lib/render-server.ts` — sandboxContext is Edge Runtime only; deleteCache is the Node.js mechanism
- `packages/next/src/server/web/sandbox/context.ts` — EdgeRuntime VM isolation (Edge Runtime only)
- `packages/next/src/server/dev/hot-reloader-turbopack.ts` — deleteCache() + clearModuleContext() imports
- `packages/next/src/server/dev/require-cache.ts` — deleteFromRequireCache implementation (Node.js require.cache manipulation)
- [Next.js 16.2 Turbopack blog](https://nextjs.org/blog/next-16-2-turbopack) — Server Fast Refresh: require.cache clearing behavior
- [Turbopack Dev Stable blog](https://nextjs.org/blog/turbopack-for-development-stable) — single compiler, multiple environments, no separate compiler processes
- [Turbopack API Reference](https://nextjs.org/docs/app/api-reference/turbopack) — PostCSS uses "Node.js worker pool" (compilation only)
- [Inside Turbopack: Incremental Computation](https://nextjs.org/blog/turbopack-incremental-computation) — Rust-based value cells, demand-driven computation
- [Prisma + Next.js Guide](https://www.prisma.io/docs/guides/frameworks/nextjs) — globalThis singleton needed for hot reload
- [GitHub Issue #84766](https://github.com/vercel/next.js/issues/84766) — Turbopack traces worker_threads for bundling (not app execution)
