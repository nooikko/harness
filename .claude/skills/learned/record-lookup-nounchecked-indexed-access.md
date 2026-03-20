---
name: record-lookup-nounchecked-indexed-access
description: "Fix Record<string, T> lookup returning undefined despite ?? fallback under noUncheckedIndexedAccess"
user-invocable: false
origin: auto-extracted
---

# Record Lookup with noUncheckedIndexedAccess

**Extracted:** 2026-03-14
**Context:** TypeScript strict mode with `noUncheckedIndexedAccess` enabled

## Problem
With `noUncheckedIndexedAccess`, accessing `Record<string, T>` returns `T | undefined`. Using a
nullish coalescing fallback that also indexes into the same Record doesn't help — the fallback
itself is also `T | undefined`:

```typescript
const STATUS_CONFIG: Record<string, StatusConfig> = { TODO: { ... }, DONE: { ... } };
// TS error: status is StatusConfig | undefined
const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO;
//                                          ^^^^^^^^^^^^^^^^^^^ also T | undefined
```

## Solution
Extract the default value as a standalone typed constant. The fallback then has a concrete type
and the `??` expression resolves to `T`:

```typescript
const DEFAULT_STATUS: StatusConfig = { label: 'To Do', icon: <Circle />, className: '...' };

const STATUS_CONFIG: Record<string, StatusConfig> = {
  TODO: DEFAULT_STATUS,
  DONE: { label: 'Done', icon: <CheckCircle />, className: '...' },
};

// ✅ status is StatusConfig (not StatusConfig | undefined)
const status = STATUS_CONFIG[task.status] ?? DEFAULT_STATUS;
```

## When to Use
- Any `Record<string, T>` or `{ [key: string]: T }` lookup with a fallback under `noUncheckedIndexedAccess`
- Common in UI config maps: priority colors, status icons, badge variants, theme tokens
