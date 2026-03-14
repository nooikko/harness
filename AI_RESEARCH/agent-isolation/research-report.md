# Agent Isolation Research Report

**Date:** 2026-03-13
**Scope:** How Harness isolates agents from data/context not meant for them
**Non-goal:** Complete sandboxing — agents should be able to work on code

---

## Executive Summary

Harness has **strong data-layer isolation** (memories, history, project data are properly scoped by agent/thread/project) but **weak execution-layer isolation** (Claude SDK sessions run with `bypassPermissions`, full filesystem access, and all MCP tools exposed globally). The biggest risks aren't data leaks between agents — they're agents accessing the host system itself.

**Confidence: HIGH** — all findings are from direct codebase inspection and official SDK documentation.

---

## Isolation Matrix

| Layer | What's Isolated | What's Shared/Open | Severity |
|-------|----------------|-------------------|----------|
| **Agent Memories** | Dual-key filtering (agentId + scope) | — | SECURE |
| **Thread History** | Exact threadId query | — | SECURE |
| **Project Data** | projectId-scoped queries | — | SECURE |
| **File References** | threadId/projectId + FileScope enum | — | SECURE |
| **User Profile** | — | Global singleton (all threads see same profile) | LOW (by design) |
| **Claude Sessions** | Per-threadId pool keying | — | SECURE |
| **Identity Injection** | Gates on thread.agentId + agent.enabled | — | SECURE |
| **Delegation** | Task threads have agentId: null, separate session | projectId inherited from parent | SECURE |
| **MCP Tools** | — | All 7 tools exposed to all sessions | HIGH |
| **Plugin DB Access** | PluginConfig sandboxed per-plugin | Full access to all other tables | MEDIUM (trusted code) |
| **Admin API** | — | /api/threads, /api/tasks, /api/metrics return all records | MEDIUM |
| **Filesystem** | — | Full read/write to entire filesystem | CRITICAL |
| **Shell Access** | — | Unrestricted Bash execution | CRITICAL |
| **Environment Vars** | ANTHROPIC_API_KEY + CLAUDECODE stripped | All other env vars inherited (DATABASE_URL, etc.) | HIGH |

---

## Finding 1: Data Isolation Is Strong

**Confidence: HIGH**

Every DB query in the prompt assembly chain correctly scopes by the appropriate key:

### Complete Prompt Skeleton (annotated by scope)

```
┌─────────────────────────────────────────────────┐
│ PROJECT-SCOPED                                  │
│  <project_instructions> from thread.project     │
│  <project_memory> from thread.project           │
├─────────────────────────────────────────────────┤
│ GLOBAL                                          │
│  <user_profile> singleton record                │
├─────────────────────────────────────────────────┤
│ THREAD + PROJECT SCOPED                         │
│  File references (THREAD files + PROJECT files) │
├─────────────────────────────────────────────────┤
│ THREAD-SCOPED (skipped if sessionId exists)     │
│  Conversation summaries (up to 2)               │
│  Conversation history (25-50 messages)          │
├─────────────────────────────────────────────────┤
│ AGENT-SCOPED                                    │
│  Soul, Identity, User Context, Role, Goal,      │
│  Backstory (from Agent record)                  │
│  Memories grouped by scope:                     │
│    ### Core (AGENT scope — always retrieved)     │
│    ### Project Context (PROJECT scope)           │
│    ### This Conversation (THREAD scope)          │
├─────────────────────────────────────────────────┤
│ THREAD-SCOPED                                   │
│  Thread header, kind instruction                │
│  Custom instructions                            │
│  User message                                   │
├─────────────────────────────────────────────────┤
│ AGENT-SCOPED                                    │
│  Behavioral anchor (core principle from soul)   │
├─────────────────────────────────────────────────┤
│ GLOBAL                                          │
│  Time injection (if /current-time in message)   │
└─────────────────────────────────────────────────┘
```

**No unfiltered DB queries found** across all 14 plugins and the orchestrator core. The only global elements in the prompt are the UserProfile singleton and time injection — both intentional.

### Memory Scoping Works Correctly

The 3-level `MemoryScope` enum (AGENT/PROJECT/THREAD) on `AgentMemory` properly prevents cross-contamination:
- AGENT memories: always retrieved (personality continuity)
- PROJECT memories: only when `thread.projectId` matches
- THREAD memories: only when `threadId` matches

---

## Finding 2: MCP Tool Access Is Globally Open

**Confidence: HIGH**

All 7 plugin tools are exposed to every Claude session with no filtering:

| Tool | Plugin | Scopes by threadId? | Risk |
|------|--------|---------------------|------|
| `delegation__delegate` | delegation | Yes (parentThreadId) | **No recursion depth limit** — sub-agent can call delegate again |
| `delegation__checkin` | delegation | Yes | Low — silent failure if no parent |
| `cron__schedule_task` | cron | Yes (thread lookup) | **Can create jobs for other agents** via threadId override |
| `project__get_project_memory` | project | Yes | Low — read-only, but leaks project data to sub-agents |
| `project__set_project_memory` | project | Yes | **Overwrites entire project memory** — destructive |
| `identity__update_self` | identity | Yes (thread → agentId) | **Sub-agent can modify parent's agent identity** |
| `time__current_time` | time | N/A | Safe — stateless |

### The `allowedTools` Field Exists But Is Never Used

`InvokeOptions` defines `allowedTools?: string[]` in the plugin contract. No code path ever sets it. The tool server's `collectTools` function flatmaps all plugin tools without filtering.

### Specific Risks

**Delegation recursion:** A sub-agent in a task thread can call `delegation__delegate`, creating a nested task thread. No depth counter exists. Cost cap ($5) and iteration limit (5) bound the damage per level, but nested delegation multiplies the total.

**Identity hijacking:** A sub-agent can call `identity__update_self`, which resolves `agentId` from `meta.threadId`. If the task thread somehow has an agentId assigned (not currently the case — task threads have `agentId: null`), the sub-agent could rewrite the parent agent's soul/name/identity. Currently mitigated by task threads being agent-less.

**Project memory overwrite:** `set_project_memory` does a full replace, not an append. A sub-agent (which inherits `projectId` from its parent thread) can overwrite the entire project memory document.

---

## Finding 3: Delegation Creates Good Isolation

**Confidence: HIGH**

Task threads are deliberately agent-less:

```
Parent Thread (T1)              Task Thread (TT1)
├─ agentId: agent_123           ├─ agentId: null ← deliberate
├─ projectId: proj_A            ├─ projectId: proj_A ← inherited
├─ Session S1 (pool key: T1)   ├─ Session S3 (pool key: TT1) ← separate
├─ Identity injection: ON       ├─ Identity injection: OFF (no agent)
├─ Memory writes: ON            ├─ Memory writes: OFF (no agent)
└─ Full soul + memories         └─ Generic Claude, no personality
```

Key properties:
- **No soul injection** — `loadAgent(TT1)` returns null, identity plugin is a no-op
- **No memory writes** — `onAfterInvoke` exits early when no agent assigned
- **Separate session** — task thread gets its own Claude subprocess
- **No parent visibility** — sub-agent cannot see parent thread's history or messages
- **Cost bounded** — $5 default cost cap, 5 max iterations, quadratic backoff on failures

---

## Finding 4: Filesystem Access Is Unrestricted (CRITICAL)

**Confidence: HIGH** — verified against official Claude Agent SDK documentation and GitHub issues.

### Current Session Configuration

```typescript
// apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts
options: {
  model,
  cwd: os.tmpdir(),                      // ← NOT a filesystem restriction
  permissionMode: 'bypassPermissions',    // ← Full autonomous access
  allowDangerouslySkipPermissions: true,  // ← Required companion flag
  env,                                    // ← process.env minus 2 keys
  mcpServers: config.mcpServerFactory?.()
}
```

### What `cwd: os.tmpdir()` Actually Does

- Prevents Claude from auto-loading `CLAUDE.md` and `.claude/rules/` from the project root
- Sets the working directory for relative paths
- **Does NOT restrict absolute path access** — Claude can still `Read('/Users/quinn/dev/harness/.env')`

### What `bypassPermissions` Actually Means

Every built-in tool runs without approval:
- `Read` — any file on the filesystem
- `Write` / `Edit` — any writable path
- `Bash` — arbitrary shell commands
- `WebSearch` / `WebFetch` — outbound network requests
- `Glob` / `Grep` — filesystem search

### Environment Variable Exposure

```typescript
const env = { ...process.env };
delete env.CLAUDECODE;
delete env.ANTHROPIC_API_KEY;
// Everything else inherited: DATABASE_URL, DISCORD_TOKEN, etc.
```

An agent can run `Bash(command: 'env')` to see all environment variables except the two stripped ones.

### Available Restriction Mechanisms

| Mechanism | Effect | Complexity |
|-----------|--------|------------|
| `disallowedTools: ['Bash']` | Block shell access entirely | Trivial — 1 line |
| `permissionMode: 'dontAsk'` + `allowedTools` whitelist | Hard-deny unlisted tools | Moderate — requires defining allowed set |
| PreToolUse hooks with path validation | Per-tool path restrictions | Complex — hooks fire even in bypassPermissions |
| `sandbox.filesystem` | Bubblewrap for Bash only | **Buggy** — Write/Edit bypass it (GitHub #29048) |

### SDK Limitations

- `sandbox.filesystem` does NOT restrict Write/Edit tools (known bug, no fix timeline)
- Subagents spawned via Agent tool inherit `bypassPermissions` with no override capability (feature request closed as NOT PLANNED, Feb 2026)
- `additionalDirectories` docs are minimal — unclear what it actually enables

---

## Finding 5: Plugin DB Access Is Trustworthy (With One Exception)

**Confidence: HIGH**

12 of 14 plugins properly scope all DB queries. Two notable observations:

**Web plugin admin endpoints** (`packages/plugins/web/src/_helpers/routes.ts`):
- `GET /api/threads` — returns ALL threads, no filter
- `GET /api/tasks` — returns ALL tasks, no filter
- `GET /api/metrics` — returns last 100 metrics across all threads

These are admin endpoints used by the `/admin` UI. Acceptable for single-tenant, but would need scoping for multi-tenant.

**Context plugin UserProfile** — global singleton, intentional. All threads see the same user profile.

---

## Finding 6: No `context/` Directory Exists

**Confidence: HIGH**

The `context/` directory referenced in some documentation describes Claude Code CLI's context files (used when running `claude -p` locally), not orchestrator-managed runtime files. The context plugin loads data from the database (file references, history, project data), not from the filesystem.

---

## Risk Assessment

### Isolation Spectrum

```
DATA ISOLATION              EXECUTION ISOLATION
(where we are strong)       (where we are weak)

     Memories ──── SECURE         Filesystem ──── OPEN
      History ──── SECURE         Shell ──────── OPEN
Project Data ──── SECURE         Env Vars ───── MOSTLY OPEN
   Sessions  ──── SECURE         MCP Tools ──── ALL EXPOSED
  Delegation ──── SECURE         Network ────── OPEN
```

### Risk Scenarios (ordered by likelihood × impact)

| # | Scenario | Likelihood | Impact | Current Mitigation |
|---|----------|------------|--------|-------------------|
| 1 | Agent reads `.env` or DB connection string | HIGH | HIGH | None — `bypassPermissions` allows arbitrary Read |
| 2 | Agent executes destructive shell command | MEDIUM | CRITICAL | None — Bash is unrestricted |
| 3 | Agent reads other project's source code | MEDIUM | MEDIUM | None — filesystem is flat, no path restrictions |
| 4 | Agent modifies harness source code | LOW | HIGH | `cwd: /tmp` makes it unlikely but not impossible |
| 5 | Delegation recursion exhausts resources | LOW | MEDIUM | $5 cost cap + 5 iterations (per level, not global) |
| 6 | Sub-agent overwrites project memory | LOW | MEDIUM | Task threads are agent-less (tools still exposed) |
| 7 | Agent exfiltrates data via network | LOW | HIGH | None — WebFetch/Bash can reach any endpoint |

---

## Recommendations

### Tier 1: Quick Wins (low effort, high impact)

**1a. Add `disallowedTools` for non-code agents**
```typescript
// In create-session.ts, based on thread kind or agent config
disallowedTools: thread.kind === 'cron' ? ['Bash', 'Write', 'Edit'] : []
```
Cron jobs and automated tasks rarely need shell access. Disabling Bash for non-interactive threads removes the biggest attack surface.

**1b. Strip sensitive env vars**
```typescript
// In create-session.ts — extend the env cleaning
delete env.DATABASE_URL;
delete env.DISCORD_TOKEN;
// ... any other secrets
```
Agents that need DB access should use MCP tools (which are scoped), not raw connection strings.

**1c. Wire `allowedTools` in invocation options**
The field already exists in `InvokeOptions`. Implement filtering in the tool server based on thread kind, agent config, or a new `Agent.allowedTools` field.

### Tier 2: Moderate Effort (structural improvements)

**2a. Add delegation depth limit**
In `setup-delegation-task.ts`, check if `parentThread.kind === 'task'`. Either reject nested delegation or add a depth counter field to `OrchestratorTask`.

**2b. Scope MCP tools by context**
Add a `scope` field to `PluginTool` definitions:
```typescript
tools: [{
  name: 'update_self',
  scope: 'agent-owner-only',  // only if meta.threadId's agent matches
  // ...
}]
```
The tool server validates scope before dispatching to the handler.

**2c. Switch to `permissionMode: 'dontAsk'` for delegation**
Sub-agents don't need interactive approval — they need a restricted tool whitelist. Use `dontAsk` + explicit `allowedTools` for task threads.

### Tier 3: Longer-Term (architectural decisions)

**3a. Per-agent tool profiles**
Add `AgentConfig.allowedTools: string[]` to control which MCP tools each agent can use. The tool server filters tools based on the current thread's agent.

**3b. Filesystem path restrictions via hooks**
PreToolUse hooks can validate file paths before Read/Write/Edit execute. Create a configurable allowlist per project or agent.

**3c. Project-scoped working directories**
Instead of `cwd: os.tmpdir()`, use `cwd: /data/projects/${projectId}/workspace` to give each project an isolated filesystem root. Agents can work on code within their project but can't traverse to other projects.

---

## Decision Framework

When deciding whether something should be agent-scoped or global, use this test:

```
Is this data/capability...

1. Part of agent identity? → AGENT-SCOPED
   (soul, memories, personality)

2. Part of a project's context? → PROJECT-SCOPED
   (instructions, memory, files, project-specific config)

3. Part of a specific conversation? → THREAD-SCOPED
   (history, thread files, custom instructions)

4. Infrastructure that all agents need? → GLOBAL
   (user profile, time, system config)

5. A destructive capability? → RESTRICTED
   (shell, filesystem write, identity modification, project memory write)
   → Gate by agent role, thread kind, or explicit opt-in
```

---

## Verification Log

- **Claims verified:** All findings verified by direct source code inspection
- **Verification discrepancies:** 0
- **External source verification:** Claude Agent SDK filesystem behavior verified against official docs + GitHub issues
- **Sources:** All primary (codebase + official documentation)

## Key Files Referenced

| File | What It Owns |
|------|-------------|
| `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts` | Session creation options (bypassPermissions, cwd, env) |
| `apps/orchestrator/src/invoker-sdk/index.ts` | Session pool (5 max, 8-min TTL, threadId keying) |
| `apps/orchestrator/src/invoker-sdk/_helpers/session-pool.ts` | Pool implementation (LRU eviction, model mismatch) |
| `apps/orchestrator/src/tool-server/index.ts` | Tool registration (global, no filtering) |
| `apps/orchestrator/src/orchestrator/index.ts` | Pipeline (handleMessage + sendToThread) |
| `apps/orchestrator/src/orchestrator/_helpers/prompt-assembler.ts` | Base prompt (thread header, kind instruction) |
| `apps/orchestrator/src/orchestrator/_helpers/create-scoped-db.ts` | Plugin DB sandboxing (PluginConfig only) |
| `packages/plugins/identity/src/index.ts` | Identity plugin (onBeforeInvoke, onAfterInvoke, update_self) |
| `packages/plugins/identity/src/_helpers/retrieve-memories.ts` | Memory retrieval (scope-aware OR filter) |
| `packages/plugins/identity/src/_helpers/load-agent.ts` | Agent lookup (gates identity injection) |
| `packages/plugins/context/src/index.ts` | Context injection (history, files, project data) |
| `packages/plugins/delegation/src/_helpers/setup-delegation-task.ts` | Task thread creation (agentId: null) |
| `packages/plugins/delegation/src/_helpers/delegation-loop.ts` | Delegation loop (5 iterations, $5 cap) |
| `packages/plugins/web/src/_helpers/routes.ts` | Admin endpoints (unfiltered lists) |
| `packages/plugins/cron/src/index.ts` | Cron plugin (schedule_task tool) |
| `packages/plugins/project/src/index.ts` | Project plugin (get/set_project_memory) |
