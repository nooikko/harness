---
id: turborepo-env-configuration
trigger: when setting up environment variables in a Turborepo monorepo or debugging tasks that can't access .env values
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Turborepo Environment Variable Configuration

## Action
When environment variables are defined in root `.env` but tasks can't access them, explicitly configure Turborepo to track these files via `globalDotEnv`, `dotEnv`, or `inputs` in `turbo.json`.

## Evidence
- Observed 5+ times in session bbe56a1c-c659 (2026-03-17)
- Pattern: Multiple failed attempts to read .env files (Glob returns 0 matches, Bash glob fails), followed by research queries about Turborepo .env configuration
- Root `.env` exists but is not auto-discovered by Turborepo tasks
- Research showed Turborepo requires explicit configuration: `globalDotEnv: [".env"]` or task-specific `dotEnv: [".env"]` or `inputs: [".env"]`
- Session notes confirm: environment variables were added to root `.env` but not accessible in tasks
- Last observed: 2026-03-17T02:33:43Z

## Solution Pattern
For monorepo-wide .env access, add to `turbo.json`:
```
"globalDotEnv": [".env", ".env.local"]
```

For task-specific env tracking, add to individual tasks:
```
"dotEnv": [".env.production", ".env.local", ".env"]
```

This ensures Turborepo includes these files in task hash calculation and triggers cache invalidation when env vars change.
