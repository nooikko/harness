---
name: new-plugin
description: Scaffold a new harness plugin package with tool handlers, tests, and orchestrator registration
command: /new-plugin
evolved_from:
  - plugin-tool-handler-scaffolding
  - plugin-vitest-minimal-config
  - typed-helper-module-pattern
  - sequential-server-action-crud-creation
  - feature-integration-cascading-edits
---

# New Plugin Command

Scaffolds a complete harness plugin package.

## Usage

```
/new-plugin <name> [--tools tool1,tool2] [--hooks onMessage,onAfterInvoke]
```

## Steps

1. Create `packages/plugins/<name>/` directory structure:
   ```
   packages/plugins/<name>/
     package.json
     tsconfig.json
     vitest.config.ts
     src/
       index.ts
       _helpers/
         __tests__/
   ```

2. Generate `package.json` with workspace dependencies:
   - `@harness/database`: `workspace:*`
   - `@harness/plugin-contract`: `workspace:*`

3. Generate `src/index.ts` with `PluginDefinition`:
   - Name, version, tools array, register function
   - Hook implementations (stubs for requested hooks)

4. For each `--tools` entry, generate:
   - `src/_helpers/<tool-name>.ts` — handler with type-safe input extraction
   - `src/_helpers/__tests__/<tool-name>.test.ts` — test with mock PluginContext

5. Register in orchestrator:
   - Add import to `apps/orchestrator/src/plugin-registry/index.ts`
   - Add to `ALL_PLUGINS` array (after `projectPlugin`)
   - Add workspace dep to `apps/orchestrator/package.json`

6. Add to `vitest.config.ts` test projects

7. Run `pnpm install` to link workspace
