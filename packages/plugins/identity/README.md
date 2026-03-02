# @harness/plugin-identity

Gives orchestrator threads a persistent identity. Threads assigned to an agent receive a soul header and behavioral anchor injected into every prompt, and the agent accumulates episodic memories from significant conversations.

---

## What this plugin provides

- **Soul injection** — the agent's soul and identity documents are prepended to every prompt, establishing character before Claude reads the user message.
- **Episodic memory** — after each invocation, the response is scored for importance (1–10). Responses scoring ≥ 6 are summarized and stored as `AgentMemory` records, retrieved in future conversations.
- **Behavioral anchor** — a short reinforcement block is appended after the user message, counteracting persona drift in long or code-heavy responses.
- **Chain of Persona** — a brief self-reflection instruction prompts Claude to consider who the agent is before responding (PCL 2025 technique for character consistency).

---

## How it works

On every invocation for a thread that has an agent assigned:

1. The agent's soul (≤5000 chars) and identity (≤2000 chars) are injected as a header above the user message.
2. Up to 10 relevant memories are retrieved using a recency + importance score and included in the header.
3. A behavioral anchor (the agent's name and core principle) is appended below the user message.
4. After Claude responds, the output is scored for importance by Haiku. If importance ≥ 6, the response is summarized and saved as an episodic memory for future retrieval.

Threads with no agent assigned are completely unaffected — the plugin is a no-op for them.

---

## Creating an agent

Agents are created and managed via the `/agents` page in the web dashboard. Each agent has:

| Field | Purpose |
|---|---|
| `name` | Display name, used in prompts |
| `soul` | Core character document (see format below) |
| `identity` | Supplementary identity notes (role, backstory, capabilities) |
| `enabled` | Whether the agent is active |

Assign an agent to a thread by setting `thread.agentId` in the database or via the thread settings UI.

---

## Soul file format

The soul document follows the OpenClaw four-section structure:

```markdown
# Core Truths

What is fundamentally true about this agent? What does it believe at its core?
These are the non-negotiable axioms of character.

# Boundaries

What will this agent never do? What are its hard limits?
Phrased as commitments, not prohibitions.

# Vibe

How does this agent communicate? Tone, style, energy level.
What does it feel like to talk to this agent?

# Continuity

What should this agent remember about itself across conversations?
Persistent facts, ongoing goals, important relationships.
```

The first non-empty line of the soul document is extracted as the "core principle" used in the behavioral anchor. Keep it short and declarative.

---

## Memory retrieval

Memories are stored as `AgentMemory` records in the database with:

- `content` — 1–2 sentence summary of what happened (past tense, third person)
- `importance` — integer 1–10 (Park et al. scale)
- `type` — always `EPISODIC` currently
- `lastAccessedAt` — updated every time the memory is retrieved

Retrieval scores each memory using:

```
score = recency + importance
recency = 0.995 ^ (hours_since_last_access)    // exponential decay
importance = memory.importance / 10             // normalized to 0–1
```

The top 10 memories by score are injected into the prompt. Retrieval also updates `lastAccessedAt`, so recently retrieved memories receive a recency boost on subsequent calls.

Importance is rated by `claude-haiku-4-5-20251001` on the 1–10 scale after each invocation:
- **1–5**: Mundane (not stored)
- **6–10**: Significant — stored as a memory

---

## Configuration

Like all plugins, the identity plugin can be enabled or disabled at runtime via the `PluginConfig` table in the database — no code changes required. When disabled, no soul injection or memory writing occurs for any thread.
