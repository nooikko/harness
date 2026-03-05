# Default Agent with Bootstrap Onboarding

**Date:** 2026-03-04
**Status:** Approved

## Problem

The agents page is empty on first run. New threads are created without an agent (`agentId: null`), so they receive no soul injection, no memory, no personality. The system has a rich identity system that goes unused until someone manually creates an agent.

## Solution

Seed a default user-facing agent with generic defaults. On first interaction, inject a bootstrap prompt that makes the agent conversationally discover its own identity (name, personality, vibe). The agent writes its own identity back to the database via a new MCP tool, then the bootstrap prompt stops firing.

Inspired by OpenClaw's BOOTSTRAP.md pattern — but adapted to Harness's plugin architecture.

## Design

### 1. Seed Data — Default Agent

Add to `packages/database/prisma/seed.ts`:

```
slug: 'default'
name: 'Assistant'
soul: (generic helpful assistant, ~200 words)
identity: "You are a personal AI assistant. Your personality hasn't been customized yet."
enabled: true
```

Also seed an `AgentConfig` for this agent with `bootstrapped: false`, `memoryEnabled: true`, `reflectionEnabled: false`.

The System agent is unchanged — it remains for automation only.

### 2. Schema Change — `bootstrapped` flag

Add to `AgentConfig` in `packages/database/prisma/schema.prisma`:

```prisma
model AgentConfig {
  // ... existing fields
  bootstrapped Boolean @default(false)
}
```

`bootstrapped: false` means the bootstrap prompt is injected. `bootstrapped: true` means normal behavior.

### 3. Bootstrap Prompt Injection

In the identity plugin's `onBeforeInvoke`, when loading agent config:

- If `config?.bootstrapped === false` (or no config exists and agent slug is `'default'`):
  - Inject a bootstrap prompt section BEFORE the normal soul header
  - The bootstrap prompt instructs the agent to:
    1. Introduce itself warmly and explain it's brand new
    2. Ask what the user wants to call it (one question at a time)
    3. Explore personality/vibe conversationally
    4. When satisfied, use `identity__update_self` to write its new identity
  - The normal soul/identity are still injected (so the agent has *something* to work with)

- If `config?.bootstrapped === true`:
  - Normal behavior (soul + memories, no bootstrap)

New helper: `packages/plugins/identity/src/_helpers/format-bootstrap-prompt.ts`

### 4. New MCP Tool — `identity__update_self`

Add `tools` array to the identity plugin definition:

```typescript
{
  name: 'update_self',
  description: 'Update your own agent identity — name, personality, soul, role, etc.',
  schema: {
    type: 'object',
    properties: {
      name:      { type: 'string', description: 'Your new display name' },
      soul:      { type: 'string', description: 'Your core personality and values' },
      identity:  { type: 'string', description: 'Who you are — a concise self-description' },
      role:      { type: 'string', description: 'Your role (e.g., "Creative Writing Partner")' },
      goal:      { type: 'string', description: 'Your primary goal' },
      backstory: { type: 'string', description: 'Your background story' },
    },
  },
  handler: async (ctx, input, meta) => {
    // 1. Resolve agentId from meta.threadId
    // 2. Update Agent record (only fields provided)
    // 3. Upsert AgentConfig with bootstrapped: true
    // 4. If name changed, update slug too
    // 5. Return confirmation
  },
}
```

This tool is always available, not just during bootstrap — users can ask "change your name to X" anytime.

### 5. Thread Creation — Auto-assign Default Agent

Modify `apps/web/src/app/(chat)/chat/_actions/create-thread.ts`:

```typescript
// If no agentId specified, look up default agent
if (!options?.agentId) {
  const defaultAgent = await prisma.agent.findUnique({
    where: { slug: 'default' },
    select: { id: true },
  });
  if (defaultAgent) {
    agentId = defaultAgent.id;
  }
}
```

Fallback: if the default agent was deleted, threads are created without an agent (current behavior).

## Files Changed

| File | Change |
|------|--------|
| `packages/database/prisma/schema.prisma` | Add `bootstrapped` to AgentConfig |
| `packages/database/prisma/seed.ts` | Add default agent + its AgentConfig |
| `packages/plugins/identity/src/index.ts` | Add `tools` array, modify `onBeforeInvoke` for bootstrap |
| `packages/plugins/identity/src/_helpers/format-bootstrap-prompt.ts` | NEW — bootstrap prompt template |
| `packages/plugins/identity/src/_helpers/update-agent-self.ts` | NEW — tool handler |
| `apps/web/src/app/(chat)/chat/_actions/create-thread.ts` | Auto-assign default agent |

## Non-Goals

- No changes to the agents list page UI (the default agent will just appear there)
- No special visual treatment for "bootstrapping" state in the chat UI
- No changes to the System agent
- No migration of existing threads to the default agent
