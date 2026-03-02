# Workspace Isolation for Concurrent AI Agents — Synthesis
Date: 2026-03-01
Status: Final synthesis across 4 parallel research streams

## Research Scope

How do large companies, open source projects, and academic researchers solve the "pollution" problem
— preventing concurrent AI coding agents from clobbering each other's work? How should Harness
design its Workspace concept?

Prior research files:
- `2026-03-01-workspace-isolation-industry-patterns.md` — Enterprise platform patterns
- `2026-03-01-agent-workspace-isolation-patterns.md` — Open source frameworks
- `2026-03-01-agent-workspace-isolation-research.md` — White papers and academic sources
- `2026-03-01-git-worktree-agent-isolation.md` — Git worktree deep-dive

---

## The Core Problem

When 5 chat sessions run simultaneously in Harness, all agents share:
- The same working directory (file conflicts, clobbered edits)
- The same git branch (commit history contamination)
- The same node_modules and build outputs
- The same .env files and environment variables
- The same TCP ports (dev servers collide on 3000)

This is "pollution" — agents stepping on each other without knowing it.

---

## What the Industry Has Converged On

### The Two-Tier Model

Every major platform uses one of two isolation tiers, or stacks them:

| Tier | Technology | Boot Time | File Isolated | Process Isolated | Port Isolated | DB Isolated |
|------|-----------|-----------|---------------|------------------|---------------|-------------|
| **Light** | Git worktrees | <50ms | YES | NO | NO | NO |
| **Full** | VM / microVM | 80ms–5s | YES | YES | YES | YES |

No one does bare-process isolation without git worktrees or containers. No one does VMs without worktrees or equivalent.

### Platform-by-Platform

**GitHub Copilot Workspace**
- Local background agents: git worktrees created automatically, branch restricted to `copilot/*`
- Cloud tasks: ephemeral GitHub Actions runner per task, destroyed after
- Isolation is mandatory for cloud, opt-in for local
- Branch restriction enforced at git permission layer (not convention)

**Devin (Cognition AI)**
- Full Ubuntu 22.04 VM per session — not configurable, always on
- No local file access; agents clone from GitHub URL, exit only via PR
- Enterprise: runs in customer's own VPC
- Most expensive isolation, most complete

**Cursor**
- Local agents: git worktrees (up to 8 parallel)
- Cloud Agents: ephemeral VMs with own filesystem, terminal, network, package manager
- Changes from parallel worktrees NOT auto-merged — user clicks "Apply" with conflict UI
- Documented disk problem: 9.82GB in 20 minutes on a 2GB codebase (build artifact accumulation)

**Google Jules**
- Ephemeral GCP VM per task, destroyed after task completes (even on failure)
- The most aggressive zero-persistence model
- Concurrency limited: 3 tasks (free), 10 tasks (Pro)

**Anthropic Claude Code**
- Git worktrees natively: `--worktree` flag, stores at `repo/.claude/worktrees/<name>`
- Subagents support `isolation: worktree` in frontmatter
- Boris Cherny (creator): "my #1 productivity tip, I run 3-5 simultaneously"
- Harness already implements this via `worktree-setup` hook

**Microsoft AutoGen / Magentic-One**
- No native isolation — Docker is recommended but not enforced
- Official guidance: "run all tasks in Docker containers to isolate"
- Sub-agents share the same process and filesystem by default
- Isolation is the operator's responsibility

**E2B (e2b.dev)**
- Firecracker microVM per sandbox (hardware-level, KVM-based)
- Boot time: 80–200ms | Memory overhead: <5MB per VM | Throughput: 150 VMs/sec per host
- Powers AWS Lambda and Fargate (trillions of invocations/month)
- Used by Manus, Groq Compound Beta, others

### Open Source Frameworks

**OpenClaw** (`github.com/openclaw/openclaw`) — the project the user asked about
- OS process + workdir per session (NOT containers)
- Sessions stored under `~/.openclaw/sessions/`
- Agents take a `workdir` parameter — file operations scoped to that directory
- For PR work: explicit use of temporary cloned repos or git worktrees
- Multiple agents via `background: true` with unique `sessionId`s
- Safety rule: "Never start Codex in `~/.openclaw/` — it'll read your soul docs"
- Isolation is cooperative/convention-based, NOT enforced
- Renamed from Clawdbot/Moltbot due to Anthropic trademark pressure; creator joined OpenAI

**OpenHands** (`github.com/All-Hands-AI/OpenHands`)
- Docker container per session
- Three-tier image caching (Source → Lock → Versioned tags) to minimize rebuild overhead
- Issue #8108: active discussion on container reuse vs. per-conversation containers
- V1 SDK refactor underway to decompose into agent/tool/workspace packages with opt-in sandboxing

**SWE-agent + SWE-ReX** (`github.com/SWE-agent/SWE-ReX`)
- **SWE-ReX** is a standalone library abstracting isolation backends behind one API:
  Local / Docker / AWS EC2 / Modal / Fargate / Daytona
- Maintains stateful shell sessions (not one subprocess per command)
- SWE-bench: each of 500 benchmark tasks gets its own Docker container
- **SWE-MiniSandbox**: container-free alternative using Linux mount namespaces + chroot
  - 25% of container prep time, 5% storage footprint
  - Designed for RL training where spinning up 1000 Docker containers is too slow

**LangGraph** (fundamentally different model)
- Isolation is entirely in the persistence layer (DB threads), not filesystem or processes
- Each graph execution has a `thread_id`; state never crosses thread boundaries
- Zero infrastructure overhead — multiple agents share one Python process
- But: no filesystem isolation whatsoever. If agents write files, need a separate layer.

**ccswarm** (`github.com/nwiizo/ccswarm`)
- Coordinates specialized agent pools (Frontend, Backend, DevOps, QA) in separate worktrees
- Community tool built on top of Claude Code worktrees

---

## What Git Worktrees Solve vs. Don't Solve

### Solved
- Working directory isolation (file edits fully independent, no clobber)
- Index / staging area (git add, commit, status all independent)
- Branch state (one branch per worktree enforced by git)
- Per-worktree refs (bisect state, rebase state)
- Per-worktree config (with `extensions.worktreeConfig = true`)
- Shared object store (no history duplication — 10-50x more disk-efficient than full clones)

### NOT Solved
- **node_modules** — not in git, doesn't exist in new worktrees (pnpm hardlinks mitigate cost)
- **TCP ports** — dev servers still default to 3000, 5432, 8080 (collide if agents run servers)
- **Environment variables** — `.env` files are gitignored, not present in new worktrees
- **Database state** — all worktrees share the same PostgreSQL instance
- **Running processes** — no per-worktree process isolation
- **Build artifacts** — `.next/`, `dist/` accumulate per worktree (disk cost)
- **Shared `.git/config`** — modifications visible to all worktrees instantly

### The Port/DB Problem Is Universal
Every non-container platform documents this exact gap:
> "No tool connects worktree code isolation with full environment isolation." — Upsun Developer Center

---

## Isolation Level Taxonomy (from academic research)

From Fly.io's evaluation + SWE-MiniSandbox paper + OWASP 2026:

| Mechanism | Boot Time | Isolation Strength | Disk Overhead | Best For |
|-----------|-----------|-------------------|---------------|----------|
| Git worktree | <50ms | Filesystem + branch only | ~50-100MB (pnpm) | Concurrent coding, collision avoidance |
| chroot only | <50ms | Filesystem root restriction | None | Legacy, not recommended standalone |
| Linux namespaces (mount + net) | ~50ms | FS + network + UID | None | High-volume RL training on trusted repos |
| OCI containers (Docker) | ms | Namespace isolation, shared kernel | Image size | Trusted code, dev environments |
| gVisor | <1s | Syscall interception, no shared kernel | Low | Moderate trust, compute-heavy |
| Firecracker microVM | 80-200ms | Dedicated kernel, hardware boundary | <5MB/VM | Multi-tenant, untrusted code |
| Kata Containers | ~200ms | Same as Firecracker, K8s-native | Medium | Production K8s |
| Full VM | 1-30s | Maximum, hypervisor boundary | GB | Maximum security |

### Three Use-Case Clusters (from academic consensus)

**Cluster A — Trusted coding agents (same org):** Worktrees are the standard. Remaining gap (ports/databases) handled by convention or ephemeral CI. Anthropic ships this natively.

**Cluster B — RL training at scale (trusted repos, massive parallelism):** Linux namespace + chroot without containers is the emerging best practice. 25% prep time, 5% storage vs. Docker.

**Cluster C — Agents executing untrusted/LLM-generated code:** OWASP 2026 explicitly states: "software-only sandboxing is insufficient." MicroVMs (Firecracker) are the current standard.

---

## Harness-Specific Analysis

### What Harness Already Has (Do Not Rebuild)
- `worktree-setup` hook creates git worktrees at `.claude/worktrees/` ✓
- Thread-scoped database model — each agent operates on its own `threadId` rows ✓
- `pnpm install` runs in the worktree at creation ✓
- Named branch convention `worktree/<name>` ✓

### Gaps in Current Implementation

**Gap 1: `.env` files not copied at worktree creation (HIGH priority)**
New worktrees have no `.env` or `.env.local`. Agents fail trying to connect to the database.
Fix: copy `.env` and `.env.local` from project root at `worktree-setup` time.

**Gap 2: No worktree cleanup (MEDIUM priority)**
Worktrees accumulate indefinitely. No teardown when threads are deleted.
Fix: add `teardown_worktree()` function called when a Thread is deleted:
```bash
git worktree remove --force .claude/worktrees/<id>
git branch -D worktree/<id>
git worktree prune
```

**Gap 3: Branch naming uniqueness (LOW priority)**
`worktree/<name>` without a timestamp suffix can collide if an agent is re-created.
Fix: append timestamp: `worktree/<agentId>-<unix-timestamp>`

**Gap 4: Port conflicts if agents run dev servers (FUTURE)**
Not a current issue — Harness agents run typecheck/test, not `pnpm dev`.
If this changes: assign each worktree a port range (e.g., 3100+N based on worktree index).

**Gap 5: Database state (NOT A PROBLEM for Harness)**
Harness's thread-scoped data model already provides per-agent DB isolation.
Each agent writes to its own `Thread`, `Message`, `Metric` rows. No cross-contamination.

### What the "Workspace" Feature Should Be

Based on the research, Harness's Workspace concept maps cleanly to this design:

```
Workspace = {
  id: string,                    // UUID
  name: string,                  // human-readable ("my harness project")
  rootPath: string,              // absolute filesystem path agent operates within
  worktreePath: string,          // .claude/worktrees/<id>/ — the agent's working dir
  branch: string,                // worktree/<id>-<timestamp>
  envFiles: string[],            // paths to .env files copied at creation
  portOffset?: number,           // future: port range allocation
  createdAt: Date,
  ttlHours: number,              // auto-cleanup after N hours of inactivity
}
```

**Workspaces vs. Threads:** A Workspace is the environment/filesystem context. A Thread is the conversation context. One Thread maps to one Workspace (1:1 for now). A Workspace can outlive a Thread (you might want to inspect the worktree after a conversation ends).

**Workspaces vs. Projects:** A Project is a repository/codebase configuration. A Workspace is a live, isolated working directory within a Project. Multiple Workspaces can exist within one Project simultaneously — that's the whole point.

---

## Recommended Implementation Path

### Phase 1: Fix Current Gaps (1-2 days)
1. Add `.env` copy to `worktree-setup` hook
2. Add `worktree teardown` to the Thread deletion flow
3. Add timestamp suffix to branch names

### Phase 2: Workspace Model (1 week)
1. Add `Workspace` table to Prisma schema (id, threadId, rootPath, worktreePath, branch, createdAt, deletedAt)
2. Create a workspace plugin (`@harness/plugin-workspace`) with:
   - `onMessage`: look up workspace for thread, set working directory context
   - `onBeforeInvoke`: inject workspace path as context for the agent
3. Web UI: show workspace status per thread (branch name, path, created time)

### Phase 3: Optional Escalation (future)
- If agents need to run dev servers: port allocation registry in workspace plugin
- If agents execute untrusted code: E2B integration as a `WorkspaceProvider` implementation
- SWE-ReX's abstraction pattern (Local / Docker / E2B backends behind one API) is the model to follow

---

## Key Sources

- [GitHub Copilot Coding Agent (VS Code Docs)](https://code.visualstudio.com/docs/copilot/copilot-coding-agent)
- [Cursor Worktrees (Docs)](https://cursor.com/docs/configuration/worktrees)
- [Claude Code Worktrees (ClaudeFast)](https://claudefa.st/blog/guide/development/worktree-guide)
- [Boris Cherny on Worktrees (Threads)](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj/)
- [Git Worktrees for Parallel AI Agents (Upsun DevCenter)](https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenHands Runtime Architecture](https://docs.openhands.dev/modules/usage/architecture/runtime)
- [SWE-ReX GitHub](https://github.com/SWE-agent/SWE-ReX)
- [SWE-MiniSandbox (arxiv 2602.11210)](https://arxiv.org/html/2602.11210v1)
- [Fault-Tolerant Sandboxing (arxiv 2512.12806)](https://arxiv.org/html/2512.12806v1)
- [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
- [Fly.io: Sandboxing and Workload Isolation](https://fly.io/blog/sandboxing-and-workload-isolation/)
- [Modal Labs: What is an AI Code Sandbox](https://modal.com/blog/what-is-ai-code-sandbox)
- [E2B Firecracker Sandbox](https://e2b.dev/)
- [ccswarm Multi-Agent Worktree Orchestrator](https://github.com/nwiizo/ccswarm)
- [OpenAI Codex Worktrees Documentation](https://developers.openai.com/codex/app/worktrees/)
- [Git Worktree Official Documentation](https://git-scm.com/docs/git-worktree)
