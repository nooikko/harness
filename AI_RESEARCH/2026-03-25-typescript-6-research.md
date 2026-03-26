# Research: TypeScript 6.0

Date: 2026-03-25

## Summary

TypeScript 6.0 was officially released on March 23, 2026. It is the **final major version built on the JavaScript codebase**, serving as a bridge to TypeScript 7.0 (a native Go rewrite). The release focuses on deprecating legacy configuration, modernizing defaults, and introducing the `--stableTypeOrdering` flag to preview TS 7.0 behavior.

The harness project currently uses `"typescript": "^5.9.3"`. Upgrading to 6.0 requires tsconfig changes (especially `types: []` default and `strict: true` default), but a migration tool exists (`ts5to6`) and community reports cite 95% compatibility with modern codebases.

## Prior Research

None — first TypeScript 6.0 research file.

## Current Findings

### 1. Release Status

- **Current stable version:** `6.0.2` (released March 23, 2026)
- **npm dist-tag `latest`:** `6.0.2` (confirmed via `npm view typescript@latest version`)
- **npm `engines` field:** `{ "node": ">=14.17" }` (confirmed via `npm view typescript@6 engines`)
- **Release path:** Beta (Feb 11) → RC (March 6) → GA (March 23)
- **Source:** [TypeScript Blog](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [GitHub Releases](https://github.com/microsoft/TypeScript/releases)

### 2. Headline Features

**Language additions:**
- `es2025` target and lib (floats with current year going forward)
- Temporal API type definitions (Stage 3 proposal, browser support in Firefox 139+, Chrome 144+; Safari not yet)
- `Map.getOrInsert()` and `Map.getOrInsertComputed()` methods
- `RegExp.escape()` support
- Subpath imports starting with `#/` (Node.js alignment)
- ES2025 built-in APIs

**Type system improvements:**
- Improved type inference for `this`-less functions (no longer contextually sensitive when `this` is unused)
- Better type inference for method syntax in generic contexts
- `--stableTypeOrdering` flag to preview TypeScript 7.0 union type ordering behavior
- Reduced context sensitivity in generic JSX expressions

**Performance claim (tsconfig-driven, not compiler architecture):**
- The official blog claims "20-50% build time improvement" — but this is **not from architectural changes**. It comes entirely from the `types: []` default change preventing unnecessary `@types/*` package scanning. The performance gain disappears if you explicitly set `types: ["node", "jest", ...]` (which most projects need to).
- No native compiler architecture changes were made in 6.0. Those are coming in TypeScript 7.0 (Go rewrite, multi-threading, claimed 10x speedup).
- Incremental build improvement in `--watch` mode: ~25% in monorepos (community reports, confidence: LOW).

### 3. Breaking Changes (Complete List)

**Default value changes (silent breaking changes if tsconfig was relying on old defaults):**

| Option | Old default | New default |
|--------|------------|-------------|
| `strict` | `false` | `true` |
| `module` | CommonJS | `esnext` |
| `target` | `es5` (or `es3`) | `es2025` |
| `types` | auto-include all `@types/*` | `[]` (empty array) |
| `rootDir` | inferred from source files | directory containing `tsconfig.json` |
| `noUncheckedSideEffectImports` | `false` | `true` |
| `libReplacement` | `true` | `false` |
| `esModuleInterop` | configurable | always `true` (cannot be disabled) |
| `allowSyntheticDefaultImports` | configurable | always `true` (cannot be disabled) |
| `moduleResolution` | `node10` (when `module: commonjs`) | `bundler` |

**Completely removed options (hard errors):**

- `--module amd` — removed entirely
- `--module umd` — removed entirely
- `--module systemjs` — removed entirely
- `--module none` — removed
- `--moduleResolution classic` — removed
- `--outFile` — removed (use external bundlers)

**Deprecated options (emit warning; set `"ignoreDeprecations": "6.0"` to silence; will be hard errors in TS 7.0):**

- `target: es5` — minimum is now `es2015`
- `--downlevelIteration` — only worked with ES5
- `--moduleResolution node` (node10) — use `nodenext` or `bundler`
- `--baseUrl` — no longer acts as module resolution root; inline into `paths` entries
- `--alwaysStrict: false` — strict mode now enforced
- Legacy `module Foo {}` namespace syntax — use `namespace` keyword
- `import ... assert { }` syntax — replaced by `import ... with { }`
- `/// <reference no-default-lib="true"/>` directive — use `--noLib` flag

**Behavioral changes:**

- `esModuleInterop` and `allowSyntheticDefaultImports` are now always enabled; setting them to `false` no longer has any effect
- `"use strict"` is always emitted in non-ESM output files
- Default imports must now use `__importDefault` helpers (CJS interop runtime behavior change)
- Union member ordering in `.d.ts` files may differ (use `--stableTypeOrdering` to preview TS 7.0 behavior)
- Projects with both tsconfig.json and CLI-specified files will now error (use `--ignoreConfig`)

**Common symptoms after upgrade:**
- "Cannot find module 'fs'" or similar Node built-in errors → fix: add `"types": ["node"]`
- Output files nested by an extra level → fix: explicitly set `"rootDir": "./src"`
- New type errors from implicit `any` → strict mode is now on
- Side-effect imports fail type-checking → `noUncheckedSideEffectImports: true`

### 4. Minimum Node.js Version

- **Official `engines` field:** `{ "node": ">=14.17" }` (confirmed from npm registry)
- This is unchanged from TypeScript 5.x. No Node.js version bump in 6.0.
- Note: The harness project already requires Node >= 22 (from CLAUDE.md), so this is not a constraint.

### 5. tsconfig Changes Summary

**New options:**
- `--stableTypeOrdering` — enables TS 7.0 union member ordering behavior (opt-in for migration)
- `"ignoreDeprecations": "6.0"` — silences deprecation warnings (escape hatch)

**Options with changed defaults:** (see table in section 3)

**Removed options:** (see list in section 3)

**Migration tool:** `ts5to6` ([github.com/andrewbranch/ts5to6](https://github.com/andrewbranch/ts5to6)) — automates `baseUrl` removal and `rootDir` migration.

### 6. Ecosystem Compatibility

#### Next.js 16

- **Compatibility: COMPATIBLE** (Confidence: HIGH)
- Next.js 16 (current: 16.2.1) states minimum TypeScript version `5.1.0` in its upgrade guide.
- TypeScript 6 is above that minimum threshold.
- The Vercel/Next.js team has a GitHub Discussion ([#81472](https://github.com/vercel/next.js/discussions/81472)) about `typescript-go` support, indicating awareness of the TS 6/7 transition.
- Source: [Next.js v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)

#### Prisma 6

- **Compatibility: COMPATIBLE** (Confidence: HIGH)
- Prisma 6 requires minimum TypeScript `4.7+` (from the system requirements reference page)
- TypeScript 6 exceeds this minimum
- No TypeScript 6 incompatibilities found in Prisma 6 release notes or issues
- Source: [Prisma system requirements](https://www.prisma.io/docs/orm/reference/system-requirements)

#### Biome

- **Compatibility: UNKNOWN / LIKELY PARTIAL** (Confidence: LOW)
- Biome's language support page states: "Biome supports TypeScript version 5.9."
- This phrasing is ambiguous — it may mean 5.9 is the latest tested version, not that it blocks 6.0
- Biome is a **formatter and linter** (not a type-checker), so it parses TypeScript syntax but ignores type semantics. The risk is new TypeScript 6.0 syntax (`import ... with {}`, new `es2025` features) not yet in Biome's parser.
- No TypeScript 6.0-specific Biome issue found in searches; 2026 roadmap does not mention TS 6 support.
- Current Biome version: v2.x (Biome v2 "Biotype" released June 2025)
- Source: [Biome language support](https://biomejs.dev/internals/language-support/), [Biome v2 announcement](https://biomejs.dev/blog/biome-v2/)
- **Action required:** Verify no parse errors occur with `"ignoreDeprecations": "6.0"` or with the new `with` import syntax. Check [Biome releases](https://github.com/biomejs/biome/releases) for TS 6.0 parser tracking.

#### Vitest

- **Compatibility: LIKELY COMPATIBLE** (Confidence: MEDIUM)
- Vitest uses Vite's ESM pipeline and Vite-based transforms (esbuild/SWC) rather than `tsc` directly
- Vitest 4.x is the current stable (v4.1.1 as of March 2026)
- No TypeScript 6-specific Vitest issues found; no incompatibility reports in searches
- Vitest's peerDependency is on `typescript` optionally, not requiring a specific major version
- Source: [Vitest releases](https://github.com/vitest-dev/vitest/releases)

#### Turborepo

- **Compatibility: LIKELY COMPATIBLE** (Confidence: MEDIUM)
- Turborepo is a task runner that delegates to `tsc` for type-checking; it does not parse TypeScript itself
- No TypeScript 6-specific Turborepo issues found
- Turborepo is maintained by Vercel (same team as Next.js), which already has TS 6 awareness
- Source: Indirect (no dedicated TS 6 Turborepo announcement found)

#### esbuild

- **Compatibility: LIKELY COMPATIBLE** (Confidence: MEDIUM)
- esbuild strips TypeScript type annotations without type-checking; it does not run `tsc`
- esbuild only needs to parse new TypeScript syntax, not understand type semantics
- Risk area: New TS 6.0 syntax (`import ... with {}` import attributes) — esbuild has historically tracked these quickly
- Note: The `import ... assert {}` → `import ... with {}` migration in TS 6 may require esbuild version alignment
- Source: [esbuild TypeScript support](https://github.com/evanw/esbuild/issues/923)

#### SWC (used by Next.js/Turbopack for transforms)

- **Compatibility: LIKELY COMPATIBLE** (Confidence: MEDIUM)
- SWC maintainers state they keep TypeScript support current with stable releases
- Community report: SWC + TypeScript 6 + Turbopack combination reportedly provides dramatic build speedups (one report: 2.5 min → 9 seconds on a large Next.js project)
- Source: [SWC TypeScript discussion](https://github.com/swc-project/swc/discussions/7814)

## Key Takeaways

1. **TypeScript 6.0.2 is released and stable** as of March 23, 2026. The harness project is currently on `^5.9.3`.

2. **The claimed ~30% performance improvement is misleading** — it comes from the `types: []` default change, not from compiler architecture work. Real-world gain depends entirely on how many `@types/*` packages were being auto-discovered. TypeScript 7.0 (Go rewrite) is where the 10x architectural gains will come.

3. **The `types: []` default change is the most impactful breaking change for this project.** With `noUncheckedIndexedAccess` and `noFallthroughCasesInSwitch` already set in harness tsconfig, and `"strict": true` likely already set, the `types` change is the main hazard — `@types/node` would need explicit declaration.

4. **`strict: true` becoming the default is a non-issue for harness** since the project already uses strict TypeScript with `noUncheckedIndexedAccess`.

5. **Migration is straightforward for modern projects.** The automated `ts5to6` tool handles the most disruptive changes. Community reports 95% compatibility with TypeScript 5.x code.

6. **Biome is the highest-risk ecosystem dependency** — its documented support caps at TS 5.9, and it's unknown whether new TS 6 syntax is in its parser.

7. **The `ignoreDeprecations: "6.0"` escape hatch exists** for teams that need time to migrate away from deprecated options.

## Sources

- [Announcing TypeScript 6.0 (Official Blog)](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Announcing TypeScript 6.0 RC (Official Blog)](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0-rc/)
- [6.0 Migration Guide Issue #62508 (GitHub)](https://github.com/microsoft/TypeScript/issues/62508)
- [TypeScript 5.x to 6.0 Migration Guide (Community Gist)](https://gist.github.com/privatenumber/3d2e80da28f84ee30b77d53e1693378f)
- [npm registry: typescript@6](https://www.npmjs.com/package/typescript) — `engines: { node: ">=14.17" }`, version `6.0.2`
- [Next.js v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Prisma system requirements](https://www.prisma.io/docs/orm/reference/system-requirements)
- [Biome language support](https://biomejs.dev/internals/language-support/)
- [Biome 2026 roadmap](https://biomejs.dev/blog/roadmap-2026/)
- [Biome v2 announcement](https://biomejs.dev/blog/biome-v2/)
- [Vitest releases](https://github.com/vitest-dev/vitest/releases)
- [TypeScript 6.0 Ships (Visual Studio Magazine)](https://visualstudiomagazine.com/articles/2026/03/23/typescript-6-0-ships-as-final-javascript-based-release-clears-path-for-go-native-7-0.aspx)
- [InfoWorld TypeScript 6.0 arrives](https://www.infoworld.com/article/4149659/typescript-6-0-arrives.html)
- [Should You Upgrade — BSWEN](https://docs.bswen.com/blog/2026-02-21-typescript-60-upgrade-decision/)
- [byteiota TypeScript 6.0 RC Breaking Changes](https://byteiota.com/typescript-6-0-rc-temporal-api-and-breaking-changes/)
