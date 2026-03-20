---
id: zod-env-validation-pattern
trigger: when creating new packages or modules that need environment configuration
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Zod Environment Validation Pattern

## Action
Create an `env.ts` file in package `src/` that uses Zod to define and validate environment variables with a typed `loadEnv()` function.

## Evidence
- Observed 3 times in session bbe56a1c-c659-48a9-87ca-5743e8ba37f1
- Pattern: All packages define environment config via `z.object()` schema with exported `LoadEnv` type and `loadEnv()` function
- Files: vector-search/src/env.ts, oauth/src/env.ts, oauth/src/providers/microsoft.ts (usage)
- Last observed: 2026-03-16

## Details
Each env.ts follows the structure:
1. Import zod
2. Define `envSchema` as `z.object()` with environment variables (using `.optional()` where appropriate)
3. Create `LoadEnv` type from schema inference
4. Export `loadEnv` function that calls `envSchema.parse(process.env)`
5. Use in modules via `const env = loadEnv()`

This provides type-safe runtime environment validation across all packages.
