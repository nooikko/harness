---
id: prisma-json-field-type-casting
trigger: when Prisma JSON field assignments reject object literals that don't conform to NullableJsonNullValueInput | InputJsonValue
confidence: 0.5
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Prisma JSON Field Type Casting Pattern

## Action
Cast JSON field values to `Record<string, unknown> as never` when assigning objects to Prisma JSON fields (create/update settings).

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Prisma's JSON field type validation rejects object literals with specific key-value pairs
- Occurrences:
  - oauth-routes.ts:80 - create settings with youtubeAuth property
  - oauth-routes.ts:83 - update settings with youtubeAuth property
  - oauth-routes.ts:127 - update settings with destructured rest object
- Solution pattern: `settings: { ...obj } as Record<string, unknown> as never`
- Last observed: 2026-03-16

## Context
Prisma's JSON input type is very strict about what values are assignable. Use a two-step cast (`as Record<string, unknown> as never`) to bypass the type checker when you're confident the runtime value is correct but the static type isn't properly inferred.
