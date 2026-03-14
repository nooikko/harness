# Research: tsup / esbuild Workspace Bundling — Inlining Plugins at Build Time

Date: 2026-03-14

## Summary

tsup's `noExternal` option and esbuild's bundling machinery both support inlining workspace packages into a consuming application's bundle, eliminating the need for those packages to have their own build step. The mechanism works correctly with pnpm workspace symlinks and TypeScript source files — the bundler follows the symlink, reads the `.ts` files, and compiles them inline. Turborepo calls packages with no build script "transit nodes" and silently skips them in the task graph. This is a documented, production-used pattern (Turborepo's own example monorepo uses it for `@repo/ui`). Key caveat: tsup is no longer actively maintained; the recommended successor is tsdown.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-13-turborepo-internal-packages.md` — transit node behavior, JIT packages, ^build graph traversal
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-14-turborepo-per-package-task-config.md` — per-package turbo.json, transit node quotes from official docs
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-13-monorepo-package-consolidation-patterns.md` — relevant if it exists

## Current Findings

---

### 1. tsup `noExternal` Option

**Confidence: HIGH**

**Sources:**
- https://jsdocs.io/package/tsup#Options (PRIMARY — official API docs)
- https://raw.githubusercontent.com/egoist/tsup/main/test/index.test.ts (PRIMARY — official test suite)

#### Definition

From the tsup API docs:

```typescript
noExternal?: (string | RegExp)[]
```

**Description:** "Always bundle modules matching given patterns"

This is the inverse of the `external` option. While `external` prevents modules from being bundled, `noExternal` forces modules to be included in the bundle even when they would otherwise be externalized.

#### How It Works with Workspace Packages

The official test suite (`test/index.test.ts`) contains a direct test demonstrating the behavior:

```typescript
test('noExternal are respected when skipNodeModulesBundle is true', async () => {
  const { output } = await run(getTestName(), {
    'input.ts': `export {foo} from 'foo'
    export {bar} from 'bar'
    export {baz} from 'baz'`,
    'node_modules/foo/index.ts': `export const foo = 'foo'`,
    'node_modules/foo/package.json': `{"name":"foo","version":"0.0.0"}`,
    // ...
    'tsup.config.ts': `
    export default {
      skipNodeModulesBundle: true,
      noExternal: [/foo/]
    }
    `,
  })
  expect(output).toContain('var foo = "foo"')   // bundled inline
  expect(output).not.toContain('var bar = "bar"') // kept external
})
```

**Key observations from the test:**
- `node_modules/foo/index.ts` is a TypeScript source file — tsup (via esbuild) compiles it inline without any pre-build step
- The pattern can be a RegExp (e.g., `/foo/`) — so `noExternal: [/@harness\/plugin-.*/]` would match all plugin packages
- `skipNodeModulesBundle: true` is the companion option that externals all node_modules by default; `noExternal` carves out exceptions

#### Practical Configuration for the Orchestrator

```typescript
// apps/orchestrator/tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node22',
  platform: 'node',
  bundle: true,
  skipNodeModulesBundle: true,       // external all node_modules by default
  noExternal: [/@harness\/plugin-.*/], // inline all @harness/plugin-* packages
})
```

#### pnpm Workspace Symlinks

From GitHub issue #1334 in the tsup repository, a user reported successfully building with:

```json
noExternal: ["@workspace/validators"]
```

...where the package was symlinked via pnpm workspace. The build succeeded — tsup/esbuild correctly follows pnpm symlinks to the actual source files. The only issue reported was with `watch` mode (rebuilds not triggering on symlinked file changes), which is separate from the build itself.

Source: https://github.com/egoist/tsup/issues/1334 (SECONDARY — community issue, resolved/closed)

The underlying esbuild behavior with pnpm symlinks is well-established. From GitHub issue #67 in evanw/esbuild (resolved in 2020): esbuild resolves symlinked node_modules to their real filesystem location. pnpm creates symlinks at `node_modules/@workspace/validators` pointing to the actual location in `node_modules/.pnpm/...`. esbuild resolves to the real path, finds the package, and bundles it.

Source: https://github.com/evanw/esbuild/issues/67 (PRIMARY — esbuild maintainer response)

#### TypeScript Source File Resolution

When a workspace package has `"main": "./src/index.ts"` (or uses `exports` pointing to `.ts`), esbuild follows the `main` field and encounters a `.ts` file. esbuild's default loaders include `.ts` → TypeScript loader. It compiles the file inline.

From esbuild content-types documentation:
> "The `ts` or `tsx` loaders are enabled by default for `.ts`, `.tsx`, `.mts`, and `.cts` files. esbuild parses TypeScript syntax and discards the type annotations."

Source: https://esbuild.github.io/content-types/#typescript (PRIMARY — official esbuild docs)

Additionally, from the esbuild `mainFields` documentation: "esbuild automatically discovers and reads `tsconfig.json` files during builds," meaning TypeScript configuration from the workspace package's own `tsconfig.json` is respected during inline bundling.

Source: https://esbuild.github.io/api/#main-fields (PRIMARY — official esbuild docs)

---

### 2. esbuild Direct Usage (Without tsup)

**Confidence: HIGH**

#### `--bundle` with selective `--external`

esbuild's bundling model is simple: bundle everything by default, then mark specific packages as external to exclude them.

**To inline workspace packages while externalizing npm dependencies:**

```bash
# Externalize specific packages but NOT @harness/* workspace packages
esbuild apps/orchestrator/src/index.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --external:prisma \
  --external:@prisma/client \
  --external:@anthropic-ai/claude-agent-sdk \
  --outfile=dist/index.js
```

**Or use `--packages=external` to external all node_modules, then use a plugin to re-include workspace packages:**

```javascript
// build.js
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  // Mark all node_modules external except workspace packages
  external: ['prisma', '@prisma/client', '@anthropic-ai/*', 'discord.js', ...],
  outfile: 'dist/index.js',
})
```

**Important distinction:** `--packages=external` externalizes ALL packages (by matching `node_modules` in the resolved path). This would incorrectly external pnpm workspace packages because pnpm also stores them in `node_modules`. You would need explicit `--external:*` flags for non-workspace packages instead.

Source: https://esbuild.github.io/getting-started/#bundling-for-node (PRIMARY — official docs)
Source: https://esbuild.github.io/api/#bundle (PRIMARY — official docs)

#### Using esbuild `conditions` for Source Resolution

For workspace packages that use the `exports` field with a custom `"source"` condition:

```javascript
await esbuild.build({
  conditions: ['source', 'node', 'require'],
  // ...
})
```

This tells esbuild to prefer the `"source"` export condition, which packages may point to TypeScript source files. This is an advanced pattern not required if packages already point `.ts` files in their `"main"` or primary `"exports"` entries.

Source: https://esbuild.github.io/api/#conditions (PRIMARY — official esbuild docs)

---

### 3. Do Plugins Need Their Own Build Script When the Orchestrator Bundles Them?

**Confidence: HIGH**

**Answer: NO — the plugins do not need a `build` script.**

The orchestrator's bundler (tsup/esbuild) compiles the plugin TypeScript source inline. The plugins only need their source files and a valid `package.json` with either:
- `"main": "./src/index.ts"` pointing to TypeScript source, OR
- `"exports": { ".": "./src/index.ts" }` with TypeScript source

No `build` script, no `dist/` directory, no pre-compilation step.

#### Plugins CAN Still Have Independent Scripts

The absence of a `build` script does not prevent plugins from having other scripts:

```json
{
  "name": "@harness/plugin-identity",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "test": "vitest run"
  }
}
```

These scripts run independently via `turbo typecheck`, `turbo lint`, `turbo test`. They do not depend on a build step.

#### Turborepo Task Graph: Transit Node Behavior

When a plugin has no `build` script and the orchestrator's `turbo.json` has `"build": { "dependsOn": ["^build"] }`:

The plugin becomes a **Transit Node**. From the official Turborepo docs:

> "Turborepo calls the `ui` package a Transit Node in this scenario, because it doesn't have its own `build` script."
> "Turborepo won't execute anything for it, but it's still part of the graph for the purpose of including its own dependencies."

Source: https://turborepo.dev/repo/docs/core-concepts/package-and-task-graph (PRIMARY)

This is documented, automatic behavior. No `turbo.json` changes are needed in the plugin packages. The orchestrator's build runs once all actual upstream build dependencies complete (which is zero in this case — the plugins have no builds). The graph resolves immediately to the orchestrator's own build.

Full prior research on transit nodes: `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-14-turborepo-per-package-task-config.md`

---

### 4. TypeScript Resolution: `"main": "./src/index.ts"` Pattern

**Confidence: HIGH**

#### esbuild Behavior

esbuild follows the `main` field in `package.json` during module resolution. When it finds a `.ts` file, the TypeScript loader activates automatically (`.ts` extension triggers the `ts` loader by default). The file is compiled inline as part of the bundle.

From the esbuild content types documentation:
> "The `ts` or `tsx` loaders are enabled by default for `.ts`, `.tsx`, `.mts`, and `.cts` files."

Source: https://esbuild.github.io/content-types/#typescript (PRIMARY)

#### TypeScript's `tsconfig.json` Configuration for Source Exports

When the package exports TypeScript source directly, the `tsconfig.json` of the consuming bundler (not the plugin) handles type checking. The plugin's own `tsconfig.json` is used for the plugin's own `tsc --noEmit` typecheck run.

For workspace packages that export source, the recommended `tsconfig.json` pattern (per Turborepo docs) is:

```json
// Plugin package tsconfig.json
{
  "compilerOptions": {
    "composite": false,
    "noEmit": true
  }
}
```

`"composite": false` and `"noEmit": true` indicate the package is not producing compiled output — it is consumed by the bundle.

Source: https://turborepo.dev/repo/docs/guides/tools/typescript (PRIMARY)

#### pnpm Workspace Symlink Resolution Path

When esbuild encounters `import { plugin } from "@harness/plugin-cron"`:
1. Looks in `node_modules/@harness/plugin-cron`
2. pnpm has created a symlink there pointing to `packages/plugins/cron`
3. esbuild resolves the symlink to the real path: `packages/plugins/cron`
4. Reads `packages/plugins/cron/package.json`, finds `"main": "./src/index.ts"`
5. Follows the path to `packages/plugins/cron/src/index.ts`
6. Applies the TypeScript loader, compiles inline

This chain is confirmed by esbuild issue #67 (symlink resolution with pnpm) and the content-types documentation (`.ts` loader enabled by default).

---

### 5. Real-World Examples: Turborepo Monorepos with JIT/Source-Export Libraries

**Confidence: HIGH**

#### Official Turborepo `examples/basic`

The canonical Turborepo basic example uses the Just-in-Time pattern for its `@repo/ui` package.

From the `@repo/ui` package.json:
```json
{
  "exports": {
    "./*": "./src/*.tsx"
  },
  "scripts": {
    "lint": "...",
    "check-types": "..."
  }
}
```

**No `build` script.** The `exports` field points directly to TypeScript source (`.tsx` files). The consuming apps (`web`, `docs`) are Next.js apps that use Turbopack/webpack to compile the TypeScript source inline.

Source: `https://raw.githubusercontent.com/vercel/turborepo/main/examples/basic/packages/ui/package.json` (PRIMARY — official Turborepo example)

The consuming `apps/web/package.json` references `"@repo/ui": "workspace:*"` as a dependency. The root `turbo.json` has `"build": { "dependsOn": ["^build"] }` but since `@repo/ui` has no `build` script, it is a transit node and the apps build without waiting for any `@repo/ui` build step.

Source: `https://raw.githubusercontent.com/vercel/turborepo/main/apps/web/package.json`, `https://raw.githubusercontent.com/vercel/turborepo/main/turbo.json` (PRIMARY)

This is the exact same pattern proposed for the harness orchestrator: a consuming app (orchestrator) with a build step, and library packages (plugins) with no build step.

---

### 6. Package Isolation Guarantee

**Confidence: HIGH**

**Answer: YES — package isolation is preserved.**

When the orchestrator bundles plugins inline using `noExternal`, the plugins remain distinct packages in the monorepo:
- Each plugin has its own `package.json`, `tsconfig.json`, and source files
- TypeScript still enforces import boundaries: if a plugin tries to import from the orchestrator, TypeScript will error because the orchestrator is not in the plugin's `dependencies`
- The pnpm workspace structure enforces that plugins import each other through package boundaries (they reference each other via `workspace:*` dependencies, not via relative paths)
- Biome, ESLint, and other linting tools still run per-package

Bundling is a **build-time concern only**. It does not collapse the package boundaries at the TypeScript level. The "inline bundling" just means the final compiled output is one file, not that the packages are merged as source.

**Tradeoff acknowledged:** Since all plugins are compiled together, TypeScript errors in any plugin will surface during the orchestrator's own `typecheck` run. This is the documented JIT package tradeoff:
> "TypeScript errors in dependencies will propagate to dependent packages"
Source: https://turborepo.dev/repo/docs/core-concepts/internal-packages (PRIMARY)

In practice this is beneficial, not harmful — it means the orchestrator's CI catches plugin type errors.

---

### 7. tsup is No Longer Actively Maintained

**Confidence: HIGH**

**Important:** As of mid-2024, tsup's README states:
> "⚠️ This project is no longer actively maintained. We recommend migrating to tsdown instead."

Source: https://github.com/egoist/tsup (PRIMARY — official repository notice)

The recommended successor is **tsdown** (`https://github.com/rolldown/tsdown`), which is powered by Rolldown/Oxc.

tsdown has a `deps.alwaysBundle` option (the noExternal equivalent):

```typescript
// tsdown.config.ts
export default defineConfig({
  deps: {
    alwaysBundle: ['some-package'],
  }
})
```

From tsdown API documentation: "force certain dependencies to be bundled, even if they are listed in `dependencies`"

Source: https://tsdown.dev/options/dependencies (PRIMARY — official tsdown docs)

**Caveat:** `alwaysBundle` and `skipNodeModulesBundle` are documented as mutually exclusive in tsdown.

Source: https://tsdown.dev/options/dependencies (PRIMARY)

For the orchestrator use case, direct esbuild usage (without tsup/tsdown wrapper) may be simpler and more stable than adopting tsdown.

---

## Key Takeaways

1. **`noExternal` works for workspace packages** — tsup's `noExternal: [/@harness\/plugin-.*/]` will bundle all plugin packages inline. The official test suite proves TypeScript source files in node_modules (including workspace symlinks) are compiled correctly.

2. **pnpm symlinks are not a problem** — esbuild resolves symlinks to real paths. This was fixed in esbuild v0.x (GitHub issue #67, April 2020) and has been stable since. pnpm workspace packages are indistinguishable from regular bundled packages from esbuild's perspective.

3. **TypeScript source files in workspace packages compile correctly** — esbuild enables the `.ts` loader by default for any `.ts` file it encounters, regardless of whether it was found via a symlink or direct path.

4. **Plugins do NOT need a `build` script** — the orchestrator's bundler handles compilation. Plugins can have `typecheck`, `lint`, and `test` scripts that run independently.

5. **Turborepo transit nodes handle this automatically** — with `"build": { "dependsOn": ["^build"] }` in the root `turbo.json`, plugins with no `build` script become transit nodes. Turborepo does NOT error; it silently skips them. This is documented, first-class behavior.

6. **The official Turborepo basic example uses this exact pattern** — `@repo/ui` has no build script, exports TypeScript source directly, and is consumed by Next.js apps that compile it inline. This is the canonical reference implementation.

7. **Package isolation is preserved** — bundling is a build-time concern only. TypeScript, pnpm, and Biome still enforce package boundaries at the source level.

8. **tsup is deprecated** — consider direct esbuild or tsdown for new work. tsdown uses `deps.alwaysBundle` for the equivalent of `noExternal`.

---

## Gaps Identified

- **tsdown `alwaysBundle` + `skipNodeModulesBundle` mutual exclusivity**: The docs say these are mutually exclusive but do not explain the alternative pattern for "external all npm packages except workspace packages" in tsdown. This needs further research if tsdown is chosen over direct esbuild.
- **esbuild `--packages=external` with pnpm workspaces**: This flag externalizes based on the `node_modules` path check. Since pnpm symlinks workspace packages through `node_modules`, `--packages=external` may incorrectly external workspace packages. The safe approach is explicit `--external:package-name` per non-workspace package.
- **tsup watch mode with noExternal**: Issue #1170 in the tsup repo is open; watch mode does not reliably detect changes in symlinked workspace packages. For development only (not production builds), this is a limitation to be aware of.

---

## Recommendations for Next Steps

1. Use **direct esbuild** (not tsup) for the orchestrator bundle — tsup is deprecated and direct esbuild is more stable
2. Configure with `bundle: true`, explicit `--external:` flags for npm packages to exclude, no `--external:` for `@harness/*` packages
3. Add `"main": "./src/index.ts"` to each plugin's `package.json` (if not already pointing to TS source)
4. Remove `build` scripts from plugin `package.json` files — keep `typecheck`, `lint`, `test`
5. No changes needed to `turbo.json` — transit node behavior is automatic

---

## Sources

| URL | Type | Topic |
|-----|------|-------|
| https://jsdocs.io/package/tsup#Options | PRIMARY | noExternal type definition and description |
| https://raw.githubusercontent.com/egoist/tsup/main/test/index.test.ts | PRIMARY | Official test for noExternal with TypeScript source in node_modules |
| https://github.com/egoist/tsup/issues/1334 | SECONDARY | Confirmed working noExternal with pnpm workspace symlinks; watch mode limitation |
| https://github.com/egoist/tsup/issues/1170 | SECONDARY | Watch mode + noExternal limitation in monorepos |
| https://github.com/evanw/esbuild/issues/67 | PRIMARY | esbuild symlink resolution with pnpm (fixed April 2020) |
| https://esbuild.github.io/content-types/#typescript | PRIMARY | .ts loader enabled by default for TypeScript files |
| https://esbuild.github.io/api/#main-fields | PRIMARY | tsconfig.json auto-discovery, mainFields resolution |
| https://esbuild.github.io/api/#conditions | PRIMARY | Export conditions for TypeScript source |
| https://esbuild.github.io/getting-started/#bundling-for-node | PRIMARY | Node.js bundling with --packages=external |
| https://esbuild.github.io/api/#bundle | PRIMARY | Bundle option, recursive inlining, non-analyzable imports |
| https://esbuild.github.io/plugins/ | PRIMARY | esbuild plugin API for custom resolution |
| https://turborepo.dev/repo/docs/core-concepts/internal-packages | PRIMARY | JIT packages, compiled packages, transit nodes |
| https://turborepo.dev/repo/docs/core-concepts/package-and-task-graph | PRIMARY | Transit node definition ("won't execute anything for it") |
| https://turborepo.dev/repo/docs/crafting-your-repository/configuring-tasks | PRIMARY | Transit nodes as intentional pattern |
| https://raw.githubusercontent.com/vercel/turborepo/main/examples/basic/packages/ui/package.json | PRIMARY | Official example: @repo/ui with no build script, exports TypeScript source |
| https://github.com/egoist/tsup | PRIMARY | tsup deprecation notice |
| https://tsdown.dev/options/dependencies | PRIMARY | tsdown alwaysBundle (noExternal equivalent), mutual exclusivity with skipNodeModulesBundle |
