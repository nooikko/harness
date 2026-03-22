# Research Plan: Agent Isolation — Current State & Balance

## Objective

Understand how Harness currently isolates agents from data/context not meant for them, identify the boundaries of that isolation, and map the spectrum from "fully open" to "fully locked down" so we can make informed decisions about where to draw the line.

**Non-goal:** Complete sandboxing. Agents will work on code on the deployment server. The question is *what data leaks between agents/threads/projects* and *what should*.

---

## Research Questions

### Q1: Data Boundary Enforcement
> When Agent A is chatting in Thread X (Project Alpha), what prevents it from seeing Agent B's memories, Thread Y's history, or Project Beta's instructions?

**Current answer (from audit):**
- **Memory**: Dual-key filtering — `retrieve-memories.ts` builds OR clause: always AGENT-scoped (personality), plus PROJECT/THREAD only when matching IDs. **No cross-agent memory leakage.**
- **History**: `context/index.ts` loads messages by exact `threadId`. **No cross-thread history.**
- **Project data**: Instructions and memory injected only when `thread.projectId` matches. **No cross-project leakage.**
- **File references**: Scoped by threadId (THREAD) or projectId (PROJECT). **No cross-project file leakage.**

**Research needed:**
- [ ] Verify no DB query in any plugin joins across agent boundaries without filtering
- [ ] Check if the `context/` directory files (global filesystem) contain agent-specific data that bleeds
- [ ] Map exactly what ends up in a prompt for a typical invocation — full prompt reconstruction

### Q2: Claude Session & Process Isolation
> Does each agent/thread get its own Claude subprocess? Can session state leak?

**Current answer:**
- Session pool keyed by `threadId` (max 5, 8-min TTL, LRU eviction)
- Each thread gets its own subprocess — sessions cannot cross threads
- On error, session is evicted and rebuilt

**Research needed:**
- [ ] Understand what Claude SDK sessions retain between `send()` calls within the same thread
- [ ] Determine if MCP tools from one thread's session could theoretically access another thread's state
- [ ] Check if the tool server exposes all plugin tools to all sessions or scopes them

### Q3: MCP Tool Access Control
> Can Agent A call tools that should only be available to Agent B? Can a tool handler access data outside its thread?

**Current answer:**
- Tools are registered globally from all plugins — every session sees every tool
- Each tool handler receives `meta.threadId` and must self-scope
- No global enforcement layer validates tool scope

**Research needed:**
- [ ] Audit each tool handler for correct threadId scoping
- [ ] Determine if per-agent or per-project tool filtering is feasible/desirable
- [ ] Check delegation tools — can a sub-agent call `delegate` recursively without bounds?

### Q4: Context Files (The Global Layer)
> The `context/` directory is shared across all threads. What's in it? Is this a feature or a leak?

**Current answer:**
- `context/memory.md`, `context/inbox.md` etc. are loaded for every invocation
- Intentionally global — enables cross-thread awareness (memory consolidation, reminders)
- No per-agent or per-project filtering

**Research needed:**
- [ ] Inventory all context files and their typical contents
- [ ] Determine which are agent-written vs. human-maintained
- [ ] Assess whether agent-written context files create unintended information sharing
- [ ] Evaluate if project-scoped context directories would help

### Q5: Plugin Trust Model
> Plugins have full DB access. Is this appropriate?

**Current answer:**
- `createScopedDb` only sandboxes `PluginConfig` access (prevents cross-plugin config reads)
- All other tables are fully accessible to all plugins
- Plugins are trusted code (first-party), not third-party extensions

**Research needed:**
- [ ] Document which plugins actually query which tables
- [ ] Identify if any plugin reads data outside its logical scope (even if harmlessly)
- [ ] Assess whether the trust model changes if/when third-party plugins are supported

### Q6: Delegation Isolation
> When an agent delegates a task, how isolated is the sub-agent?

**Current answer:**
- Task threads are separate records with `kind: 'task'`
- Sub-agent has no visibility into parent thread (separate session, separate history)
- Parent notification via structured message only
- Sub-agent inherits parent's `projectId` (for memory scoping)

**Research needed:**
- [ ] Check if the sub-agent inherits the parent agent's identity/soul or runs bare
- [ ] Verify delegation circuit breaker prevents unbounded recursive delegation
- [ ] Determine what happens to task thread memories — can parent agent later see them?

### Q7: The Code Access Question
> Agents will run on the deployment server and can execute code. What's the boundary?

**Research needed:**
- [ ] Map how Claude SDK sessions interact with the filesystem (working directory, tool permissions)
- [ ] Determine if one agent's code execution could read/write files another agent created
- [ ] Understand the Claude Code CLI's built-in sandboxing (if any)
- [ ] Assess risks: agent reads `.env`, agent reads other project's source, agent modifies shared config

---

## Research Methodology

### Phase 1: Prompt Reconstruction (1-2 hours)
Trace a complete invocation end-to-end and capture the exact prompt Claude receives. Document every section, its source, and its scope boundary.

**Key files to read:**
- `apps/orchestrator/src/orchestrator/index.ts` — handleMessage pipeline
- `apps/orchestrator/src/orchestrator/_helpers/prompt-assembler.ts` — base prompt
- `packages/plugins/identity/src/_helpers/format-identity-header.ts` — soul injection
- `packages/plugins/identity/src/_helpers/format-identity-anchor.ts` — anchor injection
- `packages/plugins/context/src/index.ts` — history + context injection
- `packages/plugins/time/src/index.ts` — time injection

**Deliverable:** A complete annotated prompt showing `[SOURCE: agent-scoped]`, `[SOURCE: thread-scoped]`, `[SOURCE: project-scoped]`, `[SOURCE: global]` for every section.

### Phase 2: Tool Audit (1-2 hours)
Audit every MCP tool handler for correct scope enforcement.

**Key files to read:**
- `apps/orchestrator/src/tool-server/index.ts` — tool registration
- Each plugin's tool handlers (delegation, cron, project, identity, time)

**Deliverable:** Table of tools × scope enforcement × gap assessment.

### Phase 3: Context File Analysis (30 min)
Inventory the `context/` directory, categorize contents, and assess cross-agent risk.

### Phase 4: Session & Process Model (1 hour)
Understand Claude SDK session lifecycle, what persists between calls, and filesystem access.

**Key files to read:**
- `apps/orchestrator/src/invoker-sdk/index.ts` — session pool
- `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts` — session creation
- Claude Agent SDK documentation (via context7)

### Phase 5: Synthesis & Recommendations (1 hour)
Map findings onto a spectrum:

```
FULLY OPEN ←————————————————————→ FULLY ISOLATED
     ↑                                    ↑
  current:                          not desired:
  context files                     agents can't
  are global                        touch code
         ↑
       sweet spot?
```

**Deliverable:** A findings document with:
1. Current isolation matrix (what's scoped, what's global, what's missing)
2. Risk assessment (what could go wrong at current boundaries)
3. Recommendations ranked by effort/impact
4. Decision framework for "should X be agent-scoped or global?"

---

## Scope Boundaries for This Research

**In scope:**
- Data isolation (memories, history, project data, context files)
- Session isolation (Claude subprocess state)
- Tool access control (MCP tool scoping)
- Prompt content analysis (what data enters the prompt)
- Delegation isolation (sub-agent boundaries)

**Out of scope:**
- Network isolation (firewall, egress rules)
- OS-level sandboxing (containers, VMs)
- Authentication/authorization for the web UI
- Rate limiting or resource quotas

---

## Output Location

Research findings should be saved to: `AI_RESEARCH/agent-isolation/`
