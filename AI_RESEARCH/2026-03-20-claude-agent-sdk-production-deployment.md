# Research: Claude Agent SDK Production Deployment Patterns

Date: 2026-03-20

## Summary

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`, v0.2.71 TypeScript / v0.1.48 Python) works by **spawning the `claude` CLI binary as a subprocess** and communicating over stdin/stdout using NDJSON. It is not a direct in-process API client. Anthropic publishes official production hosting documentation covering container sandboxing, four deployment patterns (ephemeral, long-running, hybrid, single-container multi-process), and a list of recommended sandbox providers. Docker is officially supported and documented. Process managers like PM2 and systemd are used for the surrounding Node.js/Python orchestrator process, not for managing the `claude` subprocess itself. `claude -p` spawns a new process per invocation with ~12s overhead; the SDK eliminates this for multi-turn sessions by keeping the subprocess alive.

## Prior Research

- `AI_RESEARCH/2026-02-24-claude-cli-streaming-cold-start.md` — full breakdown of cold start mechanics, streaming input mode, subprocess reuse. **Read this first.**
- `AI_RESEARCH/2026-03-13-claude-agent-sdk-session-isolation.md` — filesystem isolation, permission modes, security risks. Directly relevant to production deployment security.
- `AI_RESEARCH/2026-03-02-claude-agent-sdk-structured-output.md` — structured output patterns.

## Current Findings

---

### 1. How `@anthropic-ai/claude-agent-sdk` Works Under the Hood (Confidence: HIGH)

**The SDK shells out to the `claude` CLI binary.** It does NOT make API calls directly from within the Node.js/Python host process.

**Subprocess invocation model (from CHANGELOG analysis and community deep-dives):**

| Mode | CLI Command Used | Process Lifecycle |
|------|-----------------|-------------------|
| One-shot `query()` with string prompt | `claude --output-format stream-json --verbose --print -- [prompt]` | Spawned fresh per call; exits after response |
| Streaming input mode (`query()` with AsyncIterable) | `claude --input-format stream-json --output-format stream-json` | Stays alive for multiple turns; expires after ~10 min idle |
| V2 `Session` API | Same subprocess-persistence mechanism as streaming input mode | `session.close()` explicitly terminates |

**Communication protocol:**
- SDK writes JSON messages to the CLI's **stdin**
- CLI writes JSON responses to the CLI's **stdout**
- Format: NDJSON (newline-delimited JSON, one object per line)
- Two message categories: **regular messages** (agent responses, tool outputs, cost tracking) and **control messages** (permission requests, hook callbacks)

**Control protocol example** — when Claude wants to use a tool, the CLI sends a control request:
```json
{
  "type": "control_request",
  "request_id": "req_1_abc123",
  "request": {
    "subtype": "can_use_tool",
    "tool_name": "Bash",
    "input": {"command": "ls /home"}
  }
}
```
The SDK's registered callbacks respond with matching request IDs, allowing/denying/modifying tool execution.

**CLI binary requirement:**
- The TypeScript SDK requires `@anthropic-ai/claude-code` CLI installed globally (`npm install -g @anthropic-ai/claude-code`)
- The Python SDK bundles the Claude Code CLI automatically
- The binary path defaults to `claude` via PATH; configurable via `pathToClaudeCodeExecutable` option (CHANGELOG fix v0.2.63)

**Source:** CHANGELOG.md analysis of `anthropics/claude-agent-sdk-typescript`; `buildwithaws.substack.com` deep-dive; `ksred.com` SDK breakdown; prior AI_RESEARCH `2026-02-24-claude-cli-streaming-cold-start.md`

---

### 2. What `claude -p` Does Under the Hood (Confidence: HIGH)

`claude -p` (equivalent: `claude --print`) is the **non-interactive, single-invocation mode**:

- Spawns a fresh Node.js process per call
- Sends the prompt, runs the agent loop, prints result, exits
- **No persistent process, no daemon, no socket** — each invocation is a fresh cold start
- Cold start overhead: **~12s** per call (confirmed by Anthropic collaborator on GitHub issue #34)
- `--output-format stream-json` lets you consume output incrementally but does NOT reduce cold start
- `--resume [sessionId]` loads prior conversation context from disk but still incurs cold start

**There is no daemon mode, no server mode, no REPL mode that accepts multiple programmatic stdin inputs across calls.** This was an explicit feature request (GitHub issue #6009) that was not implemented.

**Source:** Official CLI reference at `code.claude.com/docs/en/cli-reference`; GitHub issue #34 on `anthropics/claude-agent-sdk-typescript`; prior AI_RESEARCH `2026-02-24-claude-cli-streaming-cold-start.md`

---

### 3. Official Production Hosting Documentation (Confidence: HIGH)

Anthropic publishes a full production hosting guide at `platform.claude.com/docs/en/agent-sdk/hosting`.

**System requirements per SDK instance:**
- Runtime: Node.js 18+ (TypeScript) or Python 3.10+ (Python), plus the Claude Code CLI
- RAM: 1 GiB recommended (scale based on task)
- Disk: 5 GiB
- CPU: 1 (scale based on task)
- Network: outbound HTTPS to `api.anthropic.com`; optional for MCP servers/external tools

**The four official production patterns:**

| Pattern | Description | Best for |
|---------|-------------|----------|
| Ephemeral sessions | New container per user task, destroyed on completion | Bug fixes, invoice processing, translation jobs, one-off media processing |
| Long-running sessions | Persistent container with possibly multiple Agent processes per container based on demand | Email triage agents, site builders, high-frequency chat bots |
| Hybrid sessions | Ephemeral containers hydrated from DB/session state on start, spun down when done | Personal project managers, deep research, multi-session customer support |
| Single containers (multi-process) | Multiple Agent SDK processes in one container, best for tight agent collaboration | Simulations, agents that interact with each other |

**Officially recommended external sandbox providers:**
- Modal Sandbox
- Cloudflare Sandboxes
- Daytona
- E2B
- Fly Machines
- Vercel Sandbox

**Cost baseline:** ~5 cents/hour minimum for a running container (dominant cost is tokens, not compute).

**FAQ from official docs:**
- Container health monitoring: same logging infrastructure as regular backend servers
- Agent sessions do not time out, but use `maxTurns` to prevent infinite loops
- Claude Code CLI is semver-versioned; breaking changes require major version bump
- Communicate with containers by exposing HTTP/WebSocket ports

**Source:** `platform.claude.com/docs/en/agent-sdk/hosting`

---

### 4. Dockerizing Claude Code — Official Support and Community Projects (Confidence: HIGH)

**Official support:**
- Anthropic provides official devcontainer configuration at `code.claude.com/docs/en/devcontainer`
- Docker is a first-class isolation technology in the secure deployment guide
- Docker Desktop + MCP Toolkit with 300+ containerized MCP servers exists as an ecosystem
- Docker Sandboxes (microVM-based isolation) is an officially documented approach for running Claude Code agents unsupervised

**Official hardened Docker run command** (from `platform.claude.com/docs/en/agent-sdk/secure-deployment`):
```bash
docker run \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --security-opt seccomp=/path/to/seccomp-profile.json \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  --tmpfs /home/agent:rw,noexec,nosuid,size=500m \
  --network none \
  --memory 2g \
  --cpus 2 \
  --pids-limit 100 \
  --user 1000:1000 \
  -v /path/to/code:/workspace:ro \
  -v /var/run/proxy.sock:/var/run/proxy.sock:ro \
  agent-image
```

With `--network none`, all network traffic routes via a Unix socket proxy on the host, which enforces domain allowlists and injects credentials. The agent never sees credentials directly.

**Key Docker challenges documented:**
- Never mount `/var/run/docker.sock` — allows agent to spin up privileged containers and gain root-level host access
- Avoid mounting `~/.ssh`, `~/.aws`, `~/.config` — credentials become visible to agent
- Shared kernel (unlike VMs): a kernel exploit could allow container escape; use gVisor for stronger isolation
- Claude Code CLI requires Node.js in the container even when using Python SDK (for the subprocess)

**Community Docker projects:**
- `github.com/RchGrav/claudebox` — ClaudeBox: per-project Docker images (Debian + NVM + Claude Code CLI), with per-project network firewalls, project isolation, state persistence, 15+ language profiles. Active, well-documented.
- `github.com/VishalJ99/claude-docker` — Claude Code in Docker with full permissions + Twilio notifications
- `github.com/Zeeno-atl/claude-code` — containerized Claude Code, written by Claude Code itself
- `github.com/tintinweb/claude-code-container` — Docker container for `--dangerously-skip-permissions` mode

**Source:** `platform.claude.com/docs/en/agent-sdk/hosting`; `platform.claude.com/docs/en/agent-sdk/secure-deployment`; `github.com/RchGrav/claudebox`; `code.claude.com/docs/en/devcontainer`; `www.docker.com/blog/run-claude-code-with-docker/`

---

### 5. Isolation Technologies (Confidence: HIGH)

From the official secure deployment guide:

| Technology | Isolation strength | Performance overhead | Complexity |
|------------|-------------------|---------------------|------------|
| Sandbox runtime (`@anthropic-ai/sandbox-runtime`) | Good (secure defaults) | Very low | Low |
| Docker (standard) | Setup dependent | Low | Medium |
| gVisor | Excellent (userspace kernel syscall interception) | Medium/High | Medium |
| VMs (Firecracker/QEMU) | Excellent | High | Medium/High |
| Firecracker microVMs | Excellent, <125ms boot, <5MiB overhead | Medium | Medium/High |

**`@anthropic-ai/sandbox-runtime`** is Anthropic's own lightweight sandbox: no Docker required, uses OS primitives (`bubblewrap` on Linux, `sandbox-exec` on macOS) for filesystem restrictions, routes network via a built-in proxy. JSON-based config for allowed domains and paths.

**gVisor** — intercepts syscalls in userspace before they reach the host kernel. Excellent for multi-tenant environments or when processing untrusted content (reduces prompt injection → kernel exploit path). Configure via `docker run --runtime=runsc`.

**Firecracker** — sub-125ms VM boot, <5MiB overhead. Agent communicates via `vsock` to a host proxy. Suitable for ephemeral-per-task architectures at scale.

**Source:** `platform.claude.com/docs/en/agent-sdk/secure-deployment`

---

### 6. Process Management (Confidence: HIGH)

**For the surrounding orchestrator/host process (Node.js or Python), standard process managers are used:**
- **PM2** — most common for Node.js services. Provides restart-on-crash, log rotation, startup scripts, cluster mode. Generates systemd service configs via `pm2 startup`.
- **systemd** — standard for Linux production services; PM2 can generate systemd unit files.
- **Docker + orchestrators** — Docker Compose for single-host, Kubernetes/ECS/GKE for multi-host. Container restarts replace PM2 in containerized deployments.

**The `claude` subprocess itself is NOT managed by PM2 or systemd directly.** The subprocess is spawned and managed by the SDK (or by your application code calling `claude -p`). The SDK handles the subprocess lifecycle:
- Spawns on first `query()` call or `Session` creation
- Keeps alive between turns (streaming input mode)
- Terminates on `session.close()`, on 10-minute idle timeout, or on process error

**What this means for Harness:** PM2 or systemd manages the `apps/orchestrator` Node.js process. The SDK/invoker within that process manages the `claude` subprocess pool. This is already the pattern Harness uses.

**Source:** npm `pm2` documentation; prior AI_RESEARCH cold start research; Anthropic hosting guide FAQ

---

### 7. Open-Source Projects Using the SDK in Production (Confidence: MEDIUM)

**Official Anthropic demos (explicitly NOT for production):**
- `github.com/anthropics/claude-agent-sdk-demos` — email assistant, research agent, hello world. README warns: "intended for local development only, should NOT be deployed to production or used at scale."

**Community/third-party projects with production intent:**
- `github.com/ComposioHQ/open-claude-cowork` — open-source Claude Cowork with 500+ SaaS integrations; full stack with frontend, Express backend, Claude + Opencode providers
- `github.com/wshobson/agents` — intelligent automation and multi-agent orchestration for Claude Code
- `github.com/shareAI-lab/learn-claude-code` — nano Claude Code-like agent harness built from scratch (educational)
- `github.com/Wally869/claude_agent_sdk_rust` — Rust SDK for Claude Code CLI ("production-ready AI agents with type safety")
- `github.com/severity1/claude-agent-sdk-go` — Go SDK for Claude Agent SDK integration
- A FastAPI service for concurrent Claude Agent session management with real-time monitoring, cost tracking, and session resumption via HTTP API (mentioned in search results, exact repo URL not captured)

**Production architectures documented in community:**
- AWS Lambda + ECS + EC2: Standard Python/Node.js apps using `CLAUDE_CODE_USE_BEDROCK=1` to route through AWS Bedrock instead of calling Anthropic directly
- Amazon Bedrock AgentCore: Managed infrastructure for agent deployment with memory persistence, identity integration, observability dashboards, and execution sandboxes. Accepts SDK-based agents directly.
- Modal Sandbox: Has a demo implementation for Claude + Slack integration

**Source:** `github.com/anthropics/claude-agent-sdk-demos`; `github.com/topics/claude-agent-sdk`; `buildwithaws.substack.com`; search results

---

### 8. Anthropic Blog Posts and Reference Architectures (Confidence: HIGH)

**Official Anthropic publications on production deployment:**
- `platform.claude.com/docs/en/agent-sdk/overview` — Agent SDK overview (canonical)
- `platform.claude.com/docs/en/agent-sdk/hosting` — production hosting guide (canonical)
- `platform.claude.com/docs/en/agent-sdk/secure-deployment` — security hardening guide (canonical)
- `www.anthropic.com/news/apple-xcode-claude-agent-sdk` — Apple Xcode integration announcement
- Anthropic engineering blog post on Claude Code sandboxing (referenced in secure deployment guide as `www.anthropic.com/engineering/claude-code-sandboxing`)

**Third-party production guides:**
- `buildwithaws.substack.com/p/inside-the-claude-agent-sdk-from` — deep dive on stdin/stdout protocol + AWS deployment
- `letsdatascience.com/blog/claude-agent-sdk-tutorial` — production agent tutorial
- `medium.com/@hugolu87/how-to-run-claude-agents-in-production-using-the-claude-sdk` (403 at time of research)
- `www.datacamp.com/tutorial/claude-code-docker` — Claude Code Docker tutorial

**Source:** Direct fetches of official documentation pages; search results

---

## Key Takeaways

1. **The SDK shells out to `claude` CLI** — it is a subprocess wrapper, not a direct API client. This means deploying it requires the `claude` binary installed in the container/environment.

2. **`claude -p` spawns a new process per call** with ~12s cold start. For production use, the SDK's session-persistence mode reduces this to ~2-3s for subsequent turns. See prior research `2026-02-24-claude-cli-streaming-cold-start.md` for the full architecture.

3. **Docker is officially supported and documented** with a hardened example configuration in the Anthropic secure deployment guide. The key pattern: `--network none` + Unix socket proxy for egress control.

4. **Four official deployment patterns:** ephemeral (one container per task), long-running (persistent container), hybrid (ephemeral with DB-backed state), single-container multi-process. Harness uses the long-running pattern with a session pool.

5. **PM2/systemd manage the host process, not the `claude` subprocess.** The SDK owns the subprocess lifecycle. This matches Harness's current architecture.

6. **No daemon mode exists for the CLI** — `claude -p` does not accept multiple prompts over stdin in a persistent way. The SDK is the only supported mechanism for multi-turn programmatic use.

7. **Session timeout: 10 minutes of inactivity** in streaming input mode. Any session pool needs to handle reconnection.

8. **Anthropic's official demo projects explicitly warn against production use.** Real production deployments are community-driven with only framework-level guidance from Anthropic.

9. **Harness's current architecture is correct** relative to Anthropic's patterns: long-running SDK sessions (session pool), subprocess-per-thread with 8-minute TTL (slightly less than the 10-minute SDK default), `os.tmpdir()` cwd, CLAUDECODE + ANTHROPIC_API_KEY stripped from env.

## Gaps Identified

- No official Anthropic documentation on session pool sizing or maximum concurrent subprocess counts before resource/rate-limit issues emerge.
- The V2 `Session` API (used by Harness) is still marked `unstable` in SDK docs; no official GA timeline found.
- No official SLA on cold start times — the ~12s number comes from a GitHub issue, not official docs.
- PM2-specific guidance for Claude Agent SDK services not found in official docs; only inferred from general Node.js deployment practices.
- AWS Bedrock AgentCore pricing and availability not researched.

## Sources

- [Agent SDK Overview — Anthropic Docs](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Hosting the Agent SDK — Anthropic Docs](https://platform.claude.com/docs/en/agent-sdk/hosting)
- [Secure Deployment — Anthropic Docs](https://platform.claude.com/docs/en/agent-sdk/secure-deployment)
- [Claude Agent SDK TypeScript CHANGELOG](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md)
- [GitHub issue #34: ~12s overhead per query()](https://github.com/anthropics/claude-agent-sdk-typescript/issues/34)
- [Inside the Claude Agent SDK: stdin/stdout communication](https://buildwithaws.substack.com/p/inside-the-claude-agent-sdk-from)
- [Claude Agent SDK: Subagents, Sessions, and Why It's Worth It](https://www.ksred.com/the-claude-agent-sdk-what-it-is-and-why-its-worth-understanding/)
- [claude-agent-sdk GitHub topics](https://github.com/topics/claude-agent-sdk)
- [ClaudeBox — Docker dev environment](https://github.com/RchGrav/claudebox)
- [Claude Code Docker — DataCamp Tutorial](https://www.datacamp.com/tutorial/claude-code-docker)
- [Docker Sandboxes — Docker Blog](https://www.docker.com/blog/docker-sandboxes-run-claude-code-and-other-coding-agents-unsupervised-but-safely/)
- [Run Claude Code with Docker — Docker Blog](https://www.docker.com/blog/run-claude-code-with-docker/)
- [Claude Code devcontainer docs](https://code.claude.com/docs/en/devcontainer)
- [anthropics/claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos)
- [ComposioHQ/open-claude-cowork](https://github.com/ComposioHQ/open-claude-cowork)
- Prior AI_RESEARCH: `2026-02-24-claude-cli-streaming-cold-start.md`
- Prior AI_RESEARCH: `2026-03-13-claude-agent-sdk-session-isolation.md`
