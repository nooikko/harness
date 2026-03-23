# Research: Multi-Agent Orchestration Patterns
Date: 2026-03-22

## Summary

A cross-framework analysis of how modern AI agent orchestration systems implement autonomous multi-agent loops. Covers CrewAI, AG2 (AutoGen), LangGraph, Claude Agent SDK / Anthropic patterns, OpenAI Swarm / Agents SDK, and coding-specific agents (SWE-agent, Devin). Focus is on orchestration patterns — state maintenance, sub-agent result reporting, done/re-delegate/escalate logic, concurrency, task dependencies, failure/retry models, and message queue / event-driven patterns.

## Prior Research

- `2026-03-17-multi-agent-coding-team-design.md` — earlier internal design thinking
- `2026-03-01-industry-gap-analysis-agent-orchestration.md` — high-level gap analysis

---

## Current Findings by Framework

---

### 1. CrewAI

**Confidence: HIGH** — official docs and multiple corroborating sources.

**Model:** Two distinct execution modes, both built on top of the same agent/task primitives.

#### Crews (Autonomous Collaboration Mode)
- Agents are assigned roles (role, goal, backstory) and tasks
- Two process models: **Sequential** (task chain, each output feeds the next) and **Hierarchical** (a manager agent dynamically assigns tasks to agents based on capability)
- In hierarchical mode, the manager LLM itself decides delegation — it is not hardcoded

#### Flows (Event-Driven Orchestration Mode, 2025+)
Flows are the production/enterprise architecture. State and routing are explicit.

**State Maintenance:**
- State is a first-class object — either unstructured (`dict`) or structured (Pydantic `BaseModel`)
- State persists across all methods within a flow execution
- `@persist` decorator saves state to SQLite — enables recovery after crash/restart
- Every flow run gets a UUID for tracking

**Routing / Control:**
- `@start()` — entry points, can run in parallel
- `@listen(method_name)` — fires when a specified method completes; receives output as argument
- `@router()` — method returns a string label, which routes to matching `@listen` handlers
- `or_(m1, m2)` / `and_(m1, m2)` — wait for any or all of multiple predecessors
- No explicit queue — execution follows the event graph defined by decorators

**How Sub-Agents Report Results:**
- Task outputs are automatically relayed to the next task in chain
- Explicit `context=[previous_task]` attr can reference any prior task's output
- Callbacks via `callback` param execute after task completion
- Async tasks (`async_execution=True`) run without blocking; dependents wait via context mechanism

**Done vs Re-Delegate:**
- **Done:** Router returns a terminal string label; no listener handles it; or `TerminateTarget` equivalent
- **Re-delegate (Hierarchical):** Manager LLM decides whether output meets criteria; can re-assign
- **Human gate:** `@human_feedback` decorator pauses flow pending input; LLM can interpret feedback into router outcomes

**Failure / Retry:**
- **Guardrails** are the retry mechanism: validation (function-based or LLM-based) on task output
- On guardrail failure: error message is sent back to the agent, task is retried up to `guardrail_max_retries` (default: 3)
- Multiple guardrails chain sequentially
- No retry decorator for network/tool failures — resilience relies on state persistence + manual re-execution from checkpoint

**Concurrency:**
- Multiple `@start()` methods execute in parallel at flow start
- Independent `@listen` branches with no shared dependencies execute concurrently
- `async_execution=True` on tasks in Crews enables parallel task execution

**Task Dependencies:**
- Explicit: `context=[task_a, task_b]` — task B won't run until A completes
- Implicit: sequential task chain — each step receives the prior output

---

### 2. AG2 (AutoGen / Microsoft Agent Framework)

**Confidence: HIGH** — official AG2 docs, Microsoft Learn, v0.9 release notes.

**Evolution:** AutoGen → AG2 (open-source, ag2ai org) + Microsoft Agent Framework (converges AG2 + Semantic Kernel for enterprise). The open-source AG2 is where the orchestration patterns live.

#### Core Coordination Model: GroupChat

AG2 v0.9 unified the "Group Chat" and "Swarm" patterns into a single system.

**Two key components:**
- `GroupChat` — holds the list of agents and the rules for turn-taking
- `GroupChatManager` — runs the meeting (the orchestrator)

**State Maintenance:**
- State flows through **conversation message history** — every agent sees the accumulated messages
- `ContextVariables` class provides structured shared state accessible to all agents — new in v0.9
- No built-in external state persistence in core AG2 (Microsoft Agent Framework adds session-backed storage with SQLAlchemy/Redis)

**Speaker Selection Patterns (5 in v0.9):**
1. **AutoPattern** — LLM analyzes conversation and selects the most suitable next speaker
2. **DefaultPattern** — Explicit agent-defined handoffs; terminates if no handoff configured
3. **RoundRobinPattern** — Fixed sequential rotation
4. **RandomPattern** — Non-deterministic selection
5. **ManualPattern** — Human selects next speaker (for debugging)

**Handoff Mechanism:**
- Agents return `OnCondition` objects with `StringLLMCondition` prompts or `ContextExpression` (e.g., `"${priority} == 'high'"`)
- Handoff targets: specific agent, `RevertToUserTarget`, `TerminateTarget`, nested chat, new group chat
- `after_work` defines default transition when an agent completes without an explicit handoff

**How Sub-Agents Report Results:**
- Results are appended to shared message history — all agents see everything
- No filtered/summarized result passing — full history is the shared state
- This is the primary scaling problem: every agent LLM call includes the full accumulated history, making AG2 expensive for high-volume workflows

**Done vs Re-Delegate vs Escalate:**
- **Done:** Any agent transitions to `TerminateTarget()` — ends immediately
- **Re-delegate:** LLM-based `OnCondition` fires, routing back to a prior agent or a retry agent
- **Escalate:** `RevertToUserTarget()` returns control to human
- **Max turns:** `max_round` on GroupChat; `max_turns` on two-agent `initiate_chat`; `max_consecutive_auto_reply` per agent

**Termination Conditions (7 mechanisms):**
1. `max_round` / `max_turns` hit
2. `is_termination_msg` callable returns `True` on a received message
3. `max_consecutive_auto_reply` exceeded
4. Human types 'exit'
5. Custom speaker selection returns `None`
6. Transition to `TerminateTarget`
7. Custom reply function returns `(True, None)`

**Failure Handling:**
- No built-in retry mechanism at the framework level
- Agents can route back to themselves or a retry agent via handoffs
- `RevertToUserTarget()` is the escalation path when automated recovery isn't possible

**Concurrency:**
- AG2 is primarily sequential — one agent speaks at a time in GroupChat
- Parallel execution requires external orchestration (e.g., running multiple group chats simultaneously)
- Microsoft Agent Framework adds graph-based workflows that enable parallel node execution

**Nested Chats:**
- An agent can initiate a sub-conversation (nested chat) as a tool call
- The nested chat runs to completion and returns a result to the parent conversation
- This is the primary pattern for sub-agent delegation in AG2

---

### 3. LangGraph

**Confidence: HIGH** — official LangChain docs, multiple technical deep-dives, AWS blog.

**Model:** Directed graph where nodes are agents/functions and edges are transitions. Built on state machines + graph theory. The central abstraction is `StateGraph`.

**State Maintenance:**
- **Centralized state object** passed through the graph — nodes receive current state and return updated state
- State uses **immutable update** semantics — nodes produce new state versions, not mutations (prevents race conditions)
- State schema defined with Python `TypedDict` and `Annotated` types with **reducer functions** that determine how updates from parallel branches are merged
- **Checkpointing** is built-in: every state transition is persisted; supports time-travel (roll back to any prior checkpoint and replay)
- Human-in-the-loop: execution pauses at annotated nodes for operator review

**Graph Compilation:**
- Before execution, the graph is compiled: validates node connections, detects cycles, optimizes paths
- This is a design-time validation step that catches structural errors early

**Conditional Edges:**
- Edges carry predicates on the global state
- Execution routes to different successor nodes based on dynamic evaluation (confidence scores, validation outcomes, failure flags)
- Enables: `if validation_passed → done`, `if validation_failed → retry_node`, `if max_retries_hit → escalate`

**Orchestrator-Worker Pattern with Send API:**
- The `Send API` is the key concurrency primitive
- The orchestrator node dynamically creates worker nodes at runtime and sends each one specific inputs
- Each worker has its own state; all worker outputs are written to a shared state key via reducer (map-reduce)
- The gather phase: reducers accumulate all worker outputs into a list in the parent state; the orchestrator node runs after all workers complete
- Subgraphs share state keys with parent graph — communication is automatic through shared channels

**Done vs Re-Delegate vs Escalate:**
- **Done:** Conditional edge routes to `END` node
- **Re-delegate:** Conditional edge routes back to an earlier node or a worker-spawning node with modified state
- **Escalate:** Conditional edge routes to a human-in-the-loop interrupt node; execution pauses and waits for operator input
- The decision is always a predicate on the current state object — explicit and inspectable

**Failure / Retry:**
- Per-node timeouts
- Automated retries via retry edges (route failed node output back to itself or a retry wrapper node)
- `interrupt()` call inside a node pauses execution and requests human intervention
- Checkpoint + replay: on failure, roll back to last checkpoint and re-execute from that point

**Concurrency:**
- `Send API` is the only built-in parallelism primitive — dynamically creates parallel workers at runtime
- "Pipeline parallelism" — different stages of a sequential process can execute in parallel if they're on independent branches
- All concurrent branches write to the same centralized state; reducers handle merge conflicts deterministically

**Task Dependencies:**
- Encoded in graph structure — an edge from A to B means B cannot execute until A completes and emits an output
- Conditional branching enables: "only run B if A produced a result meeting criteria X"
- Subgraphs enforce module boundaries — a subgraph completes before the parent graph continues

---

### 4. Anthropic / Claude Agent SDK

**Confidence: HIGH** — official Anthropic engineering blog, official "Building Effective Agents" post.

**The 6 Composable Patterns** (from official Anthropic guidance):

1. **Prompt Chaining** — sequential LLM calls with programmatic gates between steps
2. **Routing** — classify input, route to specialized handler
3. **Parallelization** — run multiple LLM calls simultaneously (sectioning: independent subtasks; voting: multiple independent attempts)
4. **Orchestrator-Workers** — central LLM dynamically breaks task into subtasks, delegates to workers, synthesizes results
5. **Evaluator-Optimizer** — one LLM generates, another evaluates in a loop
6. **Autonomous Agents** — LLM dynamically directs its own process and tool use

Anthropic explicitly recommends starting with the simplest pattern that works and only adding complexity when justified.

**Orchestrator-Worker Architecture (Claude Agent SDK specifics):**
- Orchestrator: responsible for understanding the overall task, decomposing it into subtasks, delegating to specialized subagents, synthesizing results
- Each subagent gets an **isolated context window** — only receives the information needed for its subtask
- Subagents return only **relevant results** back to orchestrator, not their full context
- This is the key architectural difference from AG2: filtered result passing vs. full history sharing

**State Maintenance:**
- Orchestrator maintains the plan and global state in its own context window
- For plans that risk exceeding context limits (200k token threshold), the lead agent **saves plan to external memory** (tool call to persist state) before context would be truncated
- File system and git history act as persistent state for coding tasks
- Claude Agent SDK sessions maintain conversation state within a session, but cross-session state requires external persistence

**Done vs Re-Delegate vs Escalate:**
- **Done:** Orchestrator synthesizes results and determines objectives are met (LLM judgment)
- **Re-delegate:** "LeadResearcher synthesizes these results and decides whether more research is needed — if so, it can create additional subagents or refine its strategy"
- **Escalate:** `AskUserQuestion` tool — agent explicitly asks the human; built into the SDK's tool catalog
- **Hard stops:** Maximum iteration limits explicitly recommended as a safeguard against infinite loops

**Verification Patterns:**
- Rule-based feedback: defined validation criteria checked programmatically
- Visual feedback: rendered output assessment (for UI tasks)
- **LLM-as-judge:** separate model evaluates fuzzy criteria (tone, quality, completeness) — feedback reinjected into orchestrator

**Failure / Retry:**
- "Combine the adaptability of AI agents with deterministic safeguards like retry logic and regular checkpoints"
- On tool failure: result is returned as error text; orchestrator can route to retry or alternative approach
- Checkpoint-based recovery: resume from where errors occurred rather than restart
- Explicit guidance: "compounding errors" are the primary risk; test in sandboxed environments; include max iteration limits

**Concurrency:**
- Spin up 3-5 subagents in parallel rather than serially (explicitly recommended in multi-agent research system post)
- Subagents use 3+ tools in parallel within their own execution
- "Cut research time by up to 90% for complex queries" — parallelization is the primary performance lever
- Claude Code Agent Teams (February 2026): primary agent decomposes, spawns parallel specialists (researcher, implementer, tester, reviewer), each in isolated context window; orchestrator merges results and handles conflicts

**Task Dependencies:**
- Not enforced by the SDK itself — the orchestrator LLM reasons about dependencies
- Orchestrator decides which subagents can run in parallel vs which must be sequential based on its understanding of the task
- This is flexible but not formally verified — dependency errors are a known failure mode

**Token Cost Warning:**
- Agents use 4x more tokens than chat; multi-agent systems use ~15x more tokens than chat
- Every subagent invocation is an independent API call with its own context window cost

---

### 5. OpenAI Swarm / Agents SDK

**Confidence: HIGH** — official OpenAI Swarm repo, official OpenAI Agents SDK docs, orchestrating_agents cookbook.

**Two Systems:**
- **Swarm** (2024, now educational/reference only): stateless, Chat Completions API, minimal abstraction
- **OpenAI Agents SDK** (2025, production): sessions, tracing, guardrails, the supported path

#### Swarm Architecture (Reference Pattern)

Swarm's two primitives are **Agents** and **Handoffs**.

- An Agent = system prompt + tools + optional `agent_name` label
- A Handoff = a tool that returns another Agent object
- When the model calls a transfer function and it returns an Agent, the runner switches `active_agent` and continues the loop with that agent's tools and instructions
- The full message history persists across handoffs — context is never dropped

**Execution Loop:**
```
1. Get completion with current agent's tools
2. If no tool calls → done (agent produced final response)
3. Execute tool calls
4. If a tool returns an Agent → switch active_agent
5. Append results to message history
6. Loop
```
"Done" is implicit: when the model produces only text with no tool calls, the turn ends.

**Routines:**
- A routine is a system prompt with natural language steps + required tools
- The model navigates branches via "soft adherence" — natural reasoning, not rigid state machine
- This is intentional: conversational flow handles conditional logic more naturally than explicit branching

**State Flow:**
- The complete `messages` array (all prior inputs, responses, tool calls, results) is passed to each new agent on handoff
- `Response` class tracks the current active agent: `Response(agent=current_agent, messages=new_messages)`
- No external state; message history is the entire state

#### OpenAI Agents SDK (Production)

Built on Swarm's patterns but adds:
- **Sessions** — persistent state backed by SQLAlchemy, Redis, or encrypted variants
- **Tracing** — built-in visualization and debugging of agentic flows; can evaluate and fine-tune
- **Guardrails** — run input validation and safety checks in parallel with agent execution
- **Handoffs + Agents as Tools** — two coordination models:
  1. Agent-to-agent handoff (transfer control)
  2. Agent as tool (call sub-agent, get result back, continue in same context)

**Done vs Re-Delegate vs Escalate:**
- **Done:** Agent produces no tool calls — the loop exits
- **Re-delegate:** Agent calls a handoff to another agent or back to itself with new instructions
- **Escalate:** No explicit human escalation primitive in the SDK; requires tool-based implementation
- **Safety valve:** `max_turns` cap is critical — without it, loops can be infinite

**Failure / Retry:**
- Tool failures return error strings to the model — it decides whether to retry, try an alternative, or give up
- No built-in retry framework; requires tool wrappers with retry logic
- The "action agent" safety pattern: put destructive write tools behind a narrow agent with `execute_tools=False` approval gate + tool allowlists

**Concurrency:**
- Core Swarm/Agents SDK is sequential (one agent active at a time)
- Guardrails run in parallel with agent execution (a single parallelism point)
- True parallel sub-agent execution requires external orchestration

**Task Dependencies:**
- Encoded in handoff logic — agent A doesn't hand off to agent B until A is satisfied with its output
- No formal dependency graph; sequential handoffs are the dependency enforcement mechanism

---

### 6. Coding-Specific Agents: SWE-agent / Devin / Aider

**Confidence: MEDIUM** — SWE-agent academic paper and GitHub, Devin blog (business-focused, limited architecture detail), community analysis. Devin's internal architecture is not publicly documented.

#### SWE-agent (Princeton/Stanford, academic)

**Core Loop (ReAct pattern):**
```
Thought → Action → Observation → (repeat)
```
1. Agent writes a thought about the current task state
2. Agent takes an action (tool call, edit, command)
3. Observation is the tool/environment result
4. Agent updates its reasoning and loops

**Context Management (the key innovation):**
- SWE-agent truncates observation history: the last 5 observations are shown in full; older observations are collapsed to a single line
- This maintains essential plan and action history while preventing context overflow
- "History processors" keep context concise and informative
- Informative error messages are critical — the agent must understand why an action failed to replan

**State Maintenance:**
- The file system IS the state — every edit, every file change is the persistent record
- The agent re-reads files at each step to get ground truth
- No external state store; git history is the implicit checkpoint mechanism

**Re-planning:**
- When N consecutive step failures occur, implicit re-planning happens (the agent's next "Thought" must account for the failures)
- No explicit re-planning node; the ReAct loop naturally incorporates failure into the next thought

**Failure Handling:**
- Errors are observations — they flow back into the loop as text
- Agent must decide: retry same action, try alternative approach, ask for clarification, or give up
- Mini-SWE-agent (2025): emphasizes "token- and cost-efficient edit operators" (diff-patch vs full-file rewrite) to minimize token waste on retries

#### Devin (Cognition, production product)

Architecture details are proprietary. Public information from the 2025 annual review:
- Maintains context across long-running tasks (multi-file refactoring recalls relevant context at every step)
- "Learns from interactions over time" — implies some form of persistent memory or retrieval
- Requires "clear, upfront requirements" — struggles with mid-task requirement changes (suggests plan-then-execute, not continuous replanning)
- Async collaboration pattern: engineers chat with Devin, "@" it in Slack/Teams
- Human review is still required for code quality verification

#### Aider (coding assistant, open-source)

Aider focuses on the human-in-the-loop pattern rather than full autonomy:
- Architect mode (2024+): one model plans the edit, another executes it
- The human provides the goal; Aider breaks it into file edits with diff output
- Context is managed by only including relevant files in the prompt (explicit file selection vs. full codebase)
- No autonomous loop by default — human approves each diff

---

## Cross-Framework Pattern Analysis

### The Fundamental Loop (all frameworks converge on this)

```
[Plan] → [Delegate] → [Execute] → [Verify] → [Done? → Exit] [Failed? → Retry/Replan/Escalate]
         ↑_______________________________|
```

Every framework implements this loop differently but none escapes it. The variation is in how each step is implemented.

### State Maintenance Strategies Compared

| Framework | State Model | Persistence |
|---|---|---|
| CrewAI Flows | Explicit Pydantic object, passed through event graph | SQLite via `@persist` |
| AG2 | Message history + `ContextVariables` | None (external frameworks add this) |
| LangGraph | Centralized `StateGraph` object with reducers | Built-in checkpointing |
| Claude Agent SDK | Orchestrator context window + external memory tool | Explicit tool call to save plan |
| OpenAI Swarm | Message history array | Sessions via SQLAlchemy/Redis (Agents SDK) |
| SWE-agent | File system + truncated observation history | File system / git |

### Sub-Agent Result Reporting Patterns

**Full history sharing (expensive but complete):**
- AG2: every agent sees the entire conversation
- OpenAI Swarm: complete message array passed on every handoff

**Filtered result passing (efficient but lossy):**
- Claude Agent SDK: subagents return only relevant results, not full context
- LangGraph workers: write to a specific shared state key via reducer, not full state
- CrewAI: task output is passed as `context`; prior history is not re-injected

**File system as communication channel:**
- SWE-agent / Devin: agents read/write files; state is inspectable at any time

### Done vs Re-Delegate vs Escalate Comparison

| Framework | Done Detection | Re-Delegate Trigger | Escalate Path |
|---|---|---|---|
| CrewAI | Terminal router label or no listener | Manager LLM judgment; guardrail failure → retry | `@human_feedback` decorator |
| AG2 | `TerminateTarget` or `is_termination_msg` | `OnCondition` handoff back to prior agent | `RevertToUserTarget()` |
| LangGraph | Route to `END` node | Conditional edge back to earlier node | `interrupt()` → human review |
| Claude SDK | Orchestrator LLM judges completion | Orchestrator creates more subagents | `AskUserQuestion` tool |
| OpenAI Swarm | No tool calls in response | Handoff to retry agent | External tool-based implementation |
| SWE-agent | Task criteria met (LLM judgment) | Next ReAct iteration with failure context | Not automated; human review |

### Concurrency Model Comparison

| Framework | Concurrency Primitive | Granularity |
|---|---|---|
| CrewAI Flows | Parallel `@start()` + independent `@listen` branches | Flow method level |
| AG2 | Sequential by default; nested chats for sub-delegation | No built-in parallelism |
| LangGraph | `Send API` (dynamic map-reduce) | Node level; arbitrary parallelism |
| Claude SDK | Multiple subagents spawned in parallel | Subagent level |
| OpenAI Agents SDK | Sequential; guardrails run in parallel | Single parallelism point |
| SWE-agent | Sequential (single ReAct loop) | None |

### Failure/Retry Model Comparison

| Framework | Retry Mechanism | Max Retries | Error Visibility |
|---|---|---|---|
| CrewAI | Guardrails with `guardrail_max_retries` (default 3) | Configurable per guardrail | Error sent to agent as feedback |
| AG2 | Agent-defined handoffs back to retry agents | `max_consecutive_auto_reply` | Full message history |
| LangGraph | Retry edges; per-node timeouts; checkpoint rollback | Configurable | State object + node logs |
| Claude SDK | Iterative loop with LLM-as-judge; max iteration limit | Explicitly recommended | Error text in orchestrator context |
| OpenAI Agents SDK | Tool returns error string; model decides | `max_turns` cap | Message history |
| SWE-agent | ReAct loop naturally incorporates errors | No hard limit | Truncated observation history |

---

## Production Failure Modes (Cross-Framework Research)

From the March 2025 Multi-Agent System Failure Taxonomy (MASFT) paper and production analysis:

### The 14 MASFT Failure Categories

**FC1: Specification and System Design (5 modes)**
1. **Disobey Task Specification** — agent ignores constraints → prevention: constraint validation checkpoints
2. **Disobey Role Specification** — agent oversteps role boundaries → prevention: restrict action space per role
3. **Step Repetition** — lost execution state tracking causes redundant cycles → prevention: deduplication checks with persistent history
4. **Loss of Conversation History** — context truncation loses progress → prevention: MemGPT-style structured memory management
5. **Unaware of Termination Conditions** — agents continue past completion → prevention: declarative termination rules; verifier-only exit authority

**FC2: Inter-Agent Misalignment (6 modes)**
6. **Conversation Reset** — dialogue restarts lose accumulated context → prevention: immutable execution logs + checkpoint recovery
7. **Fail to Ask for Clarification** — agents proceed with ambiguous input → prevention: mandatory clarification protocols below confidence threshold
8. **Task Derailment** — gradual objective drift through uncorrected miscommunications → prevention: goal re-affirmation every N turns
9. **Information Withholding** — agents fail to communicate critical knowledge → prevention: "broadcast uncertainty" requirements
10. **Ignored Other Agent's Input** — peers' constraints not processed → prevention: explicit acknowledgment patterns
11. **Reasoning-Action Mismatch** — stated reasoning contradicts execution → prevention: action validation layer

**FC3: Task Verification and Termination (3 modes)**
12. **Premature Termination** — exits before objectives are met → prevention: multi-checkpoint verification before terminal states
13. **No or Incomplete Verification** — errors propagate undetected → prevention: domain-specific verification engines
14. **Incorrect Verification** — verifier misses errors → prevention: multi-layer verification + cross-verification between independent evaluators

### The "Bag of Agents" Anti-Pattern (17x Error Trap)

When agents are added without organized coordination topology, errors compound multiplicatively rather than being isolated. The solution is explicit topology: organize agents into "functional planes" with deliberate dependency structure.

Key insight: **"40% of multi-agent pilots fail within six months of production deployment. Most 'agent failures' are orchestration and context-transfer issues at handoff points, not model capability failures."**

### GitHub's Production Lessons

From engineering practice at scale:

1. **Typed schemas for data exchange** — natural language handoffs are unreliable; typed schemas make violations detectable before corruption propagates
2. **Action schemas for intent clarity** — enumerate exact possible outcomes at decision points; constrain ambiguity
3. **MCP for contract enforcement** — validates inputs/outputs before execution; transforms conventions into enforced contracts
4. **Design for failure first** — assume partial failures, validate at every agent boundary, log intermediate state
5. **Constrain actions before adding agents** — adding more agents to an unstructured system amplifies chaos

---

## Key Architectural Insights for Harness

### What Harness Already Has
- Orchestrator-worker delegation via `delegate` + `checkin` MCP tools (delegation plugin)
- Validator plugin implements LLM-as-judge (Evaluator-Optimizer pattern)
- `max_iterations` safety valve in the delegation loop
- Fire-and-forget background execution via `ctx.sendToThread`
- External state persistence (full database) — superior to any in-framework approach

### What the Research Reveals as Critical Gaps

1. **No formal done/re-delegate/escalate decision protocol** — the delegation plugin retries on validator failure (fail → retry) but does not have a structured "has sufficient progress been made?" check that could trigger replanning vs continued retrying

2. **No plan persistence mechanism** — for long-running delegations, the orchestrator's plan exists only in its context window. If the context grows long (multi-step task with many tool calls), the plan can be implicitly truncated. The Anthropic multi-agent research paper explicitly addresses this with an external memory save step.

3. **No parallel sub-agent coordination** — the current delegation loop is sequential (one sub-agent at a time). LangGraph's Send API pattern and Anthropic's 3-5 parallel subagents are the industry standard for time-sensitive multi-step tasks.

4. **No typed result schema** — sub-agent results are plain text strings. GitHub's research shows typed schemas at handoff points are the #1 reliability improvement. The validator uses a rubric but doesn't enforce a structured output schema.

5. **No task dependency enforcement** — dependencies between delegation tasks are not formally modeled. If task B requires task A's output, the current system relies on the orchestrator LLM to order them correctly.

6. **Context bloat at scale** — passing full conversation history to sub-agents (via context plugin) vs. filtered result passing is a known scaling problem. Sub-agents currently get full context from the `onBeforeInvoke` chain.

### Recommended Patterns from Industry

**For making delegation loops reliable without "going flat":**
1. Explicit termination criteria in the delegation prompt (not just max_iterations)
2. Goal re-affirmation every N turns (FM-2.3 Task Derailment prevention)
3. Typed result schema for sub-agent outputs (validator enforces structure, not just quality)
4. External plan persistence checkpoint when context approaches limit
5. LLM-as-judge verifier that is SEPARATE from the executing agent (already have this via validator)
6. Circuit breaker with categorized failure modes (already have 4-category classification)

---

## Sources

- [CrewAI Flows Documentation](https://docs.crewai.com/en/concepts/flows)
- [CrewAI Tasks Documentation](https://docs.crewai.com/en/concepts/tasks)
- [AG2 Orchestration Patterns](https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/orchestration/group-chat/patterns/)
- [AG2 Ending a Chat](https://docs.ag2.ai/latest/docs/user-guide/advanced-concepts/orchestration/ending-a-chat/)
- [AG2 v0.9 Release Announcement](https://docs.ag2.ai/latest/docs/blog/2025/04/28/0.9-Release-Announcement/)
- [Microsoft Agent Framework Overview](https://learn.microsoft.com/en-us/agent-framework/overview/)
- [LangGraph Multi-Agent Orchestration Guide 2025](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/langgraph-multi-agent-orchestration-complete-framework-guide-architecture-analysis-2025)
- [LangGraph Official Site](https://www.langchain.com/langgraph)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Anthropic: Building a Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Anthropic: Building Agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- [OpenAI: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents)
- [OpenAI Swarm GitHub](https://github.com/openai/swarm)
- [SWE-agent GitHub](https://github.com/SWE-agent/SWE-agent)
- [SWE-agent NeurIPS 2024 Paper](https://proceedings.neurips.cc/paper_files/paper/2024/file/5a7c947568c1b1328ccc5230172e1e7c-Paper-Conference.pdf)
- [Devin 2025 Annual Performance Review](https://cognition.ai/blog/devin-annual-performance-review-2025)
- [Multi-Agent System Failure Taxonomy (MASFT) — arXiv March 2025](https://arxiv.org/html/2503.13657v1)
- [GitHub Blog: Multi-agent workflows often fail](https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/)
- [Why Your Multi-Agent System is Failing — Towards Data Science](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/)
- [The Multi-Agent Reality Check: 7 Failure Modes](https://www.techaheadcorp.com/blog/ways-multi-agent-ai-fails-in-production/)
