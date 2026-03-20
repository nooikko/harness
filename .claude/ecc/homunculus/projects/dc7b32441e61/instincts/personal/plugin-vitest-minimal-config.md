---
id: plugin-vitest-minimal-config
trigger: when creating vitest.config.ts for a plugin package
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Vitest Minimal Configuration

## Action
Use identical minimal vitest config for all plugins: `environment: 'node'` and `coverage: { provider: 'v8' }`. Include `name` field matching plugin package name.

## Evidence
- Observed 3+ times in plugin vitest configs
- Pattern: `/packages/plugins/{name}/vitest.config.ts`
- Files: identity, web, delegation plugins all have same structure
- Config: `defineConfig({ test: { name: 'plugin-{name}', environment: 'node', coverage: { provider: 'v8' } } })`
- Last observed: 2026-03-14

## Why
Standardization across plugin packages enables workspace configuration at root level without per-plugin overrides. Node environment is correct for plugin tests since they're backend.
