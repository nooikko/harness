# Research: Agent Workspace & Environment Isolation Patterns
Date: 2026-03-01

## Summary

Survey of open source AI coding agent frameworks and how each solves workspace/environment isolation
for concurrent or multi-session agent execution. Covers OpenClaw, OpenHands, SWE-agent/SWE-ReX,
Aider, Claude Code worktrees, LangGraph, Sweep AI, and E2B.

## Prior Research

None directly on this topic. Related: `2026-02-22-claude-code-ecosystem-state.md`,
`2026-03-01-industry-gap-analysis-agent-orchestration.md`.

## Current Findings

### 1. OpenClaw (github.com/openclaw/openclaw)

**Isolation mechanism:** Directory-scoped process isolation with PTY sessions.

- Sessions stored under `~/.openclaw/sessions/` (flat local directory, non-configurable)
- Agent coding work runs in designated `workdir` parameters — each agent is scoped to a folder
- For PR review work, agents run in **temporary cloned repos or git worktrees**, not the main checkout
- Hard rule: agents must never start in `~/.openclaw/` itself (soul/config docs must not contaminate agent context)
- Multiple agents spawn simultaneously via `background: true`; each receives a unique `sessionId`
- `process` tool manages concurrent sessions: `list`, `log`, `poll`, `kill`
- Requires `pty: true` for all agent invocations — agents are interactive terminal apps needing pseudo-terminals

**Session/workspace concept:** Sessions are OS processes with working directories. No container
boundary. Isolation is filesystem-path-based + process-level.

**Key tradeoff:** Lightweight (no Docker overhead), but no memory/CPU/network enforcement. Isolation
relies entirely on the agent respecting its `workdir`.

**Sources:**
- https://github.com/openclaw/openclaw
- https://github.com/openclaw/openclaw/blob/main/AGENTS.md
- https://github.com/openclaw/openclaw/blob/main/skills/coding-agent/SKILL.md

---

### 2. OpenHands / All-Hands AI (github.com/All-Hands-AI/OpenHands)

**Isolation mechanism:** Docker container per session with EventStream-based REST communication.

Architecture:
1. User provides a base Docker image
2. OpenHands builds an "OH Runtime Image" embedding a runtime client
3. On session start, a fresh container launches from that image, initializing an `ActionExecutor`
4. The orchestrator backend communicates with the container over REST API (actions in, observations out)
5. Container is torn down at session end

Key source files (from docs):
- `openhands/runtime/impl/docker/docker_runtime.py` — Docker lifecycle management
- `openhands/runtime/impl/eventstream/eventstream_runtime.py` — EventStream communication layer
- `openhands/runtime/impl/action_execution/action_execution_client.py` — client side

Image tagging for cache efficiency uses three tiers:
- **Source tag** — hashed from OpenHands source; exact match = no rebuild
- **Lock tag** — hashed from base image + dependency lock files; faster partial rebuild
- **Versioned tag** — version + image name; slowest rebuild path

Multi-user isolation: separate container per agent session, named volumes + bind mounts for project
workspaces, overlay copy-on-write layers for read-only mounts, file-locked port allocation to prevent
conflicts.

**Known issue (GH Issue #8108):** OpenHands was creating a new runtime container for every new
conversation, which is expensive. There is active work on container reuse across conversations.

**V1 SDK direction (2025):** A modular SDK refactor is underway to separate core agent logic,
multiple CLIs, web server, and runtime providers (local Docker, Kubernetes) into distinct packages
with opt-in sandboxing. This is documented in arxiv.org/html/2511.03690v1.

**Session/workspace concept:** Each session is a container. The container has a bash shell, web
browser, and IPython server. State is ephemeral by default; bind mounts can persist specific paths.

**Key tradeoffs:** Strong isolation (OS-level), reproducible environments, but container startup
latency per session and high resource consumption at scale.

**Sources:**
- https://docs.openhands.dev/modules/usage/architecture/runtime
- https://github.com/OpenHands/OpenHands/issues/8108
- https://arxiv.org/html/2511.03690v1

---

### 3. SWE-agent + SWE-ReX (github.com/SWE-agent/SWE-agent, github.com/SWE-agent/SWE-ReX)

**Isolation mechanism:** Container per task; abstracted via SWE-ReX runtime interface.

SWE-agent's core innovation is the **Agent-Computer Interface (ACI)** — a custom set of LM-centric
shell commands for browsing repos, viewing/editing files, and running tests. The ACI sits on top of
an execution backend that is fully swappable.

SWE-ReX is the extraction of that execution layer into a standalone library:
- Abstracts execution across: local, Docker, AWS EC2, Modal, AWS Fargate, Daytona (WIP)
- Maintains **stateful shell sessions** (not subprocess-per-command), enabling interactive tools
  like `ipython` and `gdb`
- Supports **parallel sessions** — multiple isolated shell environments simultaneously
- Agent code is backend-agnostic: the same code runs locally or in Docker or on Modal

The SWE-bench evaluation model: each of the 500 benchmark tasks gets its own isolated Docker
container, ensuring reproducible and non-interfering evaluation.

**Alternative approach — SWE-MiniSandbox (2026):** A container-free approach using Linux namespaces
directly:
- Per-instance mount namespaces via `chroot`
- Separate private directory for each agent
- Bind-mounts necessary system directories into the private root
- No Docker daemon required; namespace isolation via Linux kernel primitives
- Useful for high-throughput RL training where Docker overhead is prohibitive

**Session/workspace concept:** SWE-ReX calls these "runtime sessions." Each session maintains a
persistent shell process. The SWE-ReX API standardizes session create/execute/destroy across all
backends.

**Key tradeoffs:** SWE-ReX's backend abstraction is elegant but adds an indirection layer. Container
mode is robust but slow for large-scale parallelism (hence SWE-MiniSandbox). Local mode has no
isolation.

**Sources:**
- https://github.com/SWE-agent/SWE-agent
- https://github.com/SWE-agent/SWE-ReX
- https://arxiv.org/html/2602.11210v1 (SWE-MiniSandbox)

---

### 4. Aider (github.com/Aider-AI/aider)

**Isolation mechanism:** None native — single-instance, process-level tool.

Aider is designed as a single developer's pair-programming assistant. It has no built-in
workspace isolation or multi-session management. It operates directly on the current git working
directory.

For parallel usage, the community has built external wrappers:
- **AiderDesk** (github.com/hotovo/aider-desk): GUI that manages multiple Aider instances in
  parallel, uses git worktrees for isolation
- **Claude Squad**: Terminal app managing multiple coding agents (including Aider) in parallel,
  each agent gets its own git worktree

**Session/workspace concept:** No formal session concept. State is the current git repo state.

**Key tradeoffs:** Maximum simplicity (no infrastructure), but parallelism requires external tooling.
Aider's git-native approach makes it naturally compatible with worktree-based isolation.

**Sources:**
- https://github.com/Aider-AI/aider
- https://github.com/hotovo/aider-desk

---

### 5. Claude Code git worktree isolation (community pattern)

**Isolation mechanism:** Git worktree per agent session — native filesystem isolation without
full repo cloning.

How it works:
- `git worktree add` creates a linked working directory with its own HEAD, index, and branch
- Multiple Claude Code sessions each run in a separate worktree directory
- Worktrees share the same `.git` database (history, remotes, objects) but have isolated file states
- Each agent sees only its worktree's files; branch switches in one worktree do not affect others
- Claude Code supports `--worktree` flag natively for single-command setup

Boris Cherny (Claude Code creator at Anthropic) called worktrees his #1 productivity tip, running
3-5 simultaneously for large batch migrations.

**Community orchestration tools:**
- `ccswarm` (github.com/nwiizo/ccswarm): Multi-agent coordination with worktree isolation, assigns
  specialized agent pools (Frontend, Backend, DevOps, QA) to separate worktrees
- `parallel-code` (github.com/johannesjo/parallel-code): GUI for running Claude Code + Codex +
  Gemini side-by-side in separate worktrees

**Known limitations of worktrees alone:**
- Port conflicts: dev servers default to the same ports (3000, 5432, 8080)
- Dependency duplication: each worktree needs its own `node_modules` / `pnpm install`
- Shared database state: two agents writing DB simultaneously creates race conditions
- Disk accumulation: reported 9.82 GB consumed in 20 minutes with automatic worktree creation
- IDE integration gaps: Claude Code's `/ide` command fails to recognize worktrees in some setups

Emerging pattern: pair worktrees (code isolation) with cloud preview environments (runtime
isolation) — each worktree gets its own deployed environment eliminating port and DB conflicts.

**Session/workspace concept:** Worktree = workspace. Each worktree is a named directory + branch.
The Claude Code session's conversation history is scoped to that worktree directory.

**Sources:**
- https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/
- https://claudefa.st/blog/guide/development/worktree-guide
- https://github.com/nwiizo/ccswarm
- https://www.threads.com/@boris_cherny/post/DVAAnexgRUj (Anthropic announcement)

---

### 6. LangGraph (langchain-ai/langgraph)

**Isolation mechanism:** Thread-based state isolation via checkpointers.

LangGraph's isolation model is fundamentally different — it does not isolate filesystem or process
execution. Instead, it isolates **agent state** through its persistence layer:

- Every graph execution runs on a **thread** (identified by `thread_id`)
- Checkpointers save the full graph state at every superstep
- Threads are completely independent: "Each thread has a unique thread_id and keeps its own set of
  checkpoints, so its execution history stays separate"
- Concurrent execution: super-steps run nodes in parallel batches; updates are merged atomically
  using reducer logic
- Fault tolerance: if a node fails mid-superstep, completed nodes' writes are preserved; on resume
  only failed nodes re-run

Checkpointer backends: InMemorySaver (dev), SqliteSaver (local), PostgresSaver (production),
Azure CosmosDB, Amazon DynamoDB.

**Notable pattern:** LangGraph's state isolation is at the data layer, not the execution layer.
Multiple agents can share the same Python process — they are isolated by `thread_id` in the database,
not by OS-level boundaries.

**Session/workspace concept:** A "thread" is a persistent conversation/execution context. A "run"
is a single graph execution within a thread. Human-in-the-loop, time-travel, and memory features
all build on thread checkpoints.

**Key tradeoffs:** Very low overhead (no containers), natural persistence and replay. But no
filesystem or process isolation — not suitable for running untrusted code. Designed for orchestrating
LLM calls, not arbitrary shell execution.

**Sources:**
- https://docs.langchain.com/oss/python/langgraph/persistence
- https://medium.com/@vinodkrane/mastering-persistence-in-langgraph-checkpoints-threads-and-beyond-21e412aaed60

---

### 7. Sweep AI (github.com/sweepai/sweep)

**Isolation mechanism:** Docker container per PR/issue task.

Sweep is a GitHub-integrated agent that turns issues into pull requests. It is
parallelizable — "developers can spin up 10 tickets and Sweep will address them all at once."

Each task runs in a Docker container (image on Docker Hub: `sweepai/sweep`). Self-hosted
deployment uses Docker Compose. The isolation granularity is per-issue/per-PR, not per user session.

The codebase uses the dependency graph + text/vector search to understand the repo, then runs
unit tests and autoformatters inside the container to validate generated code before creating a PR.

**Session/workspace concept:** A GitHub Issue is the workspace unit. Each issue spawns a container
that clones the repo, makes changes, runs validation, and pushes a branch. Containers are ephemeral.

**Key tradeoffs:** Strong isolation per task (container-based), naturally fits async/parallel GitHub
workflow. But heavy (full container + repo clone per task).

**Sources:**
- https://github.com/sweepai/sweep
- https://hub.docker.com/r/sweepai/sweep

---

### 8. E2B — Sandboxing Infrastructure Layer

**Isolation mechanism:** Firecracker microVMs — hardware-level isolation with container-like ergonomics.

E2B is not a coding agent itself but a cloud infrastructure layer used by agents (including Manus,
and configurable for OpenHands via Daytona integration). Key specs:

- Each sandbox = one Firecracker microVM (KVM-based hardware virtualization)
- Boot time: ~125ms pre-configured, ~160-180ms end-to-end
- Memory overhead: 3-5 MB per instance
- Max session duration: 24 hours
- Python + JavaScript SDKs for programmatic lifecycle management
- Used as backend for SWE-ReX (Daytona, WIP)

**Why microVMs over containers:** Docker containers share the host kernel; a compromised container
can escape. Firecracker runs a minimal guest kernel per VM, enforcing hardware-level boundaries.
Performance overhead is minimal (125ms boot vs ~50ms container start) but security posture is
dramatically stronger.

**Session/workspace concept:** Each "sandbox" is a full VM with persistent filesystem for its
lifetime, accessible via SDK. Destroyed at session end or after 24h timeout.

**Sources:**
- https://e2b.dev/
- https://thesequence.substack.com/p/the-sequence-ai-of-the-week-698-how-e2b-powers-safe-ai-sandboxes

---

## Key Takeaways

### Pattern Matrix

| Project | Isolation Level | Granularity | Startup Cost | Filesystem Isolation | Process Isolation |
|---------|----------------|-------------|--------------|---------------------|-------------------|
| OpenClaw | Process + workdir | Per session | ~0ms | Path-scoped only | Yes (OS process) |
| OpenHands | Docker container | Per session | ~2-5s | Full | Full |
| SWE-agent | Docker container | Per task | ~2-5s | Full | Full |
| SWE-MiniSandbox | Linux namespace | Per task | ~50ms | chroot + bind mounts | Namespace |
| Aider | None native | N/A | N/A | None | None |
| Claude Code worktree | Git worktree | Per agent | ~0ms | Branch-level | None |
| LangGraph | DB thread | Per run | ~0ms | None | None |
| Sweep AI | Docker container | Per issue | ~2-5s | Full | Full |
| E2B | Firecracker microVM | Per session | ~125ms | Full | Hardware-level |

### Dominant Design Choices

1. **Docker per task** is the most common robust approach (OpenHands, SWE-agent, Sweep). Strong
   isolation, reproducible, but resource-heavy and slow to scale.

2. **Git worktree per agent** is the Claude Code community's dominant pattern. Zero infrastructure
   cost, filesystem isolation at the branch level, but no runtime isolation (ports, DB, processes).

3. **Linux namespaces without Docker** (SWE-MiniSandbox) is emerging for high-throughput RL/eval
   workloads where Docker overhead is prohibitive. Requires Linux host.

4. **Workdir + PTY process** (OpenClaw) is the lightest approach — relies on agent cooperation
   rather than OS enforcement.

5. **Database-layer isolation** (LangGraph threads) is suitable for pure LLM orchestration with
   no filesystem side effects.

6. **MicroVM** (E2B) is the highest-security option with the best performance/isolation ratio.

### The Port/DB Problem

All worktree and process-level isolation approaches share a blind spot: runtime resources (ports,
databases, file locks) are not isolated. Production deployments pairing worktrees with per-worktree
cloud environments solve this but add significant infrastructure.

## Sources

- https://github.com/openclaw/openclaw
- https://github.com/openclaw/openclaw/blob/main/AGENTS.md
- https://github.com/openclaw/openclaw/blob/main/skills/coding-agent/SKILL.md
- https://docs.openhands.dev/modules/usage/architecture/runtime
- https://github.com/OpenHands/OpenHands/issues/8108
- https://arxiv.org/html/2511.03690v1
- https://github.com/SWE-agent/SWE-agent
- https://github.com/SWE-agent/SWE-ReX
- https://arxiv.org/html/2602.11210v1
- https://github.com/Aider-AI/aider
- https://github.com/hotovo/aider-desk
- https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/
- https://github.com/nwiizo/ccswarm
- https://github.com/johannesjo/parallel-code
- https://docs.langchain.com/oss/python/langgraph/persistence
- https://github.com/sweepai/sweep
- https://e2b.dev/
