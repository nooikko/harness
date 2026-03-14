# Research: Monorepo Package Consolidation Patterns

Date: 2026-03-13

## Summary

Research into patterns for consolidating many small TypeScript packages in a monorepo while maintaining logical separation. Covers: the `exports` field for multiple entry points, path aliases as a lightweight alternative to separate packages, TypeScript project references, Turborepo task graph overhead, "virtual package" patterns, and the pnpm `workspace:*` protocol with source-only packages.

## Prior Research

None found in AI_RESEARCH/ on this topic.

---

## Current Findings

### 1. package.json `exports` Field — Multiple Entry Points

**Source (PRIMARY):** https://nodejs.org/api/packages.html#exports

The `exports` field is the modern mechanism for exposing multiple entry points from a single npm package. It supersedes `main` and allows:

```json
{
  "name": "@harness/plugins",
  "exports": {
    ".": "./src/index.ts",
    "./cron": "./src/cron/index.ts",
    "./discord": "./src/discord/index.ts",
    "./identity": "./src/identity/index.ts"
  }
}
```

Consumers can then write:
```typescript
import { cronPlugin } from "@harness/plugins/cron";
import { identityPlugin } from "@harness/plugins/identity";
```

Key properties:
- Undefined subpaths throw `ERR_PACKAGE_PATH_NOT_EXPORTED` — you explicitly control the public surface
- Wildcard patterns (`"./plugins/*": "./src/plugins/*.ts"`) handle many entry points without listing each
- **Breaking change warning**: Adding `exports` to a package that didn't have it is a breaking change — it restricts access to only the listed subpaths

**TypeScript support for `exports`:**

TypeScript resolves the `"types"` condition inside `exports` to find `.d.ts` files. For Just-in-Time (no-build) packages, you point `"types"` directly at the `.ts` source:

```json
{
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./cron": {
      "types": "./src/cron/index.ts",
      "default": "./src/cron/index.ts"
    }
  }
}
```

**TypeScript version requirement:** `moduleResolution` must be set to `"node16"`, `"nodenext"`, or `"bundler"` (not `"node"`) for TypeScript to honor the `exports` field. With `"node"` resolution, the `exports` field is ignored.

**Source (SECONDARY):** https://github.com/andrewbranch/example-subpath-exports-ts-compat

Three fallback strategies exist for TypeScript consumers on older `moduleResolution` settings:
1. **Extensionless** exports — works via older resolver fallback
2. **Package-json redirects** — per-subpath `package.json` files in subdirectories
3. **`typesVersions` wildcards** — TypeScript-only solution using `typesVersions` field as a parallel map of `exports`

For an internal monorepo (not published to npm), compatibility with older resolvers is irrelevant — you control the `tsconfig.json` settings for all consumers.

---

### 2. The "Single Package, Multiple Entry Points" Pattern

**Source (PRIMARY):** https://turborepo.dev/repo/docs/guides/tools/typescript
**Source (PRIMARY):** https://nodejs.org/api/packages.html#subpath-exports

This pattern collapses what would be 14 separate npm packages into one package with 14 entry points. The key Turborepo concept enabling this is **Just-in-Time (JIT) packages**.

A JIT package is defined by Turborepo as:
> "A TypeScript package without a separate build step, where both `types` and `main` fields in `package.json` point to the package's untranspiled entry point."

**Example structure for a consolidated `@harness/plugins` package:**

```
packages/plugins/
  package.json          ← single package.json with exports map
  src/
    index.ts            ← re-exports core types only
    cron/
      index.ts
      _helpers/
    identity/
      index.ts
      _helpers/
    discord/
      index.ts
```

```json
{
  "name": "@harness/plugins",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./cron": {
      "types": "./src/cron/index.ts",
      "default": "./src/cron/index.ts"
    },
    "./identity": {
      "types": "./src/identity/index.ts",
      "default": "./src/identity/index.ts"
    }
  }
}
```

Consumers use: `import { cronPlugin } from "@harness/plugins/cron"`

**Go-to-definition behavior:** Since the `types` condition points to `.ts` source, editors navigate directly to source — same as separate packages with `declarationMap` enabled.

**Barrel file caveat:** This pattern can create barrel files at `src/cron/index.ts` that aggregate sub-module exports. The existing `test:coverage-gate` enforces no barrel files (files that only contain re-exports). A barrel file that also contains implementation logic or is a single-file module is not a barrel — only pure re-export files are rejected. This needs verification against the actual coverage gate implementation before adopting this pattern.

---

### 3. TypeScript Path Aliases (`paths` in tsconfig.json)

**Source (PRIMARY):** https://raw.githubusercontent.com/microsoft/TypeScript-Website/v2/packages/tsconfig-reference/copy/en/options/paths.md

The `paths` option in `tsconfig.json` allows remapping import paths to different file locations:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@harness/plugin-cron": ["./packages/plugins/cron/src/index.ts"],
      "@harness/plugin-identity": ["./packages/plugins/identity/src/index.ts"]
    }
  }
}
```

**Critical limitation (officially documented):**
> "This feature does not change how import paths are emitted by `tsc`, so `paths` should only be used to inform TypeScript that another tool has this mapping and will use it at runtime or when bundling."

`paths` is **compile-time only**. TypeScript uses it to resolve types but does not rewrite import paths in the emitted JavaScript. A bundler (esbuild, Webpack, Vite, Next.js transpilePackages) must also be configured with the same mappings to resolve imports at runtime.

**How it differs from project references:**

| Dimension | `paths` aliases | Project References (`references`) |
|-----------|----------------|----------------------------------|
| Purpose | Alias module names for type resolution | Separate compilation units with explicit dependency graph |
| Build step | Not required — just type resolution | Each referenced project must have `composite: true` and be built |
| Incremental builds | No — single build step for everything | Yes — `tsc -b` builds only what changed |
| Turborepo integration | Does not give Turbo per-package cache boundaries | Each project reference = cacheable unit |
| Configuration overhead | Low (one tsconfig entry) | High (each package needs composite tsconfig) |
| Turbo recommendation | Prefer this over project references | **Explicitly not recommended** |

**Turborepo's explicit recommendation (PRIMARY source):**
> "We don't recommend using TypeScript Project References as they introduce both another point of configuration as well as another caching layer [with] little benefit."
> — https://turborepo.dev/repo/docs/guides/tools/typescript

`paths` aliases are lightweight but only give logical separation — no separate build outputs, no Turborepo cache boundaries between the aliased modules. They are suitable when the consuming application handles transpilation (e.g., Next.js with `transpilePackages`).

---

### 4. Turborepo Task Graph Overhead with 16+ Packages

**Source (PRIMARY):** https://turborepo.dev/repo/docs/core-concepts/package-and-task-graph
**Source (PRIMARY):** https://turborepo.dev/repo/docs/core-concepts/caching

**How the task graph is constructed:**

Turborepo builds a directed acyclic graph (DAG) from two layers:
1. **Package Graph**: Derived automatically from `package.json` dependency fields across all workspace packages
2. **Task Graph**: Defined in `turbo.json`, with nodes = tasks and edges = inter-task dependencies

**Caching cost per package:**

Each package contributes two hash inputs on every run:
- **Global hash**: lockfile, root turbo.json, `globalDependencies` files, `globalEnv` values, CLI flags — computed once per run
- **Per-package task hash**: package files (all by default), package `package.json`, package-specific lockfile entries

With 16 packages each running 4 tasks (build, typecheck, lint, test), that is 64 task nodes in the graph and 64 separate hash computations on each run. Each hash computation involves file system reads.

**Official documentation on overhead:** The Turborepo docs do **not** document specific task graph construction overhead benchmarks or warn about package count limits. The documentation claims "dramatic performance gains" (110-140s → 80ms with caching) and focuses on cache hit rates as the primary performance lever. No documented upper limit on package count was found.

**Indirect evidence from filtering docs (PRIMARY):** https://turborepo.dev/repo/docs/core-concepts/monorepos/filtering

The documentation emphasizes that filtering (`--filter`) reduces unnecessary work by running tasks only for affected packages and their dependencies. This implies that with many packages, unfiltered runs do traverse the full graph. Remote caching is positioned as the main mitigation for large repositories.

**Practical assessment (MEDIUM confidence, inferred from docs):**
- The overhead is in cache hash computation (file reads) and graph construction at startup
- For 16-20 packages this is likely sub-second overhead
- The Turborepo docs describe use in repositories with "thousands of tasks" without flagging package count as a limiting factor
- No GitHub issues found documenting package count performance degradation at the 16-20 package scale

---

### 5. "Virtual Packages" / "Namespace Packages" — Logical Separation Without `package.json`

**Source (PRIMARY):** https://turborepo.dev/repo/docs/guides/tools/typescript
**Source (TERTIARY, TC39):** Module Fragments proposal (Stage 1) — https://github.com/nicolo-ribaudo/proposal-module-fragments

Three real-world patterns exist for logical separation without a separate `package.json` per module:

**Pattern A: Node.js subpath `imports` field (Turborepo-recommended)**

The `imports` field in `package.json` (distinct from `exports`) provides package-internal path aliases. Turborepo's TypeScript guide recommends this as the primary approach:

```json
{
  "imports": {
    "#cron/*": "./src/cron/*",
    "#identity/*": "./src/identity/*"
  }
}
```

Consumers inside the same package write: `import { foo } from "#cron/index.ts"`

This is pure logical separation — one `package.json`, one Turborepo package node, but imports are namespaced. No separate build step per module.

**Pattern B: Directory structure + path aliases in consuming tsconfig**

No `package.json` at all for sub-modules. One package with a flat directory structure, and the consuming app's `tsconfig.json` maps logical names to directories. This requires bundler cooperation (Next.js `transpilePackages`, or similar).

**Pattern C: `exports` wildcard for namespace-like entry points**

```json
{
  "exports": {
    "./plugins/*": "./src/plugins/*/index.ts"
  }
}
```

Gives `import { foo } from "@harness/core/plugins/cron"` without listing every entry point.

**TC39 Module Fragments (Stage 1):** This proposal enables multiple ES modules in a single file, addressing bundler virtualization overhead. It does **not** address virtual package or namespace patterns at the package.json level — it is a language-level bundling optimization, not a module system organizational tool.

---

### 6. pnpm `workspace:*` Protocol with Source-Only Packages

**Source (PRIMARY):** https://pnpm.io/workspaces

**How `workspace:*` works:**

`workspace:*` instructs pnpm to refuse resolution from the npm registry and use only the local workspace package. When the package is published, pnpm transforms `"@harness/plugin-cron": "workspace:*"` → `"@harness/plugin-cron": "1.0.0"` (actual version) automatically.

For internal packages never published to npm (all harness plugins), `workspace:*` is the correct protocol — it makes the dependency local-only and symlinks the package into consuming packages' `node_modules`.

**Symlinking behavior:** pnpm symlinks the entire package directory into `node_modules`. The symlink points to the actual package directory. This means:
- For source-only packages (no `dist/`), the `main` and `types` fields in `package.json` should point to `.ts` source files
- TypeScript (with `moduleResolution: bundler` or `node16`) resolves the `types` field from the symlinked package and navigates to the source
- No build step is needed — pnpm's symlink gives the consuming package direct access to the source files

**`linkWorkspacePackages` setting:** Defaults to `false` — pnpm uses the registry unless the `workspace:` protocol is explicitly used. Setting it to `true` symlinks all matching local packages even without `workspace:` prefix.

**No-build packages with `workspace:*` in pnpm — what actually happens:**

When package A declares `"@harness/plugin-cron": "workspace:*"`:
1. pnpm symlinks `packages/plugins/cron` → `apps/orchestrator/node_modules/@harness/plugin-cron`
2. The consuming package reads `package.json` from the symlinked directory
3. If `main` and `types` point to `./src/index.ts`, TypeScript resolves types from source
4. Node.js at runtime also resolves through the same `main` field — so the consuming app's bundler/transpiler handles the `.ts` file

**`injectWorkspacePackages` (hard-link mode):** Available as an alternative to symlinks. Uses hard links instead, which is more compatible with tools that don't follow symlinks (Docker, some test runners). Does not affect TypeScript resolution.

**Key constraint:** The consuming app must be able to transpile TypeScript from the workspace package. For Next.js, this requires `transpilePackages: ["@harness/plugin-cron"]` in `next.config.ts`. The orchestrator (Node.js, no bundler) needs `ts-node` or `esbuild` to handle `.ts` imports from workspace packages.

---

## Key Takeaways

### For the Harness monorepo specifically:

1. **The "single package, multiple entry points" pattern is viable** for consolidating plugin packages. All 14 plugins could live in a single `@harness/plugins` package with the `exports` field mapping each plugin to a subpath. This reduces 14 separate Turborepo nodes to 1.

2. **Turborepo officially recommends against project references** — the JIT pattern with `moduleResolution: bundler` or `node16` and source-pointing `exports` is the preferred approach.

3. **`paths` aliases alone are insufficient** for runtime resolution in the orchestrator (Node.js without a bundler) — they only affect TypeScript's type checker. The `exports` field + pnpm `workspace:*` symlinks handles runtime resolution.

4. **Turborepo does not document 16-package overhead as a concern** — the task graph overhead at this scale is likely negligible. Caching effectiveness (cache hit rate) is the dominant performance factor, not graph size.

5. **The `imports` field is the right tool for intra-package logical separation** — it gives named subpaths within a single package without creating additional Turborepo nodes or package.json files.

6. **Barrel file constraint is the key risk** for the consolidated pattern — `src/cron/index.ts` that re-exports everything from `_helpers/` would be a barrel file and would be rejected by the coverage gate. Each entry point must either be a single implementation file or a file with mixed imports and logic, not a pure re-export aggregator.

### Architecture decision matrix:

| Approach | Turborepo nodes | Build step needed | Runtime resolution | TS go-to-def | Turbo recommendation |
|----------|----------------|-------------------|-------------------|--------------|---------------------|
| Current (14 separate packages) | 14 | No (JIT) | workspace:* symlinks | Yes (types → src) | Supported |
| Single package + exports map | 1 | No (JIT) | exports field | Yes (types → src) | Supported |
| paths aliases only | 14 → 1 tsconfig | No | Bundler must also support | Yes | Supported |
| Project references | 14 | Yes (tsc -b) | Built dist/ | Yes (declarationMap) | **Not recommended** |

---

## Sources

### PRIMARY (official documentation)
- https://nodejs.org/api/packages.html#exports — Node.js packages documentation, exports field
- https://nodejs.org/api/esm.html#resolution-and-loading-algorithm — Node.js ESM resolution algorithm
- https://raw.githubusercontent.com/microsoft/TypeScript-Website/v2/packages/tsconfig-reference/copy/en/options/paths.md — TypeScript tsconfig `paths` option reference (official source)
- https://turborepo.dev/repo/docs/guides/tools/typescript — Turborepo TypeScript guide (JIT packages, project references warning)
- https://turborepo.dev/repo/docs/core-concepts/package-and-task-graph — Turborepo task graph documentation
- https://turborepo.dev/repo/docs/core-concepts/caching — Turborepo caching mechanics
- https://turborepo.dev/repo/docs/crafting-your-repository/structuring-a-repository — Turborepo repository structure guide
- https://turborepo.dev/repo/docs/crafting-your-repository/managing-dependencies — Turborepo dependency management
- https://turborepo.dev/blog/you-might-not-need-typescript-project-references — Turborepo blog: internal packages pattern
- https://pnpm.io/workspaces — pnpm workspace documentation

### SECONDARY (authoritative community/ecosystem)
- https://github.com/andrewbranch/example-subpath-exports-ts-compat — TypeScript + subpath exports compatibility strategies (by Andrew Branch, TypeScript team member)

### TERTIARY (proposals / emerging standards)
- Module Fragments TC39 proposal (Stage 1) — https://github.com/nicolo-ribaudo/proposal-module-fragments — does NOT address package-level virtual namespaces
