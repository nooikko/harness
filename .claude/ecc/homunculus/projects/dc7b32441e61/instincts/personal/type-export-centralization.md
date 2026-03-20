---
id: type-export-centralization
trigger: when re-exporting a type from a package that multiple consumers depend on
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Type Export Centralization

## Action
After re-exporting a type from a shared package, update all consumer files to import the type from the package re-export instead of the external dependency.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Add type re-export in package index.ts (e.g., `export type { QdrantClient }`), then replace all `from '@external/lib'` imports with `from '@harness/package'` in consumer files
- Applied to: index-message.ts, index-thread.ts, backfill.ts, search plugin index.ts
- Last observed: 2026-03-15

## Rationale
Centralizing type exports reduces direct external dependency coupling and provides a single point of control for type definitions.
