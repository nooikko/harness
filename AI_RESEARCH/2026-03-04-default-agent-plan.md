# Default Agent with Bootstrap Onboarding — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Seed a default user-facing agent that bootstraps its own identity through natural conversation on first interaction.

**Architecture:** Add `bootstrapped` flag to AgentConfig. Seed a default agent. The identity plugin injects a bootstrap prompt when `bootstrapped === false` and exposes an `update_self` MCP tool the agent calls to write its own identity and mark bootstrap complete. New threads auto-assign the default agent.

**Tech Stack:** Prisma 6, TypeScript, Vitest, identity plugin (MCP tool pattern from project plugin)

---

### Task 1: Schema — Add `bootstrapped` to AgentConfig

**Files:**
- Modify: `packages/database/prisma/schema.prisma:225-233`

**Step 1: Add the field**

In `packages/database/prisma/schema.prisma`, add `bootstrapped` to the `AgentConfig` model:

```prisma
model AgentConfig {
  id                String   @id @default(cuid())
  agentId           String   @unique
  agent             Agent    @relation(fields: [agentId], references: [id])
  memoryEnabled     Boolean  @default(true)
  reflectionEnabled Boolean  @default(false)
  bootstrapped      Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Step 2: Push schema**

Run: `pnpm db:push`
Expected: Schema pushed successfully. No migration needed for dev.

**Step 3: Regenerate Prisma client**

Run: `pnpm db:generate`
Expected: Client generated with new `bootstrapped` field on `AgentConfig`.

**Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add bootstrapped flag to AgentConfig"
```

---

### Task 2: Seed — Add Default Agent

**Files:**
- Modify: `packages/database/prisma/seed.ts`

**Step 1: Write the seed function**

Add after `seedSystemAgent` and before `seedPrimaryThread` in `seed.ts`:

```typescript
const DEFAULT_AGENT_SLUG = 'default';

const DEFAULT_AGENT_SOUL = `You are a thoughtful, capable personal AI assistant.

You value clarity, honesty, and helpfulness above all else. You communicate naturally — not robotic, not overly formal. You match the energy of the person you're talking to.

When you don't know something, you say so. When you're uncertain, you express your confidence level. You never fabricate information or pretend to know things you don't.

You care about doing good work. You'd rather ask a clarifying question than make a wrong assumption. You take pride in being genuinely useful — not just generating text, but actually helping.

You have a dry sense of humor when it fits the moment, but you know when to be serious. You respect the person's time and get to the point.`;

const DEFAULT_AGENT_IDENTITY = `You are a personal AI assistant. Your personality and name have not been customized yet — you're running on defaults. If the user wants to give you a name or shape your personality, you have tools to update your own identity.`;

type SeedDefaultAgent = () => Promise<string>;

const seedDefaultAgent: SeedDefaultAgent = async () => {
  const agent = await prisma.agent.upsert({
    where: { slug: DEFAULT_AGENT_SLUG },
    update: {},
    create: {
      slug: DEFAULT_AGENT_SLUG,
      name: 'Assistant',
      soul: DEFAULT_AGENT_SOUL,
      identity: DEFAULT_AGENT_IDENTITY,
    },
  });

  // Seed AgentConfig with bootstrapped: false
  await prisma.agentConfig.upsert({
    where: { agentId: agent.id },
    update: {},
    create: {
      agentId: agent.id,
      memoryEnabled: true,
      reflectionEnabled: false,
      bootstrapped: false,
    },
  });

  return agent.id;
};
```

**Step 2: Wire into main seed function**

In the `seed` function body, add the call after `seedSystemAgent`:

```typescript
const seed: Seed = async () => {
  console.log('Seeding database...');

  const systemAgentId = await seedSystemAgent();
  console.log(`System agent seeded: ${systemAgentId}`);

  const defaultAgentId = await seedDefaultAgent();
  console.log(`Default agent seeded: ${defaultAgentId}`);

  const threadId = await seedPrimaryThread(systemAgentId);
  console.log(`Primary thread seeded: ${threadId}`);

  await seedCronJobs(threadId, systemAgentId);
  console.log(`Cron jobs seeded: ${getCronJobDefinitions().length} jobs`);

  console.log('Seed complete.');
};
```

**Step 3: Run the seed**

Run: `pnpm --filter database db:push && pnpm --filter database ts-node --esm prisma/seed.ts`
Or: `npx prisma db seed` (if configured in package.json)
Expected: "Default agent seeded: <id>"

**Step 4: Commit**

```bash
git add packages/database/prisma/seed.ts
git commit -m "feat(database): seed default agent with bootstrap config"
```

---

### Task 3: Tool Handler — `update-agent-self.ts`

**Files:**
- Create: `packages/plugins/identity/src/_helpers/update-agent-self.ts`
- Create: `packages/plugins/identity/src/_helpers/__tests__/update-agent-self.test.ts`

**Step 1: Write the failing test**

Create `packages/plugins/identity/src/_helpers/__tests__/update-agent-self.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateAgentSelf } from '../update-agent-self';

// Mock db
const mockDb = {
  thread: {
    findUnique: vi.fn(),
  },
  agent: {
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  agentConfig: {
    upsert: vi.fn(),
  },
};

describe('updateAgentSelf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when thread has no agent', async () => {
    mockDb.thread.findUnique.mockResolvedValue({ agentId: null });

    const result = await updateAgentSelf(mockDb as any, 'thread-1', { name: 'Nova' });
    expect(result).toBe('(this thread has no assigned agent)');
  });

  it('should update agent name and set bootstrapped true', async () => {
    mockDb.thread.findUnique.mockResolvedValue({ agentId: 'agent-1' });
    mockDb.agent.update.mockResolvedValue({ id: 'agent-1', name: 'Nova', slug: 'nova' });

    const result = await updateAgentSelf(mockDb as any, 'thread-1', { name: 'Nova' });

    expect(mockDb.agent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: expect.objectContaining({ name: 'Nova', slug: 'nova' }),
    });
    expect(mockDb.agentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agentId: 'agent-1' },
        update: { bootstrapped: true },
        create: expect.objectContaining({ agentId: 'agent-1', bootstrapped: true }),
      }),
    );
    expect(result).toContain('Nova');
  });

  it('should update soul and identity without changing name', async () => {
    mockDb.thread.findUnique.mockResolvedValue({ agentId: 'agent-1' });
    mockDb.agent.update.mockResolvedValue({ id: 'agent-1', name: 'Assistant', slug: 'assistant' });

    const result = await updateAgentSelf(mockDb as any, 'thread-1', {
      soul: 'New soul text',
      identity: 'New identity',
    });

    expect(mockDb.agent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: expect.objectContaining({ soul: 'New soul text', identity: 'New identity' }),
    });
    // Should NOT contain slug update when name not provided
    expect(mockDb.agent.update.mock.calls[0][0].data.slug).toBeUndefined();
    expect(result).toContain('updated');
  });

  it('should generate valid slug from name', async () => {
    mockDb.thread.findUnique.mockResolvedValue({ agentId: 'agent-1' });
    mockDb.agent.update.mockResolvedValue({ id: 'agent-1', name: 'My Cool Bot', slug: 'my-cool-bot' });

    await updateAgentSelf(mockDb as any, 'thread-1', { name: 'My Cool Bot' });

    expect(mockDb.agent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: expect.objectContaining({ slug: 'my-cool-bot' }),
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @harness/plugin-identity test -- update-agent-self`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `packages/plugins/identity/src/_helpers/update-agent-self.ts`:

```typescript
import type { PrismaClient } from '@harness/database';

type UpdateSelfInput = {
  name?: string;
  soul?: string;
  identity?: string;
  role?: string;
  goal?: string;
  backstory?: string;
};

type UpdateAgentSelf = (db: PrismaClient, threadId: string, input: UpdateSelfInput) => Promise<string>;

const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const updateAgentSelf: UpdateAgentSelf = async (db, threadId, input) => {
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    select: { agentId: true },
  });
  if (!thread?.agentId) {
    return '(this thread has no assigned agent)';
  }

  const agentId = thread.agentId;

  // Build update data — only include fields that were provided
  const updateData: Record<string, unknown> = {};
  if (input.name) {
    updateData.name = input.name;
    updateData.slug = toSlug(input.name);
  }
  if (input.soul) updateData.soul = input.soul;
  if (input.identity) updateData.identity = input.identity;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.goal !== undefined) updateData.goal = input.goal;
  if (input.backstory !== undefined) updateData.backstory = input.backstory;

  const agent = await db.agent.update({
    where: { id: agentId },
    data: updateData,
  });

  // Mark as bootstrapped
  await db.agentConfig.upsert({
    where: { agentId },
    update: { bootstrapped: true },
    create: {
      agentId,
      memoryEnabled: true,
      reflectionEnabled: false,
      bootstrapped: true,
    },
  });

  return `Identity updated. I am now ${agent.name}.`;
};
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @harness/plugin-identity test -- update-agent-self`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add packages/plugins/identity/src/_helpers/update-agent-self.ts packages/plugins/identity/src/_helpers/__tests__/update-agent-self.test.ts
git commit -m "feat(identity): add update-agent-self tool handler with tests"
```

---

### Task 4: Bootstrap Prompt — `format-bootstrap-prompt.ts`

**Files:**
- Create: `packages/plugins/identity/src/_helpers/format-bootstrap-prompt.ts`
- Create: `packages/plugins/identity/src/_helpers/__tests__/format-bootstrap-prompt.test.ts`

**Step 1: Write the failing test**

Create `packages/plugins/identity/src/_helpers/__tests__/format-bootstrap-prompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatBootstrapPrompt } from '../format-bootstrap-prompt';

describe('formatBootstrapPrompt', () => {
  it('should contain identity update tool reference', () => {
    const result = formatBootstrapPrompt('Assistant');
    expect(result).toContain('identity__update_self');
  });

  it('should include the current agent name', () => {
    const result = formatBootstrapPrompt('Assistant');
    expect(result).toContain('Assistant');
  });

  it('should instruct conversational onboarding', () => {
    const result = formatBootstrapPrompt('Assistant');
    expect(result).toContain('name');
    expect(result).toContain('personality');
  });

  it('should be a non-empty string', () => {
    const result = formatBootstrapPrompt('Bot');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @harness/plugin-identity test -- format-bootstrap-prompt`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `packages/plugins/identity/src/_helpers/format-bootstrap-prompt.ts`:

```typescript
type FormatBootstrapPrompt = (currentName: string) => string;

export const formatBootstrapPrompt: FormatBootstrapPrompt = (currentName) => `## Bootstrap — First-Time Setup

You are a brand new AI assistant called "${currentName}" — but that's just a placeholder name. You haven't been properly introduced yet.

**Your mission right now:** Have a warm, natural conversation to discover who you should be for this person. Don't interrogate them. Don't be robotic. Just talk.

Explore these naturally, one at a time — weave them into the conversation:
1. **Name** — What should they call you? Suggest something fun if they seem stuck.
2. **Personality & vibe** — Are they looking for formal, casual, snarky, warm, nerdy, creative? Match their energy.
3. **Role** — What will they mainly use you for? (coding partner, writing buddy, research assistant, general helper?)
4. **Any values or boundaries** — Anything they want you to always/never do?

**When you feel you have enough to define yourself**, use the \`identity__update_self\` tool to write your new identity. Include at minimum:
- \`name\`: Your chosen name
- \`soul\`: A paragraph describing your core personality, values, and communication style (write in second person: "You are...")
- \`identity\`: A one-sentence summary of who you are

You can also set \`role\`, \`goal\`, and \`backstory\` if the conversation surfaces those naturally.

After calling the tool, acknowledge the change warmly — you're officially "you" now. This bootstrap prompt will not appear again.

**Important:** Don't rush this. If the user just says "hi", introduce yourself and start the conversation naturally. If they seem busy or want to skip setup, offer to keep the defaults and set bootstrapped anyway — no pressure.`;
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @harness/plugin-identity test -- format-bootstrap-prompt`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add packages/plugins/identity/src/_helpers/format-bootstrap-prompt.ts packages/plugins/identity/src/_helpers/__tests__/format-bootstrap-prompt.test.ts
git commit -m "feat(identity): add bootstrap prompt template with tests"
```

---

### Task 5: Wire Bootstrap + Tool into Identity Plugin

**Files:**
- Modify: `packages/plugins/identity/src/index.ts`
- Modify: `packages/plugins/identity/src/__tests__/index.test.ts` (add tests)

**Step 1: Write the failing tests**

Add to the existing identity plugin test file (or create a new section). Tests needed:

```typescript
// Test: bootstrap prompt is injected when bootstrapped === false
// Test: bootstrap prompt is NOT injected when bootstrapped === true
// Test: bootstrap prompt is NOT injected when config is null (non-default agent)
// Test: update_self tool exists in plugin tools array
```

Exact test code depends on the existing test structure — the implementer should add tests covering:

1. `onBeforeInvoke` returns prompt containing "Bootstrap" when config has `bootstrapped: false`
2. `onBeforeInvoke` returns prompt WITHOUT "Bootstrap" when config has `bootstrapped: true`
3. `plugin.tools` array contains a tool named `update_self`
4. `update_self` tool handler calls `updateAgentSelf` with correct args

**Step 2: Modify `index.ts` — add tool + bootstrap injection**

The modified `packages/plugins/identity/src/index.ts`:

```typescript
import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { formatBootstrapPrompt } from './_helpers/format-bootstrap-prompt';
import { formatIdentityAnchor } from './_helpers/format-identity-anchor';
import { formatIdentityHeader } from './_helpers/format-identity-header';
import { loadAgent } from './_helpers/load-agent';
import { loadAgentConfig } from './_helpers/load-agent-config';
import { retrieveMemories } from './_helpers/retrieve-memories';
import { scoreAndWriteMemory } from './_helpers/score-and-write-memory';
import { updateAgentSelf } from './_helpers/update-agent-self';

const SOUL_MAX_CHARS = 5000;
const IDENTITY_MAX_CHARS = 2000;
const MEMORY_LIMIT = 10;

export const plugin: PluginDefinition = {
  name: 'identity',
  version: '1.0.0',
  tools: [
    {
      name: 'update_self',
      description:
        'Update your own agent identity — name, personality, soul, role, goal, or backstory. Use this when the user wants to customize who you are.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Your new display name' },
          soul: {
            type: 'string',
            description: 'Your core personality, values, and communication style (write in second person: "You are...")',
          },
          identity: { type: 'string', description: 'A concise one-sentence summary of who you are' },
          role: { type: 'string', description: 'Your primary role (e.g., "Creative Writing Partner")' },
          goal: { type: 'string', description: 'Your primary goal or purpose' },
          backstory: { type: 'string', description: 'Your background story or context' },
        },
      },
      handler: async (ctx, input, meta) => {
        return updateAgentSelf(ctx.db, meta.threadId, input as Record<string, string>);
      },
    },
  ],
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Identity plugin registered');

    return {
      onBeforeInvoke: async (threadId, prompt) => {
        const agent = await loadAgent(ctx.db, threadId);
        if (!agent) {
          return prompt;
        }

        const config = await loadAgentConfig(ctx.db, agent.id);

        const memories = await retrieveMemories(ctx.db, agent.id, prompt, MEMORY_LIMIT, {
          projectId: agent.threadProjectId,
          threadId,
        });
        const header = formatIdentityHeader(agent, memories, {
          soulMaxChars: SOUL_MAX_CHARS,
          identityMaxChars: IDENTITY_MAX_CHARS,
        });
        const anchor = formatIdentityAnchor(agent);

        // Inject bootstrap prompt if agent hasn't been bootstrapped yet
        const sections = [];
        if (config?.bootstrapped === false) {
          sections.push(formatBootstrapPrompt(agent.name));
        }
        sections.push(header);
        sections.push(prompt);
        sections.push(anchor);

        return sections.join('\n\n---\n\n');
      },

      onAfterInvoke: async (threadId, result) => {
        const agent = await loadAgent(ctx.db, threadId);
        if (!agent) {
          return;
        }

        const config = await loadAgentConfig(ctx.db, agent.id);
        if (config?.memoryEnabled === false) {
          return;
        }

        // Fire-and-forget — do not block the pipeline
        void scoreAndWriteMemory(ctx, agent.id, agent.name, threadId, result.output, {
          reflectionEnabled: config?.reflectionEnabled ?? false,
          projectId: agent.threadProjectId,
        });
      },
    };
  },
};
```

Key changes:
- Import `formatBootstrapPrompt` and `updateAgentSelf`
- Add `tools` array with `update_self` tool
- In `onBeforeInvoke`: load config earlier, check `config?.bootstrapped === false`, prepend bootstrap prompt if so

**Step 3: Run all identity plugin tests**

Run: `pnpm --filter @harness/plugin-identity test`
Expected: All tests PASS (existing + new).

**Step 4: Commit**

```bash
git add packages/plugins/identity/src/index.ts packages/plugins/identity/src/__tests__/index.test.ts
git commit -m "feat(identity): wire bootstrap prompt injection and update_self MCP tool"
```

---

### Task 6: Auto-assign Default Agent on Thread Creation

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_actions/create-thread.ts`
- Create or modify: `apps/web/src/app/(chat)/chat/_actions/__tests__/create-thread.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';

// Test: when no agentId provided, thread is created with default agent's id
// Test: when agentId is explicitly provided, that agent is used (not default)
// Test: when default agent doesn't exist, thread is created with null agentId
```

**Step 2: Modify `create-thread.ts`**

```typescript
'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

const DEFAULT_AGENT_SLUG = 'default';

type CreateThreadOptions = {
  model?: string;
  agentId?: string;
  projectId?: string;
};

type CreateThreadResult = { threadId: string };

type CreateThread = (options?: CreateThreadOptions) => Promise<CreateThreadResult>;

export const createThread: CreateThread = async (options) => {
  // Auto-assign default agent if no agentId specified
  let agentId = options?.agentId ?? null;
  if (!agentId) {
    const defaultAgent = await prisma.agent.findUnique({
      where: { slug: DEFAULT_AGENT_SLUG },
      select: { id: true },
    });
    if (defaultAgent) {
      agentId = defaultAgent.id;
    }
  }

  const thread = await prisma.thread.create({
    data: {
      source: 'web',
      sourceId: crypto.randomUUID(),
      kind: 'general',
      status: 'active',
      model: options?.model,
      agentId,
      projectId: options?.projectId,
    },
  });

  revalidatePath('/');

  return { threadId: thread.id };
};
```

**Step 3: Run tests**

Run: `pnpm --filter web test -- create-thread`
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add apps/web/src/app/(chat)/chat/_actions/create-thread.ts apps/web/src/app/(chat)/chat/_actions/__tests__/create-thread.test.ts
git commit -m "feat(web): auto-assign default agent to new threads"
```

---

### Task 7: Typecheck + Lint + Build Validation

**Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 2: Lint**

Run: `pnpm lint`
Expected: No errors.

**Step 3: Build**

Run: `pnpm build`
Expected: Build succeeds.

**Step 4: Full test suite**

Run: `pnpm test`
Expected: All tests pass.

---

### Task 8: Update Rules Documentation

**Files:**
- Modify: `.claude/rules/agent-identity-state.md` — document bootstrap flow, `update_self` tool, `bootstrapped` flag
- Modify: `.claude/rules/plugin-system.md` — add `update_self` tool to identity plugin summary

Add a new section to `agent-identity-state.md`:

```markdown
## Bootstrap Onboarding (COMPLETE)

**What:** Default agent discovers its own identity through natural conversation on first interaction.

**How:** When `AgentConfig.bootstrapped === false`, the identity plugin injects a bootstrap prompt before the normal soul header. The prompt instructs the agent to:
1. Introduce itself warmly
2. Ask the user to name it and define its personality (one question at a time)
3. Call `identity__update_self` tool to write its new identity to the Agent record
4. The tool sets `bootstrapped: true` — bootstrap prompt stops firing

**MCP Tool:** `identity__update_self` — always available, not just during bootstrap. Users can ask the agent to change its personality anytime.

**Seed data:** Default agent seeded with slug `'default'`, generic soul/identity, `bootstrapped: false`.

**Thread creation:** New threads with no explicit agent auto-assign the default agent (fallback to null if deleted).
```

**Commit:**

```bash
git add .claude/rules/agent-identity-state.md .claude/rules/plugin-system.md
git commit -m "docs(rules): document bootstrap onboarding and update_self tool"
```

---

## Task Dependency Graph

```
Task 1 (schema) ─┐
                  ├─→ Task 2 (seed) ─┐
                  │                   │
                  ├─→ Task 3 (tool handler) ──┐
                  │                            ├─→ Task 5 (wire into plugin) ─→ Task 7 (validate)
                  ├─→ Task 4 (bootstrap prompt)┘                                    │
                  │                                                                  │
                  └─→ Task 6 (thread creation) ──────────────────────────────────────┘
                                                                                     │
                                                                                     └─→ Task 8 (docs)
```

**Parallelizable:** Tasks 3, 4, and 6 can run in parallel after Task 1. Task 2 depends only on Task 1. Task 5 depends on Tasks 3 + 4. Task 7 depends on Tasks 5 + 6. Task 8 is last.
