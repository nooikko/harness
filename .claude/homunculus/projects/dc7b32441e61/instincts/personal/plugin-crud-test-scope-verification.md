---
id: plugin-crud-test-scope-verification
trigger: when writing tests for plugin CRUD handlers with agent scope isolation
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin CRUD Tests Must Verify Agent Scope

## Action
Update test fixtures and test cases to mock thread scope resolution and verify that database queries are scoped by agentId.

## Evidence
- Observed 4 times: list-cron-jobs.test.ts, get-cron-job.test.ts, update-cron-job.test.ts, delete-cron-job.test.ts
- Pattern: (1) add thread.findUnique mock returning { agentId }, (2) add test assertions verifying agentId is included in where clause, (3) add test for error when thread has no agent
- Last observed: 2026-03-14

## Implementation Details

### Mock Context Setup
When creating mock PluginContext, include:
```javascript
db: {
  thread: {
    findUnique: vi.fn().mockResolvedValue({ agentId: "agent-1" }),
  },
  cronJob: {
    findFirst: vi.fn().mockResolvedValue(mockJob),
    // ... other methods
  }
} as never
```

### Required Test Cases
For each CRUD handler test suite, add:
1. Test that verifies scope is included in where clause (use `expect().toHaveBeenCalledWith()`)
2. Test that returns error when thread has no agent
3. Test that query includes `agentId` filter alongside other filters (e.g., `{ name, agentId }`)

### Test Example
```javascript
it("scopes query by name and agentId", async () => {
  await getCronJob(ctx, { name: "Morning Digest" }, defaultMeta);

  expect(db.cronJob.findFirst).toHaveBeenCalledWith({
    where: { name: "Morning Digest", agentId: "agent-1" },
    // ...
  });
});
```

## Why
Tests must verify the multi-tenant isolation is actually enforced, not just that the helper is called.
