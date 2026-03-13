# Phase 9: Agents Page

**Goal**: Agent cards should feel like character profiles, not CRUD entries.

**Current files**:
- `apps/web/src/app/(chat)/agents/page.tsx`
- `apps/web/src/app/(chat)/agents/_components/agent-card.tsx`
- `apps/web/src/app/(chat)/agents/[agent-id]/page.tsx`

---

## Current State

Agent cards show: name, slug, enabled badge, thread count, Edit button, Delete button.

That's all. For an entity that has a soul, identity, role, goal, backstory, memories, config flags, and scheduled tasks — the card tells you almost nothing.

---

## What the Schema Offers

From `Agent` model:
- `name`, `slug`, `version`, `enabled`
- `soul` (text — the agent's core personality description)
- `identity` (text — detailed identity instructions)
- `role`, `goal`, `backstory`
- Relations: `threads[]`, `memories[]`, `config`, `cronJobs[]`

From `AgentConfig`:
- `memoryEnabled`, `reflectionEnabled`, `bootstrapped`

Counts available:
- `_count.threads`
- `_count.memories`
- `_count.cronJobs`

---

## New Agent Card Design

```
┌─────────────────────────────────────────────────────┐
│ Assistant                                    ● On   │
│ default · v1                                        │
│                                                     │
│ "A helpful AI assistant that adapts to..."          │  ← first ~80 chars of soul
│                                                     │
│ Role: General Assistant                             │  ← if role exists
│ Goal: Help users accomplish tasks                   │  ← if goal exists
│                                                     │
│ 1 thread · 24 memories · 4 tasks                    │  ← relation counts
│ Memory ✓  Reflection ✗  Bootstrapped ✓              │  ← config flags as checkmarks
│                                                     │
│                              ✏ Edit    🗑 Delete     │  ← hover-reveal actions
└─────────────────────────────────────────────────────┘
```

### Key Changes

1. **Soul preview**: Show first ~80 characters of the `soul` field in italics or a quote style. This gives each card personality — you can tell agents apart at a glance.

2. **Role and Goal**: If populated, show as small labeled fields. These are the quick-scan identity of the agent.

3. **Relation counts**: Thread count (already shown), memory count (new), cron job count (new). Gives you a sense of how active/configured the agent is.

4. **Config flags**: Tiny indicators for memory, reflection, bootstrapped status. Use checkmarks or colored dots.

5. **Version indicator**: Show `v1` next to slug. Already exists in the edit form but not on the card.

6. **Hover-reveal actions**: Edit and Delete buttons appear on hover instead of always visible. The card is currently already using the two-click delete pattern — keep that.

### Grid Layout

Current: 2-column grid (`sm:grid-cols-2`).
Keep this — agent cards are wider and have more content than plugin cards. With 2-3 agents, this fills the space well.

---

## Data Fetching Change

Current query in `page.tsx` needs to be expanded to include:

```tsx
const agents = await prisma.agent.findMany({
  include: {
    config: { select: { memoryEnabled: true, reflectionEnabled: true, bootstrapped: true } },
    _count: { select: { threads: true, memories: true, cronJobs: true } },
  },
});
```

This adds the config flags and relation counts needed for the enriched card.

The `soul` field is already on the `Agent` model — just need to pass it to the card component and truncate for preview.

---

## Estimated Scope

- Expand `AgentCard` props and rendering
- Update page query to include config + counts
- Moderate effort — enriching an existing component
