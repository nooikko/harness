---
id: fire-and-forget-plugin-background-tasks
trigger: when a plugin hook needs to spawn a background operation without blocking
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Fire-and-Forget Background Task Pattern in Plugins

## Action
Use `void` prefix with background async functions in hooks (e.g., `onMessage`, `onAfterInvoke`, `onBroadcast`) to prevent blocking the main pipeline while operations complete asynchronously.

## Evidence
- Observed 3 times in plugins: auto-namer, audit, summarization
- Pattern: Define async function that performs I/O (db writes, API calls) → call with `void` prefix in hook → logs failures independently
- Last observed: 2026-03-14 (auto-namer: `void generateNameInBackground(...)`, audit: `runAuditInBackground(...)`, summarization: `void summarizeInBackground(...)`)

## Implementation
```typescript
// Define the background function
const generateNameInBackground: GenerateNameInBackground = async (ctx, threadId, content) => {
  try {
    const name = await generateThreadName(ctx, content);
    await ctx.db.thread.update({ where: { id: threadId }, data: { name } });
  } catch (err) {
    ctx.logger.warn(`operation failed [thread=${threadId}]: ${err}`);
  }
};

// Call with void prefix in hook to fire-and-forget
onMessage: async (threadId, role, content) => {
  if (role === 'user') {
    void generateNameInBackground(ctx, threadId, content);  // Returns immediately
  }
}
```

This ensures HTTP responses return fast and long-running operations don't cascade delays.
