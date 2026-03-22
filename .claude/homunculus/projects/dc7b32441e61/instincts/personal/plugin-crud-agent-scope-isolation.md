---
id: plugin-crud-agent-scope-isolation
trigger: when modifying plugin CRUD handler functions to enforce multi-tenant isolation
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin CRUD Handlers Require Agent Scope Isolation

## Action
Always add agent scope resolution to all plugin CRUD handlers (list, get, update, delete) and filter database queries by agentId from the resolved scope.

## Evidence
- Observed 4 times consistently: list-cron-jobs, get-cron-job, update-cron-job, delete-cron-job
- Pattern: (1) call resolveAgentScope(ctx, meta), (2) filter `where` clauses to include `agentId: scopeResult.scope.agentId`, (3) use findFirst instead of findUnique when scoping by agentId
- Last observed: 2026-03-14

## Implementation Details

### Helper Pattern
Create a shared `resolveAgentScope` helper that:
- Takes PluginContext and PluginToolMeta
- Queries thread by threadId to get agentId
- Returns `{ ok: true, scope: { agentId } }` or `{ ok: false, error: string }`

### Handler Pattern
Each CRUD handler should:
1. Call `const scopeResult = await resolveAgentScope(ctx, meta)`
2. Early return with error if `!scopeResult.ok`
3. Add `agentId: scopeResult.scope.agentId` to all `where` clauses
4. Use `findFirst` instead of `findUnique` when filtering by name + agentId

Example:
```
const job = await ctx.db.cronJob.findFirst({
  where: { name, agentId: scopeResult.scope.agentId }
});
```

## Why
Prevents agents from accessing or modifying other agents' scheduled tasks. Multi-tenant safety is critical.
