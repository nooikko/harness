---
id: loose-server-types-union-narrowing
trigger: when schema/server data uses loose string types but client components need strict union types for select dropdowns or type-safe handlers
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Loose Server Types Require Union Narrowing + Fallbacks

## Action
When component props have loose `string` types from server but Select handlers or API calls expect strict union types, add explicit type casting in handlers and extract DEFAULT constants for safe config lookups.

## Evidence
- 8 typecheck errors across taskDetailPanel.tsx and taskList.tsx on 2026-03-15 06:22:13
  - 2 errors: Type 'string' not assignable to status/priority unions in Select change handlers
  - 6 errors: status/priority possibly undefined in lookup operations
- Fixed by session 4856ee0a-a85e-44ce-988d-133f25f77051 at 06:22:32, 06:22:46, 06:23:01
  - Added type casts: `value as 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'`
  - Extracted defaults: `const DEFAULT_PRIORITY = PRIORITY_CONFIG.MEDIUM`
  - Safe lookups: `PRIORITY_CONFIG[task.priority] ?? DEFAULT_PRIORITY`
- All errors resolved by 06:23:06 typecheck pass

## Pattern Details

**Root cause:** Server/Prisma schema declares `status: string` and `priority: string`, but client needs specific enums for type safety.

**Places this appears:**
1. Select handler callbacks receiving string, must cast to union before server action
2. Config object lookups where key might not exist (fallback to DEFAULT_*)
3. Type guards on component props before rendering

**Solution template:**
```typescript
// In select change handler: cast to strict union
const handleStatusChange = (value: string) => {
  await updateTask({
    id: task.id,
    status: value as 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  });
};

// In render: extract defaults and use fallback
const DEFAULT_PRIORITY = PRIORITY_CONFIG.MEDIUM;
const priority = PRIORITY_CONFIG[task.priority] ?? DEFAULT_PRIORITY;
```

**Why it matters:** Prevents cascading type errors and silent undefined lookups. Guarantees handlers can never pass invalid enum values to server.
