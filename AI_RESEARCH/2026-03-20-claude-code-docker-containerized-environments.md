# Research: Claude Code in Docker and Containerized Environments
Date: 2026-03-20

## Summary

Claude Code can be installed and run inside Docker containers. The primary install path is `npm install -g @anthropic-ai/claude-code` on any Node.js 20+ base image (Debian-based only — Alpine/musl is unreliable). Authentication requires either an `ANTHROPIC_API_KEY` (for API access) or a combination of `CLAUDE_CODE_OAUTH_TOKEN` + a pre-seeded `~/.claude.json` file (for Pro/Max subscription access). The `-p` flag enables fully non-interactive/headless execution. Several known bugs affect the Agent SDK specifically (not the CLI) when spawning inside containers — the CLI itself works reliably.

## Prior Research

- `2026-02-22-claude-code-ecosystem-state.md` — general Claude Code ecosystem overview
- `2026-03-13-claude-agent-sdk-session-isolation.md` — SDK session isolation patterns

## Current Findings

---

### Q1: Can Claude Code be installed in a Docker container? What is the install process?

**Confidence: HIGH**

Yes. The official approach is a standard npm global install on top of a Node.js base image.

**Official Dockerfile** (`anthropics/claude-code/.devcontainer/Dockerfile`):
- Base image: `FROM node:20` (Node.js 20, Debian-based)
- Install command: `RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}`
- Default `CLAUDE_CODE_VERSION` build arg: `latest`
- Runs as the `node` user (non-root)
- NPM global prefix set to `/usr/local/share/npm-global` (writable by the `node` user)
- Additional packages: git, gh, zsh, fzf, nano, vim, jq, iproute2, iptables (for firewall init script)
- NET_ADMIN and NET_RAW capabilities required if running `init-firewall.sh`

**Key constraint on base image:** Use `node:20-slim` (Debian) or `node:20`. Do NOT use Alpine (`node:20-alpine`) — Alpine's musl libc causes compatibility issues with Claude Code's native dependencies.

**Minimum Node.js version for the CLI**: 22.x LTS (per SFEIR Institute's headless mode tutorial). The official Dockerfile uses `node:20` but the CLI documentation elsewhere specifies Node 22+. Treat Node 22 as the safe minimum for production use.

Source: https://github.com/anthropics/claude-code/blob/main/.devcontainer/Dockerfile

---

### Q2: How do you pass Claude Code authentication into a container?

**Confidence: HIGH**

Three supported methods, in official precedence order:

#### Method A: ANTHROPIC_API_KEY (simplest, most reliable for CI/automation)
```bash
docker run -e ANTHROPIC_API_KEY="sk-ant-..." my-claude-image claude -p "your prompt"
```
- Works in any non-interactive context
- No credential files needed
- Billed at pay-as-you-go API rates (not subscription)
- In non-interactive mode (`-p`), the key is always used when present — no approval prompt
- Source: https://code.claude.com/docs/en/authentication

#### Method B: CLAUDE_CODE_OAUTH_TOKEN (Pro/Max subscription users)
Generate a long-lived OAuth token on a machine with a browser:
```bash
claude setup-token
# Prints: export CLAUDE_CODE_OAUTH_TOKEN=<token>
```
Token is valid for 1 year.

Then in the container, you must set BOTH the token AND create a pre-seeded config file:
```bash
export CLAUDE_CODE_OAUTH_TOKEN=<your-token>
mkdir -p ~/.claude
echo '{"hasCompletedOnboarding": true}' > ~/.claude.json
```

**Critical bug (Issue #8938):** `CLAUDE_CODE_OAUTH_TOKEN` alone is not enough — Claude Code still launches the onboarding wizard unless `~/.claude.json` exists with `"hasCompletedOnboarding": true`. This is a known open bug. The workaround is to pre-seed the JSON file.

For a more complete `~/.claude.json` that also carries account identity:
```json
{
  "hasCompletedOnboarding": true,
  "lastOnboardingVersion": "2.1.29",
  "oauthAccount": {
    "accountUuid": "your-uuid",
    "emailAddress": "your@email.com",
    "organizationUuid": "your-org-uuid"
  }
}
```
These values can be extracted from `~/.claude.json` on any already-authenticated host machine.

Sources:
- https://github.com/anthropics/claude-code/issues/8938
- https://gist.github.com/coenjacobs/d37adc34149d8c30034cd1f20a89cce9

#### Method C: Volume-mount ~/.claude from host (interactive dev containers)
```bash
docker run \
  -v ~/.claude:/home/node/.claude \
  -v ~/.claude.json:/home/node/.claude.json \
  my-claude-image
```
**Warning (Issue #1736, #1414):** If you use Claude on both the host AND inside the container on macOS, the `.credentials.json` file gets deleted. Volume mounts must be read-write (not read-only). This method works reliably only when Claude is used exclusively in one environment.

The official `devcontainer.json` uses **named Docker volumes** instead of bind mounts to avoid this conflict:
```json
"mounts": [
  "source=claude-code-config-${devcontainerId},target=/home/node/.claude,type=volume"
]
```

Source: https://github.com/anthropics/claude-code/issues/1736

#### Credential storage paths (important for container setup)
- **macOS**: encrypted macOS Keychain (not accessible from containers)
- **Linux / containers**: `~/.claude/.credentials.json` (mode 0600)
- Configurable via `CLAUDE_CONFIG_DIR` environment variable

The official devcontainer sets: `"CLAUDE_CONFIG_DIR": "/home/node/.claude"`

---

### Q3: Official and community Docker images

**Confidence: HIGH (community); MEDIUM (official)**

**Anthropic-official artifacts:**
- Dockerfile: `anthropics/claude-code/.devcontainer/Dockerfile` on GitHub (not published to Docker Hub)
- Docker Hub base template: `docker/sandbox-templates:claude-code` (published by Docker Inc., used by Docker Sandboxes feature)
- No official Anthropic-published Docker Hub image exists

**Community Docker Hub images:**
| Image | Notes |
|-------|-------|
| `kasmweb/claude-code` | Ubuntu Jammy Desktop with browser-accessible desktop + Claude Code CLI |
| `gendosu/claude-code-docker` | General-purpose container for Claude Code |
| `atem55/claude-code-local` | Local model variant |
| `openkylin/claude-code` | Maintained by openKylin RISC-V SIG |
| `huangsen365/claude-code` | Community image |

**Community GitHub projects:**
- `RchGrav/claudebox` — "Ultimate Claude Code Docker Development Environment" with pre-configured dev profiles
- `tintinweb/claude-code-container` — runs in `--dangerously-skip-permissions` mode
- `VishalJ99/claude-docker` — full permissions + Twilio notifications
- `nezhar/claude-container` — credential isolation while maintaining persistent workspace
- `Zeeno-atl/claude-code` — containerized Claude Code (written by Claude Code itself)

**Docker Inc. blog coverage** (March 2026): Docker has published multiple official blog posts on running Claude Code with Docker Model Runner (local models), Docker Sandboxes (isolation), and MCP server integration.

Sources:
- https://www.docker.com/blog/run-claude-code-with-docker/
- https://www.docker.com/blog/docker-sandboxes-run-claude-code-and-other-coding-agents-unsupervised-but-safely/
- https://hub.docker.com/r/kasmweb/claude-code

---

### Q4: Filesystem requirements — does Claude Code need write access to specific paths?

**Confidence: HIGH**

Required writable paths:
- `~/.claude/` (or `$CLAUDE_CONFIG_DIR`) — stores `.credentials.json`, settings, session state
- `~/.claude.json` — top-level config file with onboarding state and account info
- `~/.local/share/claude` — some community guides reference this for data persistence
- Working directory (`cwd`) where Claude operates on code

The official devcontainer uses two named volumes:
```
/commandhistory  — bash history persistence (optional)
/home/node/.claude  — Claude config persistence (required for credential reuse)
```

`CLAUDE_CONFIG_DIR` environment variable overrides the default `~/.claude` path — useful for running as non-standard users in containers.

Read-only mounts of `~/.claude` do NOT work — Claude needs write access to update credentials and session state.

Source: https://code.claude.com/docs/en/authentication (Credential management section)

---

### Q5: PTY and interactive terminal requirements

**Confidence: HIGH**

Claude Code's interactive mode expects a TTY. Running without one (pipes, headless containers) triggers:

```
Error: stdin is not a TTY
```

**The fix:** Use the `-p` flag to force non-interactive/headless mode. This completely eliminates the TTY requirement:
```bash
claude -p "your prompt here"
```

The `-p` (print) flag is the official mechanism for all non-interactive use cases:
- CI/CD pipelines
- Docker container subprocess calls
- Cron jobs
- Script automation

**Additional flags for headless operation:**
- `--output-format text|json|stream-json` — structured output
- `--allowedTools "Read,Edit,Bash"` — avoid interactive tool approval prompts
- `--max-turns N` — limit agent iterations to prevent infinite loops

No PTY allocation (`-t` in `docker run`) is needed when using `-p`.

Source: https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/tutorial/

---

### Q6: Official guidance on CI/CD pipelines

**Confidence: HIGH**

Anthropic has official documentation for both GitHub Actions and GitLab CI/CD:

- `https://code.claude.com/docs/en/github-actions.md`
- `https://code.claude.com/docs/en/gitlab-ci-cd.md`
- `https://code.claude.com/docs/en/headless.md` — "Run Claude Code programmatically" (the CLI was previously called "headless mode")

**Official GitHub Action:** `anthropics/claude-code-action@v1`

Authentication for CI:
- `ANTHROPIC_API_KEY` — works for anyone with an API key (`sk-ant-...`)
- `CLAUDE_CODE_OAUTH_TOKEN` — works for Pro/Max subscribers (generate via `claude setup-token` locally)

**Key CI/CD patterns from official docs:**
```bash
# Basic headless execution
claude -p "Find and fix the bug in auth.py" --allowedTools "Read,Edit,Bash"

# Structured JSON output (parseable by jq)
claude -p "Summarize this project" --output-format json | jq -r '.result'

# Multi-turn sessions
SESSION=$(claude -p "Start review" --output-format json | jq -r '.session_id')
claude -p "Continue review" --resume "$SESSION"
```

**CI security recommendation (SFEIR Institute):** Always restrict tools to the minimum needed:
```bash
claude -p "Review for vulnerabilities" --allowedTools "Read,Grep,Glob"
```
Exclude the `Bash` tool in review pipelines to prevent uncontrolled execution.

**Docker daemon env var issue (Docker Sandboxes):**
> "Docker Sandboxes use a daemon process that doesn't inherit environment variables from your current shell session."
Add `ANTHROPIC_API_KEY` globally to `~/.bashrc` or `~/.zshrc` and restart Docker Desktop for the daemon to see it.

Source: https://docs.docker.com/ai/sandboxes/agents/claude-code/

**Issue #7100 — closed WITHOUT implementation:** A detailed issue requesting documentation for headless/remote authentication and CI/CD support was closed as NOT_PLANNED after 60 days of inactivity, despite 15+ upvotes and strong user demand. The gap in official CI authentication documentation remains partially unfilled.

---

### Q7: Known issues running as a non-interactive subprocess in headless environments

**Confidence: HIGH**

#### Issue A: "spawn node ENOENT" — Agent SDK only (CLI works fine)
**Severity: High | Status: Closed NOT_PLANNED**

The `@anthropic-ai/claude-code` Agent SDK fails with `spawn node ENOENT` when invoked inside Docker containers, despite:
- The CLI working correctly when invoked directly
- Node.js being properly installed and in PATH
- `pathToClaudeCodeExecutable` being explicitly set

Root cause: The SDK's internal spawn mechanism in `sdk.mjs` has PATH/environment inheritance issues in Docker. The `pathToClaudeCodeExecutable` option appears to be ignored in some code paths.

Workarounds (community-found, not official):
1. Explicitly pass PATH in env options:
   ```javascript
   const result = query({
     prompt: task,
     options: {
       env: {
         PATH: process.env.PATH,
         ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
       }
     }
   });
   ```
2. Set stdin to 'ignore' in spawn options
3. Use `permissionMode: 'default'` instead of `'bypassPermissions'` (the latter requires sudo in Docker)
4. Alpine images need `bash` explicitly: `RUN apk add bash`

Sources: https://github.com/anthropics/claude-code/issues/4383, https://github.com/anthropics/claude-code/issues/14464

#### Issue B: `CLAUDE_CODE_OAUTH_TOKEN` insufficient alone
As documented in Q2, setting only the OAuth token still triggers the onboarding wizard. Must also pre-seed `~/.claude.json` with `{"hasCompletedOnboarding": true}`.

Source: https://github.com/anthropics/claude-code/issues/8938

#### Issue C: Credential deletion when mixing host + container on macOS
If `~/.claude` is bind-mounted from a macOS host AND Claude Code is also used on the host, `.credentials.json` gets deleted. Use named Docker volumes instead of bind mounts to isolate credential stores per container.

Source: https://github.com/anthropics/claude-code/issues/1736

#### Issue D: bypassPermissions mode requires root/sudo in Docker
When using `--dangerously-skip-permissions` or `permissionMode: 'bypassPermissions'`, the process may require elevated privileges. Community solutions: run as root, or use `permissionMode: 'default'` with explicit `--allowedTools`.

#### Issue E: Chrome extension connectivity
The Claude browser extension cannot connect to Claude Code running inside a VS Code DevContainer (Issue #25506). Not relevant for server-side automation use cases.

---

### Authentication Precedence (complete order)

Per official docs at `https://code.claude.com/docs/en/authentication`:

1. Cloud provider env vars (`CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`)
2. `ANTHROPIC_AUTH_TOKEN` — Bearer token for LLM gateways/proxies
3. `ANTHROPIC_API_KEY` — Direct Anthropic API key
4. `apiKeyHelper` script — dynamic/rotating credentials from a vault
5. Subscription OAuth credentials (from `claude /login` browser flow)

`CLAUDE_CODE_OAUTH_TOKEN` is NOT in this official list — it appears to be a separate mechanism that triggers before the normal auth check, bypassing the browser OAuth flow.

---

## Key Takeaways

1. **Use `node:20-slim` or `node:20` as base image** — never Alpine. Install with `npm install -g @anthropic-ai/claude-code`.

2. **For CI/automation, use `ANTHROPIC_API_KEY`** — it is the most reliable, best-documented auth method for non-interactive containers. Set it as an environment variable; no files needed.

3. **For Pro/Max subscription auth in containers**, use `CLAUDE_CODE_OAUTH_TOKEN` + a pre-seeded `~/.claude.json` with `{"hasCompletedOnboarding": true}`. Generate the token once on a browser-enabled machine with `claude setup-token`.

4. **Always use `-p` flag** for non-interactive execution. This eliminates TTY requirements entirely. Without `-p`, Claude Code expects an interactive terminal and will fail in pipes/containers.

5. **The CLI works reliably in containers. The Agent SDK does not** (spawn ENOENT issue, closed NOT_PLANNED). For Harness's use case (spawning Claude Code as a subprocess via the Agent SDK), the ENOENT bug is directly relevant and the explicit `env: { PATH }` workaround should be applied.

6. **Credential files on Linux/containers** are at `~/.claude/.credentials.json` (mode 0600). Use `CLAUDE_CONFIG_DIR` to override this path. Named Docker volumes are safer than bind mounts for credential persistence.

7. **`bypassPermissions` mode may need root** in containers. Use `--allowedTools` with explicit tool lists as the preferred alternative.

8. **No official Anthropic Docker Hub image exists**. The official artifact is the `.devcontainer/Dockerfile` in the `anthropics/claude-code` GitHub repo.

## Gaps Identified

- No official documentation explicitly covers the `spawn node ENOENT` SDK bug or provides a blessed workaround.
- The `CLAUDE_CODE_OAUTH_TOKEN` + `~/.claude.json` pre-seeding requirement is undocumented officially — only found via GitHub issues.
- Issue #7100 requesting formal CI/CD and headless auth documentation was closed NOT_PLANNED. The official headless docs cover usage but not the credential-setup bootstrapping problem.
- No official guidance on minimum Node.js version for the CLI in containers (docs site says 22, official Dockerfile uses 20).

## Sources

- https://code.claude.com/docs/en/devcontainer — Official devcontainer documentation
- https://code.claude.com/docs/en/authentication — Official authentication documentation
- https://code.claude.com/docs/en/headless.md — Official programmatic/headless mode docs
- https://github.com/anthropics/claude-code/blob/main/.devcontainer/Dockerfile — Official Dockerfile
- https://github.com/anthropics/claude-code/blob/main/.devcontainer/devcontainer.json — Official devcontainer.json
- https://docs.docker.com/ai/sandboxes/agents/claude-code/ — Docker Sandboxes + Claude Code
- https://github.com/anthropics/claude-code/issues/1736 — Re-authentication in Docker (community workarounds)
- https://github.com/anthropics/claude-code/issues/4383 — spawn node ENOENT in Docker
- https://github.com/anthropics/claude-code/issues/14464 — pathToClaudeCodeExecutable in Docker
- https://github.com/anthropics/claude-code/issues/7100 — Headless/remote auth documentation request (closed NOT_PLANNED)
- https://github.com/anthropics/claude-code/issues/8938 — CLAUDE_CODE_OAUTH_TOKEN insufficient alone
- https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md — GitHub Actions auth setup
- https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/tutorial/ — Headless mode tutorial
- https://gist.github.com/coenjacobs/d37adc34149d8c30034cd1f20a89cce9 — Automating Claude Code on headless VPS
- https://hub.docker.com/r/kasmweb/claude-code — KasmWeb Docker Hub image
- https://www.docker.com/blog/run-claude-code-with-docker/ — Docker blog: Claude Code + Docker
- https://www.docker.com/blog/docker-sandboxes-run-claude-code-and-other-coding-agents-unsupervised-but-safely/ — Docker Sandboxes blog
