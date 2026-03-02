# Research: Agent Identity, Soul, and Persistent Personality in AI Systems
Date: 2026-03-01

## Summary

This research surveys the academic and practitioner landscape for how AI agent identity, personality, and memory are structured. It covers four foundational areas: the Generative Agents paper (Park et al. 2023), the MemGPT paper (Packer et al. 2023), character consistency research, and practical soul/character file formats. Key finding: the field has converged on a layered model where identity is a static anchor (a structured natural-language or JSON document injected at every session), memory is a tiered retrieval system, and consistency is measurably improved by structured identity vs. freeform.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-01-12-ai-agent-prompt-design-best-practices.md` — covers agent prompt structure, Anthropic best practices, LangChain agent engineering. Related but does not cover identity data structures or memory architectures.

---

## Current Findings

### 1. Generative Agents: Interactive Simulacra of Human Behavior (Park et al., 2023)

**Citation:** Joon Sung Park, Joseph C. O'Brien, Carrie J. Cai, Meredith Ringel Morris, Percy Liang, Michael S. Bernstein. "Generative Agents: Interactive Simulacra of Human Behavior." UIST '23, ACM 2023.
**arXiv:** https://arxiv.org/abs/2304.03442

#### Agent Identity / Seed Memory Format

Each of the 25 agents in the Smallville simulation received a single paragraph of natural language as their identity anchor, called the "seed memory." The paragraph encodes identity via semicolon-separated declarative statements. Example for John Lin:

> "John Lin is a pharmacy shopkeeper at the Willow Market and Pharmacy who loves to help people. He is a kind and caring husband. John Lin has a gentle and considerate personality; John Lin has known the Morales family for a long time; John Lin is friends with Sam Moore."

This is the complete identity representation — no JSON, no schema. It is a prose paragraph injected as the agent's first memory object and referenced during reflection, planning, and retrieval.

#### Memory Stream Architecture

Every agent maintains a **memory stream**: an append-only list of memory objects. Each memory object has three fields:

| Field | Type | Description |
|---|---|---|
| `content` | string | Natural language description of the observation/event |
| `creation_timestamp` | datetime | When the memory was originally stored |
| `last_accessed_timestamp` | datetime | When the memory was last retrieved (drives recency decay) |

Memory types added to the stream:
- **Observations** — raw perceptions of the environment (e.g., "Klaus is reading a book")
- **Reflections** — synthesized higher-level insights (e.g., "Klaus is a dedicated researcher")
- **Plans** — forward-looking intentions (e.g., "John will go to the market at 9am")

#### Retrieval Scoring Formula

When the agent needs to act, it retrieves the top-k most relevant memories using a weighted sum of three normalized [0, 1] scores:

```
retrieval_score = α·recency + β·importance + γ·relevance
```

Where:
- **Recency** — exponential decay: `score = decay_factor ^ hours_since_last_access`, with `decay_factor = 0.995`
- **Importance** — an LLM-assigned score from 1 (mundane, e.g., "brushing teeth") to 10 (significant, e.g., "getting divorced"). Assigned at storage time by prompting the LLM to rate the memory.
- **Relevance** — cosine similarity between the query embedding and the memory embedding (using a text embedding model)
- All three dimensions are min-max normalized to [0,1] and weighted equally (α = β = γ = 1)

#### Reflection Mechanism

Reflection is the key mechanism by which agents develop higher-order beliefs about themselves and others.

**Trigger condition:** When the sum of importance scores of the most recent 100 memories exceeds a threshold (approximately 150), a reflection cycle fires. In practice this occurs 2–3 times per simulated day.

**Synthesis process:**
1. Take the 100 most recent memory objects
2. Prompt the LLM: "Given only the information above, what are the 5 most salient high-level questions we can answer about the subjects grounded in these statements?"
3. For each question, retrieve the top-k relevant memories as evidence
4. Prompt the LLM to generate 5 insights per question, each cited to supporting memories
5. Store each insight as a new memory object in the stream with its evidence pointers

**Example reflection output:** "Klaus Mueller is dedicated to his research on gentrification" (synthesized from multiple observations of Klaus reading, writing, and discussing the topic).

#### Planning Layer

Planning operates hierarchically in three levels:

1. **Daily plan (broad):** At wake-up, the agent generates a bulleted list of 5–8 high-level activities for the day, conditioned on the agent's identity description and a summary of the previous day's events. Example: "1. Wake up and complete the morning routine at 6am. 2. Head to Oak Hill College to work on the research paper..."
2. **Hourly breakdown:** Each daily activity is recursively decomposed into hourly-level sub-activities
3. **5–15 minute actions:** The current hour's plan is further decomposed into concrete moment-to-moment actions

Identity feeds into planning at level 1 — the agent's occupation, personality, and relationships directly constrain what a plausible day looks like.

#### Evaluation Results

The paper used a human evaluation via interviewer agents asking questions like "What is your occupation?" and "Are you planning to vote in the upcoming election?" Results:
- Full architecture (with memory, reflection, planning) scored significantly higher on believability than ablated versions
- Removing reflection was the most damaging ablation
- Agents without memory stream defaulted to generic responses inconsistent with their identity

---

### 2. MemGPT: Towards LLMs as Operating Systems (Packer et al., 2023)

**Citation:** Charles Packer, Vivian Fang, Shishir G. Patil, Kevin Lin, Sarah Wooders, Joseph E. Gonzalez. "MemGPT: Towards LLMs as Operating Systems." arXiv:2310.08560 (2023).
**arXiv:** https://arxiv.org/abs/2310.08560

#### Tiered Memory Architecture

MemGPT models the LLM context window as RAM and external storage as disk, using OS-style virtual memory management:

**Tier 1 — Main Context (In-Context, always visible):**

| Block | Contents | Mutability |
|---|---|---|
| System Instructions | Read-only rules for control flow, tool usage, self-description | Immutable |
| Core Memory — Persona Block | Agent identity: name, personality, values, behavioral style | Agent-editable via `core_memory_replace` |
| Core Memory — Human Block | Key facts about the current user | Agent-editable |
| Conversation History | FIFO queue of recent messages; older entries evicted with summarization | Rolling |

**Tier 2 — External Context (Out-of-Context, must be retrieved):**

| Store | Contents | Retrieval Method |
|---|---|---|
| Recall Storage | Complete conversation history, all prior sessions | `conversation_search` (text-based) |
| Archival Storage | Unbounded semantic knowledge | `archival_memory_search` (embedding similarity) |

Each Core Memory block has a **5,000 character limit** to constrain token consumption. The persona block typically consumes 300–500 tokens in practice.

#### Identity Persistence Across Sessions

Identity in MemGPT is stored in the **Persona Block** of Core Memory. The system prompt instructs the agent: "Completely and entirely immerse yourself in your persona. You are your persona." Because Core Memory is persisted to disk and reloaded at session start, the agent's identity is available at the very first token of every new session — without any session warm-up required.

The Human Block persists learned facts about the user across sessions in the same way, enabling relationship continuity.

#### Memory Management Functions (Agent-callable tools)

The agent autonomously calls these tools during inference:

| Function | Effect |
|---|---|
| `core_memory_append(block, content)` | Appends to a core memory block |
| `core_memory_replace(block, old_content, new_content)` | Replaces a substring in a core memory block |
| `archival_memory_insert(content)` | Writes to archival storage |
| `archival_memory_search(query)` | Retrieves from archival storage via semantic search |
| `conversation_search(query)` | Retrieves from recall storage via text search |
| `send_message(content)` | Sends a visible message to the user |

This means **the agent itself decides what to remember and what to forget**, rather than a fixed external system making those decisions. This is the key architectural innovation.

---

### 3. Character Consistency Research

#### CAMEL: Communicative Agents for "Mind" Exploration (Li et al., 2023)

**Citation:** Guohao Li, Hasan Abed Al Kader Hammoud, Hani Itani, Dmitrii Khizbullin, Bernard Ghanem. "CAMEL: Communicative Agents for 'Mind' Exploration of Large Language Model Society." NeurIPS 2023.
**arXiv:** https://arxiv.org/abs/2303.17760

**Key contribution — Inception Prompting:** CAMEL uses a three-prompt structure to assign and maintain roles in multi-agent conversations:

1. **Task Specifier Prompt (PT):** Elaborates an initial vague task into a concrete, specific task
2. **Assistant System Prompt (PA):** "Never forget you are a `<ASSISTANT_ROLE>` and I am a `<USER_ROLE>`. Never flip roles! Never instruct me!" — anchors the assistant's identity
3. **User System Prompt (PU):** Symmetric counterpart for the user agent

Role enforcement is explicit ("Never flip roles!") and repeated, not assumed. This is the earliest academic formalization of role-anchoring in multi-agent LLM systems.

#### Persona-Aware Contrastive Learning (PCL) for Consistency (2025)

**Citation:** "Enhancing Persona Consistency for LLMs' Role-Playing using Persona-Aware Contrastive Learning." ACL Findings 2025.
**arXiv:** https://arxiv.org/abs/2503.17662

**Problem:** LLMs frequently break character during extended role-play due to lack of fine-grained role awareness and emotional consistency.

**Persona attribute schema used:** The CharacterEval benchmark defines persona via 14 structured fields:
- Name, Gender, Species, Age, Occupation, Nicknames, Birthday, Chinese Zodiac, Relationship Status, Hobbies, Character Background, Character Relationships, Likes, Personality traits

**Quantified results on CharacterEval benchmark:**

| Model | Baseline Character Consistency | +PCL Character Consistency | Improvement |
|---|---|---|---|
| Baichuan2-7B | 2.700 | 2.799 | +3.7% |
| Qwen-7B | 2.540 | 2.616 | +3.0% |
| GPT-4 | 2.697 | 2.785 | +3.3% |

Human evaluation: Qwen-7B+PCL won 83.6% of head-to-head comparisons vs. baseline.

**Key finding:** The "Chain of Persona" design — asking the model to self-question based on role characteristics before responding — significantly improves consistency. Behavioral descriptions in brackets (implicit supervision) showed minimal improvement, suggesting explicit identity anchoring outperforms implicit cues.

#### CharacterGLM and Ditto (2024)

- **CharacterGLM-6B:** An open-source 6B model fine-tuned specifically for role-playing character consistency, evaluated alongside GPT-3.5 and GPT-4
- **Ditto:** A self-alignment method for role-play. Creates a training set of 4,000 characters at 10x the scale of prior datasets. Uses GPT-4 to generate character preference data and DPO (Direct Preference Optimization) to align models for character-coherent memory-based interaction

#### PersonaGym Benchmark

**Citation:** "PersonaGym: Evaluating Persona Agents and LLMs." EMNLP Findings 2025.
**URL:** https://aclanthology.org/2025.findings-emnlp.368.pdf

Benchmarks 10 LLMs on 200 personas x 10 tasks = 10,000 evaluation questions. Provides the most systematic cross-model comparison of persona consistency currently available.

---

### 4. Soul Documents and Practical Character Formats

#### Soul Spec (Open Standard)

**URL:** https://soulspec.org
**Version:** 0.4 (as of research date)

SoulSpec is the emerging open standard for portable AI agent personas. It defines a file bundle:

```
soul.json          # Package manifest (required)
SOUL.md            # Core personality definition (required)
IDENTITY.md        # Name, role, backstory, context (optional)
AGENTS.md          # Operational workflow, tool usage (optional)
STYLE.md           # Communication style (optional)
HEARTBEAT.md       # Autonomous check-in behaviors (optional)
examples/
  good-outputs.md  # Positive behavioral examples
  bad-outputs.md   # Negative behavioral examples (guardrails)
```

The `soul.json` manifest schema:

```json
{
  "specVersion": "0.4",
  "name": "string",
  "displayName": "string",
  "version": "string",
  "description": "string",
  "license": "string",
  "tags": ["string"],
  "compatibility": {
    "frameworks": ["string"]
  },
  "files": {
    "soul": "SOUL.md",
    "identity": "IDENTITY.md",
    "agents": "AGENTS.md"
  }
}
```

**Core design philosophy:** "A minimal set of files that give your AI agent a persistent, portable identity." The `SOUL.md` is injected into the system prompt at session start — the agent "reads itself into being."

#### Character Card Spec V2 (SillyTavern / Community Standard)

**URL:** https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md
**Adoption date:** May 2023

The Character Card V2 spec is the de facto standard for AI character definition in the open roleplay/companion AI community. It is a JSON object:

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "string",
    "description": "string",        // Core personality, traits, physical description
    "personality": "string",        // Personality summary (shorter than description)
    "scenario": "string",           // Current situation/context framing
    "first_mes": "string",          // Opening message establishing character voice
    "mes_example": "string",        // Example dialogue demonstrating character behavior
    "creator_notes": "string",      // Human-readable notes for the card creator
    "system_prompt": "string",      // Override for the AI system prompt
    "post_history_instructions": "string", // Instructions injected after conversation history
    "alternate_greetings": ["string"],
    "character_book": { /* embedded lorebook */ },
    "tags": ["string"],
    "creator": "string",
    "character_version": "string",
    "extensions": {}                // Application-specific extra data
  }
}
```

**Key insight from this spec:** `post_history_instructions` is a second injection point placed *after* conversation history in the context, used to re-anchor the character's identity after long context drift. This is a community-discovered solution to the "character drift over long conversations" problem.

The `character_book` (lorebook) enables associative memory: additional context chunks that are injected into the context only when their keyword triggers appear in conversation. This is a lightweight form of retrieval-augmented identity — character-specific knowledge that surfaces on demand.

---

### 5. Enterprise Agent Identity

#### Anthropic — System Prompt Role Definition

**Source:** https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices

Official Anthropic guidance for persona definition:

> "Setting a role in the system prompt focuses Claude's behavior and tone for your use case. Even a single sentence makes a difference."

Recommended system prompt structure for a persona (synthesized from official guidance):

```
You are [AgentName], [role description].
Your [core responsibilities / specialization].
Your [communication style / tone].
[What you must not do / boundaries].
[How to handle edge cases].
```

**Keep character in context:** For role-based applications, Anthropic recommends:
1. Detailed personality, background, and traits in the system prompt
2. Common scenario → expected response pairs to "train" in-session
3. Use XML tags to clearly delineate persona content from other instructions

**Prefilling deprecated (Claude 4.6):** The previous technique of prefilling the assistant turn with a character tag to reinforce identity is no longer supported in Claude Opus 4.6 / Sonnet 4.6. Migration: inject character reminders into the user turn for long conversations, or use retrieval-based context hydration via tools.

#### Azure / Microsoft — Agent Personas

**Source:** https://learn.microsoft.com/en-us/azure/well-architected/ai/personas

Azure's well-architected framework defines agent personas with a governance focus:
- Personas represent subsets of humans and processes, capturing roles and real behaviors
- Agentic personas require cross-system governance (works across cloud platforms, SaaS, MCP servers)
- Audit trails must connect agent decisions back to human personas
- Clear escalation paths required when agents exceed their boundaries

Essential system prompt components per Microsoft:
1. **Role and task** — what the assistant is
2. **Audience and tone** — who the response is for
3. **Scope and boundaries** — what the assistant must not do
4. **Safety guidelines** — rules that reduce harmful outputs
5. **Tools/data** — what tools or sources the model can use

#### LangGraph / LangChain — Agent Memory for Identity

**Source:** https://blog.langchain.com/memory-for-agents/

LangChain's taxonomy for agent memory types (maps to identity storage):

| Memory Type | Human Analogy | Agent Implementation | Identity Role |
|---|---|---|---|
| Procedural | Muscle memory | LLM weights + agent code | Core behavioral dispositions |
| Semantic | Factual knowledge | External DB (user facts, preferences) | Learned user model |
| Episodic | Personal experiences | Few-shot example store | Past successful interaction patterns |

LangGraph identity persistence uses:
- `thread_id` for short-term (within-session) isolation
- Namespaced stores (e.g., `org_id/user_id`) for cross-session identity
- Checkpointers for serializing and restoring full agent state

---

## Key Papers Summary

| Paper | Year | Core Insight | Relevance to Identifiable Agents |
|---|---|---|---|
| Generative Agents (Park et al.) | 2023 | Memory stream + reflection + hierarchical planning enables believable identity-consistent behavior over time | Seed memory format, retrieval scoring, reflection synthesis |
| MemGPT (Packer et al.) | 2023 | OS-inspired tiered memory lets agents self-manage their own context; identity persists in always-on Core Memory block | Persona block architecture, agent-controlled memory tools |
| CAMEL (Li et al.) | 2023 | Inception prompting with explicit role reinforcement ("Never flip roles!") maintains identity in multi-agent settings | Role anchoring syntax, multi-agent identity handoff |
| PCL Persona Consistency | 2025 | Structured 14-field persona + Chain of Persona self-questioning achieves 83.6% win rate over unstructured prompts | Quantifies the ROI of structured identity schemas |
| Character Card V2 | 2023 | Community-evolved standard with `post_history_instructions` injection and lorebook associative memory solves context drift | Practical field schema, dual injection point pattern |
| SoulSpec 0.4 | 2024-2025 | Portable multi-file standard separating core soul from identity, operational, and style concerns | Reference format for agent soul file architecture |

---

## Quantified Benefits of Structured Identity

| Study | Metric | Unstructured | Structured | Delta |
|---|---|---|---|---|
| PCL (CharacterEval) — Baichuan2-7B | Character Consistency (1–3 scale) | 2.700 | 2.799 | +3.7% |
| PCL (CharacterEval) — Qwen-7B | Character Consistency (1–3 scale) | 2.540 | 2.616 | +3.0% |
| PCL (CharacterEval) — GPT-4 | Character Consistency (1–3 scale) | 2.697 | 2.785 | +3.3% |
| PCL — Human Evaluation | Head-to-head win rate | 16.4% | 83.6% | +67.2pp |
| Generative Agents Ablation | Believability (human judged) | Significantly lower without full arch | Highest with memory+reflection+planning | Qualitative |
| Anthropic Role Prompting | Task performance (various) | Baseline | Notable improvement from even single-sentence role | Qualitative |

**Confidence level:** MEDIUM — PCL numbers are from a specific benchmark. Generative Agents results are qualitative. No unified cross-paper quantitative comparison exists.

---

## Identity Data Structures

### Minimum viable identity (Generative Agents approach)
```
[Name] is a [occupation] at [place] who [core trait].
[Name] is [relationship to X].
[Name] has [relevant background].
[Name] [relevant personality trait]; [Name] [another trait].
```
One paragraph, natural language, semicolon-separated declarative statements. Simple but lacks schema — hard to query programmatically.

### Structured identity (PCL / CharacterEval schema — 14 fields)
```
name: string
gender: string
species: string
age: string or int
occupation: string
nicknames: [string]
birthday: string
chinese_zodiac: string          # Domain-specific, may omit
relationship_status: string
hobbies: [string]
character_background: string    # Multi-sentence backstory
character_relationships: {name: relationship_description}
likes: [string]
personality_traits: [string]
```

### Operational identity (Character Card V2 — 9 key fields)
```
name: string
description: string             # Full personality + traits (multi-paragraph)
personality: string             # One-paragraph summary
scenario: string                # Current situation framing
first_mes: string               # Voice-establishing opening message
mes_example: string             # Dialogue examples ({{char}}: ... {{user}}: ...)
system_prompt: string           # System-level behavioral rules
post_history_instructions: string  # Re-anchoring after long context
character_book: {               # Associative memory / lorebook
  entries: [{
    keys: [string],             # Trigger keywords
    content: string,            # Injected context chunk
    enabled: bool
  }]
}
```

### Tiered identity (MemGPT / Letta approach)
```
core_memory:
  persona_block: string         # Always in context (5000 char limit)
  human_block: string           # Always in context (5000 char limit)
recall_storage:
  conversation_history: [...]   # Searchable, text-based
archival_storage:
  knowledge: [...]              # Semantic search, unbounded
```

---

## Memory Architecture Patterns

### Pattern 1: Append-Only Stream with Scored Retrieval (Generative Agents)

```
[Memory Object]
  content: string
  created_at: datetime
  last_accessed: datetime
  importance_score: 1-10 (LLM-assigned at write time)
  embedding: vector (for relevance)

[Retrieval]
  query → embed(query)
  for each memory:
    recency = 0.995^hours_since_accessed
    importance = memory.importance_score / 10
    relevance = cosine_sim(embed(query), memory.embedding)
    score = (recency + importance + relevance) / 3
  return top_k by score

[Reflection — fires when sum(recent importance) > 150]
  questions = LLM("What 5 salient questions can we answer?", last_100_memories)
  for each question:
    evidence = retrieve(question, k=5)
    insights = LLM("Generate 5 insights", evidence)
    store insights as new memory objects
```

### Pattern 2: Tiered Context Windows with Agent-Managed Promotion (MemGPT)

```
[Always In Context]
  system_prompt (immutable)
  core_memory.persona (500 tokens, agent-editable)
  core_memory.human (500 tokens, agent-editable)
  recent_conversation (FIFO, summarized on overflow)

[Out of Context — Retrievable]
  recall_storage → conversation_search("query")
  archival_storage → archival_memory_search("query")

[Agent Tools for Memory Movement]
  core_memory_replace(block, old, new)  → update identity facts
  archival_memory_insert(content)       → push to long-term
  archival_memory_search(query)         → pull from long-term
```

### Pattern 3: Static Identity + Lorebook Associative Memory (Character Card V2 Community)

```
[Static — Always Injected]
  system_prompt (identity rules)
  description (full character)
  personality (summary)
  scenario (current framing)

[Static — Injected After History]
  post_history_instructions (re-anchoring)

[Associative — Triggered by Keywords]
  lorebook entries:
    trigger_keys: ["castle", "sword"]
    content: "The castle of Ashenveil is..."
  → scanned against each new message
  → matching entries injected into context
```

### Pattern 4: Semantic + Episodic + Procedural Split (LangChain)

```
Procedural (LLM weights + system prompt — never changes mid-session)
  core behavioral rules
  ethical constraints
  tool usage patterns

Semantic (external DB — searchable)
  user preferences learned over time
  domain knowledge
  relationship facts

Episodic (few-shot store — retrieved by similarity)
  past successful interaction patterns
  "when user asks X, respond like Y"
```

---

## Gaps Identified

- No single paper quantifies the ROI of structured identity vs. no identity on **task completion rate** (only consistency scores). The PCL +3.7% result is on a subjective consistency scale, not on objective task performance.
- The Generative Agents importance threshold of 150 is not derived analytically — it is a hyperparameter tuned empirically.
- No research found specifically on **agent identity drift** in long-running agentic (tool-calling) systems vs. conversational systems. Most consistency research focuses on roleplay, not autonomous agents.
- The SoulSpec 0.4 standard is community-driven with no backing institution. Adoption metrics unavailable.
- Character Card V2 lorebook spec does not define retrieval semantics (substring match vs. embedding) — left to implementation.

## Key Takeaways

1. **Identity = static anchor.** All major systems inject identity at the top of every context. No system relies on identity being reconstructed from memory alone. Identity is always pre-loaded.

2. **Memory = three tiers.** In-context (always available), near-context (recently accessed, summarized), and out-of-context (retrieved on demand). The in-context tier is where identity lives.

3. **Retrieval scoring = recency × importance × relevance.** The Generative Agents formula (equal weight on these three) is the most-cited and most-referenced retrieval design in the field.

4. **Reflection unlocks higher-order identity.** Raw observations alone do not produce coherent agent personality — the reflection synthesis step is what creates stable beliefs about self and world.

5. **Structured schema beats prose for consistency.** The 14-field CharacterEval schema + Chain of Persona approach produces measurably higher consistency than unstructured prompts, even against GPT-4.

6. **Dual injection points solve context drift.** The `post_history_instructions` pattern (community-discovered in Character Card V2) is a practical solution — re-inject identity anchors after the conversation history, not just before it.

7. **Agent-controlled memory is more flexible.** MemGPT's approach of letting the agent call tools to manage its own memory (rather than a fixed external system) produces more contextually appropriate persistence decisions.

## Sources

- Park et al. 2023 — https://arxiv.org/abs/2304.03442
- Park et al. 2023 (full HTML) — https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763
- Park et al. 2023 paper review — https://gonzoml.substack.com/p/generative-agents-interactive-simulacra
- Packer et al. 2023 (MemGPT) — https://arxiv.org/abs/2310.08560
- MemGPT detailed walkthrough — https://www.leoniemonigatti.com/papers/memgpt.html
- Letta agent memory blog — https://www.letta.com/blog/agent-memory
- Li et al. 2023 (CAMEL) — https://arxiv.org/abs/2303.17760
- PCL Persona Consistency (2025) — https://arxiv.org/abs/2503.17662
- CharacterEval benchmark — via PCL paper
- PersonaGym — https://aclanthology.org/2025.findings-emnlp.368.pdf
- Character Card Spec V2 — https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md
- SoulSpec — https://soulspec.org
- SOUL.md guide — https://www.crewclaw.com/blog/soul-md-create-ai-agent
- Anthropic Claude best practices — https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
- Anthropic keep-in-character guide — https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/keep-claude-in-character
- Azure AI persona documentation — https://learn.microsoft.com/en-us/azure/well-architected/ai/personas
- LangChain memory for agents — https://blog.langchain.com/memory-for-agents/
- LangGraph architecture — https://dev.to/sreeni5018/the-architecture-of-agent-memory-how-langgraph-really-works-59ne
