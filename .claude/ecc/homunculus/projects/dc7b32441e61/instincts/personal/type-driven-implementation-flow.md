---
id: type-driven-implementation-flow
trigger: when implementing new features or fixing bugs that touch type definitions
confidence: 0.5
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Type-Driven Implementation Flow

## Action
When implementing features or fixing issues, modify or clarify type definitions first, then create/modify implementations to match those types, then read files to verify alignment.

## Evidence
- Observed 3+ times in session ba6e2533-1faa-4752-9d78-561342f98530
- Timestamps: 2026-03-18T02:29:38Z through 02:30:10Z
- Implementation sequence:
  1. Edit test file to add `traceId: 'trace-1'` type expectation (02:29:38Z)
  2. Write new file `get-active-pipeline.ts` with explicit return types: `{ active: true; startedAt: string; traceId: string }` (02:29:56Z)
  3. Edit `ws-provider.tsx` type definition to add `onReconnect: (callback: () => void) => () => void` property (02:30:04Z)
  4. Read `ws-provider.tsx` to verify type modifications are correct (02:30:10Z)
- Pattern: Type shape → Implementation → Verification

## Why This Matters
Defining types first ensures the implementation matches the contract and catches type mismatches early. Reading back after modification confirms the types are correctly expressed.
