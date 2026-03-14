# Research: Turborepo Internal Packages Pattern

Date: 2026-03-13

## Summary

Turborepo defines "Internal Packages" as workspace libraries that share code across a monorepo without being published to npm. There are three compilation strategies: Just-in-Time (no build step, TypeScript exported directly), Compiled (tsc produces dist/), and Publishable (for npm distribution). Just-in-Time is the pattern most relevant to eliminating unnecessary build steps. Next.js's `transpilePackages` is what enables the consuming app to compile TypeScript from workspace packages.

## Prior Research

No prior research on this specific topic exists in AI_RESEARCH/.

## Current Findings

---

### 1. What is an Internal Package?

**Source:** https://turborepo.dev/repo/docs/core-concepts/internal-packages (PRIMARY — official Turborepo docs)

An Internal Package is a workspace library whose source code lives in your monorepo. It is installed via workspace syntax rather than a version number:

- pnpm/bun: `"@repo/ui": "workspace:*"`
- yarn/npm: `"@repo/ui": "*"`

Consuming code imports from it like any external package: `import { Button } from "@repo/ui"`. The documentation frames internal packages as "enabling code sharing across a monorepo" with the option to publish to npm later.

The documentation defines three distinct compilation strategies for internal packages:
1. Just-in-Time Packages
2. Compiled Packages
3. Publishable Packages

---

### 2. Just-in-Time Packages — The "No Build Step" Pattern

**Source:** https://turborepo.dev/repo/docs/core-concepts/internal-packages (PRIMARY)

Just-in-Time (JIT) packages export TypeScript source files directly. The consuming application's bundler handles all transpilation. There is no `build` script in the package.

**package.json for a JIT package:**

```json
{
  "name": "@repo/ui",
  "exports": {
    "./button": "./src/button.tsx",
    "./card": "./src/card.tsx"
  },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit"
  }
}
```

Key characteristics:
- The `exports` field points directly to `.tsx` / `.ts` source files — not compiled output
- No `build` script in `scripts`
- No `dist/` directory
- TypeScript type-checking is still available via `tsc --noEmit`

The consuming bundler (Turbopack, webpack, Vite) is "responsible for transpiling the TypeScript packages to JavaScript" as part of its own build process.

**Limitations (documented):**
- "This strategy can only be used when the package is going to be used in tooling that uses a bundler or natively understands TypeScript."
- Cannot use TypeScript `compilerOptions.paths` — TypeScript assumes transpilation occurs in the original package location
- "Turborepo cannot cache a build for a Just-in-Time Package" — since no build step exists, there is nothing for Turborepo to cache
- TypeScript errors in dependency packages surface during the consuming app's type-check

---

### 3. Compiled Packages — The "Has a Build Step" Pattern

**Source:** https://turborepo.dev/repo/docs/core-concepts/internal-packages (PRIMARY)
**Source:** https://turborepo.dev/repo/docs/crafting-your-repository/creating-an-internal-package (PRIMARY)

Compiled packages use `tsc` (or another build tool) to produce JavaScript output in a `dist/` directory.

**package.json for a compiled package:**

```json
{
  "name": "@repo/ui",
  "exports": {
    "./button": {
      "types": "./src/button.tsx",
      "default": "./dist/button.js"
    },
    "./card": {
      "types": "./src/card.tsx",
      "default": "./dist/card.js"
    }
  },
  "scripts": {
    "build": "tsc"
  }
}
```

Key difference from JIT: the `exports` field uses conditional exports — `"types"` points to the TypeScript source (for IDE go-to-definition), `"default"` points to compiled JavaScript output. The `build` script is present and Turborepo caches the `dist/` output.

**turbo.json must declare outputs for caching:**

```json
{
  "outputs": [".next/**", "!.next/cache/**", "dist/**"]
}
```

---

### 4. Transit Nodes — What Happens When a Dependency Has No Build Task

**Source:** https://turborepo.dev/repo/docs/core-concepts/package-and-task-graph (PRIMARY)

When a JIT package (no `build` script) sits as a dependency in the task graph, Turborepo calls it a **Transit Node**. The documentation states:

> "Turborepo calls the `ui` package a Transit Node in this scenario, because it doesn't have its own `build` script."

Transit Nodes are included in the task graph for structural purposes (to include their own dependencies if any have build scripts), but Turborepo executes nothing for them. The graph skips over them cleanly.

> "Turborepo won't execute anything for it, but it's still part of the graph for the purpose of including its own dependencies."

The official documentation does not describe this as a "performance benefit" explicitly, but the practical implication is clear: if a dependency has no `build` task, turbo does not wait for it, which shortens the critical path of the task graph for consuming apps.

---

### 5. transpilePackages in Next.js

**Source:** https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages (PRIMARY — official Next.js docs)
**Source:** https://nextjs.org/docs/architecture/nextjs-compiler (PRIMARY)

`transpilePackages` was introduced in Next.js v13.0.0. It replaces the `next-transpile-modules` community package.

**What it does:**
Next.js's compiler (SWC-based) automatically transpiles and bundles dependencies listed in `transpilePackages`. This enables packages that export TypeScript source (JIT packages) or non-standard JavaScript to be compiled as part of the Next.js build, rather than being treated as pre-compiled node_modules.

**Configuration:**

```js
// next.config.js
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/database'],
}
```

**Mechanism:** The Next.js Compiler is written in Rust using SWC. When a package is listed in `transpilePackages`, Next.js's SWC-based pipeline includes that package in its transpilation pass — meaning TypeScript JSX (`.tsx`), TypeScript (`.ts`), and non-standard JavaScript in those packages are compiled by the same SWC pass that compiles the app's own source code.

From the Next.js Compiler docs:
> "Next.js can automatically transpile and bundle dependencies from local packages (like monorepos) or from external dependencies (node_modules). This replaces the next-transpile-modules package."

**The relationship with JIT packages:**
A JIT package exports raw TypeScript. Without `transpilePackages`, Next.js would encounter `.tsx` files in node_modules and refuse to process them (node_modules are excluded from SWC compilation by default). Adding the package name to `transpilePackages` opts it into the SWC compilation pipeline, enabling the JIT pattern to work.

**With Turbopack (Next.js 16 default):** Turbopack natively understands TypeScript and workspace packages. The JIT pattern may work without `transpilePackages` when using Turbopack, since Turbopack "natively understands TypeScript" (per Turborepo docs). However, `transpilePackages` remains the explicit, documented mechanism for webpack compatibility.

---

### 6. Official Documentation URLs

- **Internal Packages overview (all three strategies):** https://turborepo.dev/repo/docs/core-concepts/internal-packages
  - Note: `turbo.build` redirects (301) to `turborepo.dev`
- **Creating an Internal Package (step-by-step guide):** https://turborepo.dev/repo/docs/crafting-your-repository/creating-an-internal-package
- **Package and Task Graph (Transit Nodes):** https://turborepo.dev/repo/docs/core-concepts/package-and-task-graph
- **Structuring a Repository (exports field):** https://turborepo.dev/repo/docs/crafting-your-repository/structuring-a-repository
- **TypeScript guide (JIT vs compiled tsconfig):** https://turborepo.dev/repo/docs/guides/tools/typescript
- **Next.js transpilePackages:** https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages
- **Next.js Compiler (SWC, Module Transpilation section):** https://nextjs.org/docs/architecture/nextjs-compiler

---

### 7. TypeScript Configuration Differences

**Source:** https://turborepo.dev/repo/docs/guides/tools/typescript (PRIMARY)

**JIT package tsconfig:** `imports` targets source files (`"#*": "./src/*"`), imports use `.ts` extensions, go-to-definition works automatically.

**Compiled package tsconfig:** `imports` points to distribution directories (`"#*": "./dist/*"`), imports use `.js` extensions, requires `declaration` and `declarationMap` options for go-to-definition to work.

The TypeScript guide also notes: "TypeScript Project References are discouraged due to unnecessary complexity" and "Node.js subpath imports are preferred over TypeScript `paths` for better Just-in-Time Package compatibility."

---

## Key Takeaways

1. **Three strategies exist** — JIT (no build), Compiled (tsc to dist/), Publishable (for npm). The harness codebase uses a mix: some packages are compiled, some are JIT-style via transpilePackages.

2. **JIT package.json is minimal** — `exports` points to `.tsx` source, no `build` script, only `check-types` and `lint` in scripts.

3. **transpilePackages is the bridge** — it tells Next.js's SWC compiler to include the workspace package in its TypeScript compilation pass, enabling JIT packages to work with webpack. Turbopack may not require it.

4. **Transit Nodes don't block the task graph** — a JIT package with no `build` script becomes a Transit Node. Turborepo executes nothing for it, so consuming apps don't wait on it. The graph is shorter on the critical path.

5. **Turborepo cannot cache JIT packages** — because there is no build output to cache. Caching only applies to compiled packages via `outputs: ["dist/**"]` in turbo.json.

6. **The official Turborepo guide steers toward Compiled packages** — the "Creating an Internal Package" guide demonstrates only the compiled approach. JIT is documented in the Internal Packages core concept page but is not the primary recommendation for shared packages.

7. **`turbo.build` redirects to `turborepo.dev`** — all turbo.build documentation URLs now 301-redirect to turborepo.dev.

## Sources

| URL | Type | Topic |
|-----|------|-------|
| https://turborepo.dev/repo/docs/core-concepts/internal-packages | PRIMARY | All three strategies, JIT definition |
| https://turborepo.dev/repo/docs/crafting-your-repository/creating-an-internal-package | PRIMARY | Step-by-step compiled package guide |
| https://turborepo.dev/repo/docs/core-concepts/package-and-task-graph | PRIMARY | Transit Nodes, task graph behavior |
| https://turborepo.dev/repo/docs/crafting-your-repository/structuring-a-repository | PRIMARY | Package.json exports field |
| https://turborepo.dev/repo/docs/crafting-your-repository/configuring-tasks | PRIMARY | dependsOn, ^build behavior |
| https://turborepo.dev/repo/docs/guides/tools/typescript | PRIMARY | JIT vs compiled tsconfig differences |
| https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages | PRIMARY | transpilePackages API reference |
| https://nextjs.org/docs/architecture/nextjs-compiler | PRIMARY | SWC compiler, Module Transpilation section |
