# Research: Turborepo Per-Package Task Configuration and Transit Nodes

Date: 2026-03-14

## Summary

Authoritative answers to five specific questions about Turborepo task configuration. The canonical documentation is at turborepo.dev (turbo.build redirects there with 301). All five questions have clear official answers. Key findings: per-package task overrides exist via package-level `turbo.json` files and the `package#task` root syntax; transit nodes are a documented first-class concept for packages without a matching script; `^build` resolves correctly through packages with no build script (they become transit nodes); composable configuration was introduced in v2.7; and package-level `turbo.json` files are the official per-package customization mechanism.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-13-turborepo-internal-packages.md` — contains the transit node quote and JIT package details
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-13-turborepo-large-monorepo-patterns.md` — covers large monorepo patterns, 14 plugin packages

## Current Findings

---

### Question 1 — Per-Package Task Overrides in turbo.json

**Confidence: HIGH**

There are two official mechanisms:

#### Mechanism A: `package#task` syntax in root turbo.json

The root `turbo.json` supports a `package#task` syntax as task keys. This allows overriding the configuration for a specific package's task without affecting other packages.

Source: https://turborepo.dev/repo/docs/reference/configuration (PRIMARY)

```jsonc
{
  "tasks": {
    "web#lint": {
      "dependsOn": ["utils#build"]
    }
  }
}
```

This entry applies ONLY to the `web` package's `lint` task. All other packages use the global `lint` definition.

**Critical limitation: No glob/wildcard support in task keys.** The format is `package#task` with a literal package name. There is no supported syntax like `@harness/plugin-*#build`. Each package must be named individually.

Source: https://turborepo.dev/repo/docs/reference/configuration (PRIMARY) — does not document or mention glob patterns in task keys. Only two valid key formats exist: `taskName` (applies to all packages) and `package#task` (specific package).

#### Mechanism B: Package-level `turbo.json` files

Place a `turbo.json` directly in any package directory. The file must include an `extends` key referencing the root:

```jsonc
// packages/plugins/identity/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "dependsOn": []
    }
  }
}
```

This overrides the `build` task for just this package. The `"//"` refers to the monorepo root. Array fields (`outputs`, `env`, `inputs`, `dependsOn`, `passThroughEnv`) completely replace root values by default. Scalar fields (`outputLogs`, `cache`, `persistent`, `interactive`) are inherited unless overridden.

To exclude a task entirely from a package, use `"extends": false` on the task:

```jsonc
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "extends": false
    }
  }
}
```

Source: https://turborepo.dev/repo/docs/reference/package-configurations (PRIMARY)

**Key constraints on package-level turbo.json:**

- Cannot use `package#task` syntax (inferred from file location — the package is already known)
- Cannot override global configuration (`globalEnv`, `globalDependencies`)
- Can reference other packages in `dependsOn`: `"dependsOn": ["some-pkg#compile"]`
- Root `turbo.json` cannot use the `extends` key (ignored at root level)

Source: https://turborepo.dev/repo/docs/reference/package-configurations (PRIMARY)

#### Harness Applicability

To give `@harness/plugin-*` packages a `build` task with no `dependsOn`, the options are:

1. Add a `turbo.json` to each plugin package (one file per plugin, ~14 files)
2. Use the `$TURBO_EXTENDS$` approach if extending a shared plugin config (v2.7+, see Question 4)
3. There is no glob-match shortcut for targeting all `@harness/plugin-*` packages at once from the root

---

### Question 2 — Transit Nodes

**Confidence: HIGH — directly quoted from official documentation**

Transit nodes are a documented, first-class concept in Turborepo.

#### Official Definition

Source: https://turborepo.dev/repo/docs/core-concepts/package-and-task-graph (PRIMARY)

> "Turborepo calls the `ui` package a Transit Node in this scenario, because it doesn't have its own `build` script."
> "Turborepo won't execute anything for it, but it's still part of the graph for the purpose of including its own dependencies."

Source: https://turborepo.dev/repo/docs/crafting-your-repository/configuring-tasks (PRIMARY)

> "These Transit Nodes create a relationship between your package dependencies using a task that doesn't do anything because it doesn't match a script in any `package.json`s."

#### Behavior Summary

When a package is in the task graph for a given task (e.g., `build`) but has no matching script in its `package.json`:
- Turborepo does NOT execute anything for that package
- Turborepo DOES keep it in the graph for the purpose of resolving its own upstream dependencies
- The package is silently skipped — no error is raised

This is the designed, documented behavior. The transit node concept exists precisely because Turborepo needed a way to express "a package is in the dependency chain, but has nothing to do for this task."

#### Practical Implication for Harness Plugins

If a plugin package (e.g., `@harness/plugin-identity`) has `typecheck`, `lint`, and `test` scripts but NO `build` script:

- `turbo build` — the plugin becomes a transit node; Turborepo executes nothing for it. The orchestrator's `build` task (which has `"dependsOn": ["^build"]`) will resolve through the plugin correctly without blocking.
- `turbo typecheck` — runs on the plugin (it has the script)
- `turbo lint` — runs on the plugin (it has the script)
- `turbo test` — runs on the plugin (it has the script)

The transit node behavior is automatic. No configuration change is needed in `turbo.json` to enable it.

---

### Question 3 — `dependsOn: ["^build"]` Resolves Through Transit Nodes

**Confidence: HIGH**

The current harness `turbo.json` has:

```json
"build": {
  "dependsOn": ["^build"]
}
```

This means `apps/orchestrator`'s build waits for its dependencies' builds.

**When a dependency has no `build` script**, it becomes a transit node (see Question 2). From the official docs:

> "Turborepo won't execute anything for it, but it's still part of the graph for the purpose of including its own dependencies."

This means `^build` traversal does NOT error when it encounters a package without a `build` script. It simply skips executing anything for that package. The orchestrator's build task still runs correctly — it waits for all dependency builds that actually exist and silently passes through packages that have no `build` script.

**Example resolution with 3 plugins, none having a build script:**

```
apps/orchestrator build
  -> depends on ^build
  -> @harness/plugin-identity build (no script -> transit node, skip)
  -> @harness/plugin-context build (no script -> transit node, skip)
  -> @harness/plugin-discord build (no script -> transit node, skip)
  -> orchestrator build runs immediately (no real upstream work to wait for)
```

This is consistent with the transit node documentation. The task graph is correctly constructed; nodes without matching scripts are pruned from execution while remaining in the dependency graph for structural purposes.

**Also relevant:** `turbo.json` `typecheck` currently has `"dependsOn": ["^build"]`. If plugins have no build script, typecheck tasks on those plugins will not wait for anything (transit node behavior). The orchestrator's typecheck would wait for the orchestrator's own build, which in turn waits for... plugin builds that don't exist. So `orchestrator#typecheck` effectively only waits for `orchestrator#build`.

---

### Question 4 — Turborepo v2.7 Composable Configuration

**Confidence: HIGH**

Source: https://turborepo.dev/blog/turbo-2-7 (PRIMARY — official Turborepo blog post, released 2025-12-19)

Composable configuration was introduced in Turborepo 2.7. It expanded the `extends` key in package-level `turbo.json` files beyond just `["//"]` (root-only) to support any package in the workspace by name.

#### What v2.7 Added

**Before v2.7:** Package configs could only extend from root:
```jsonc
{
  "extends": ["//"]
}
```

**After v2.7:** Package configs can extend from any package:
```jsonc
// apps/docs/turbo.json
{
  "extends": ["//", "web"]
}
```

This inherits task definitions from both the root `turbo.json` AND from `apps/web/turbo.json`. Root must always be listed first.

#### The `$TURBO_EXTENDS$` Microsyntax

v2.7 also formalized the `$TURBO_EXTENDS$` keyword for array fields. By default, array fields in a package config completely replace the inherited values. Using `$TURBO_EXTENDS$` as the first element instead appends to the inherited array:

```jsonc
// apps/web/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "outputs": ["$TURBO_EXTENDS$", ".next/**"]
    }
  }
}
```

This adds `.next/**` to whatever `outputs` the root `turbo.json` defines, rather than replacing it.

#### Harness Applicability

Composable configuration enables a "shared plugin config" package pattern:

1. Create `packages/plugin-config/turbo.json` with plugin-specific task definitions
2. Each plugin package's `turbo.json` extends from it: `"extends": ["//", "@harness/plugin-config"]`

This would allow defining plugin-specific task behavior once and sharing it across all 14 plugin packages. The limitation is that each plugin still needs its own `turbo.json` file — composable config reduces duplication in task definitions but does not eliminate the need for per-package turbo.json files.

---

### Question 5 — Package-Level `turbo.json` Files

**Confidence: HIGH**

Source: https://turborepo.dev/repo/docs/reference/package-configurations (PRIMARY)
Source: https://turborepo.dev/repo/docs/crafting-your-repository/configuring-tasks (PRIMARY, "Package Configurations" section)

#### How They Work

A package-level `turbo.json` is placed directly in any package directory. It MUST include `"extends": ["//"]` (or `["//", "other-package"]` in v2.7+). Without the `extends` key, the file is invalid.

#### What Can Be Overridden

The `tasks` key can be overridden at the package level. Any task defined in the package `turbo.json` overrides the matching task from the root for that package only.

| Field | Inherited by default? | Override behavior |
|-------|----------------------|-------------------|
| `outputLogs`, `cache`, `persistent`, `interactive` | Yes (scalar) | Set in package config to override |
| `outputs`, `env`, `inputs`, `dependsOn`, `passThroughEnv` | Replaced (array) | Default: completely replaces root value. Use `$TURBO_EXTENDS$` to append instead |

#### What CANNOT Be Overridden at Package Level

- `globalEnv` — root-only configuration
- `globalDependencies` — root-only configuration
- Cannot use `package#task` syntax as task keys (file location implies the package)

#### Excluding a Task Entirely

Setting `"extends": false` on a task definition disconnects it from the inheritance chain. The task is treated as if it does not exist for that package. This propagates — if package A extends package B, and package B sets `"extends": false` on `lint`, then package A will also not have an inherited `lint` task.

```jsonc
// packages/plugins/identity/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "extends": false
    }
  }
}
```

**Note:** With transit node behavior, this file may be unnecessary. If a plugin has no `build` script in its `package.json`, it already becomes a transit node automatically — Turborepo runs nothing for it. The `extends: false` approach is useful when you want to explicitly document the absence of a task or when you want to prevent a task key from being inherited by packages that further extend this package config.

---

## Key Takeaways

1. **No glob/wildcard task keys exist.** `@harness/plugin-*#build` is not valid syntax. Per-package overrides require either individual `turbo.json` files or explicitly named `package#task` entries in the root.

2. **Transit nodes are automatic and silent.** If a plugin has no `build` script, it automatically becomes a transit node. No configuration change is needed. `^build` traverses through it without error.

3. **`dependsOn: ["^build"]` in the current harness turbo.json already handles plugin-less-build correctly.** The orchestrator's build waits for plugin builds that exist and silently skips plugins that have no build script.

4. **Package-level `turbo.json` is the correct override mechanism** for per-package customization. The `extends: false` pattern explicitly excludes a task. The `$TURBO_EXTENDS$` microsyntax appends to inherited arrays.

5. **Composable configuration (v2.7)** allows a shared `turbo.json` in a config package that all plugins can extend. This reduces duplication but still requires one `turbo.json` per plugin package.

6. **The transit node behavior is documented twice** in official Turborepo docs with slightly different framing:
   - Core concepts page: explicit quote about `ui` package as transit node
   - Configuring tasks page: transit nodes as an intentional pattern for parallel type-checking

---

## Gaps Identified

- Official docs do not state the exact behavior when `extends: false` is set on a task in a package that has that script in `package.json`. The implication is Turborepo would not run the task, but this is inference from the "disconnected from inheritance chain" description.
- No official documentation on whether the `package#task` root syntax takes precedence over or merges with a package-level `turbo.json` for the same package+task combination. The precedence rules are not documented.
- No official benchmark for how many package-level `turbo.json` files affect startup or graph resolution time.

---

## Sources

| URL | Type | Topic |
|-----|------|-------|
| https://turborepo.dev/repo/docs/reference/configuration | PRIMARY | Root turbo.json schema, dependsOn, package#task syntax |
| https://turborepo.dev/repo/docs/reference/package-configurations | PRIMARY | Package-level turbo.json: extends, constraints, $TURBO_EXTENDS$ |
| https://turborepo.dev/repo/docs/crafting-your-repository/configuring-tasks | PRIMARY | Task configuration guide, transit nodes, package configurations section |
| https://turborepo.dev/repo/docs/core-concepts/package-and-task-graph | PRIMARY | Transit node definition and behavior (authoritative quote) |
| https://turborepo.dev/blog/turbo-2-7 | PRIMARY | Composable configuration release announcement |
| https://turborepo.dev/blog | PRIMARY | Blog index, release dates confirmed |
