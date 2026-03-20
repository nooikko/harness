# Research: Claude Code CLI — Headless Authentication & Agent SDK Auth

Date: 2026-03-20

## Summary

Claude Code CLI supports fully non-interactive, headless authentication via environment variables. `ANTHROPIC_API_KEY` is the primary mechanism for daemon/service contexts. The `@anthropic-ai/claude-agent-sdk` works the same way — it spawns the Claude Code CLI binary as a subprocess and inherits environment variables (including `ANTHROPIC_API_KEY`) from the parent process. The Harness orchestrator explicitly strips `ANTHROPIC_API_KEY` from the subprocess env before spawning sessions — this is intentional to force interactive OAuth auth for the underlying Claude process.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-13-claude-agent-sdk-session-isolation.md`
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-02-claude-agent-sdk-structured-output.md`

## Current Findings

### Q1: How does `claude -p` authenticate?

**Confidence: HIGH**

`claude -p` (print/non-interactive mode) uses a 5-level authentication precedence chain, evaluated in this order:

1. **Cloud provider env vars** — `CLAUDE_CODE_USE_BEDROCK=1`, `CLAUDE_CODE_USE_VERTEX=1`, or `CLAUDE_CODE_USE_FOUNDRY=1` with respective cloud credentials
2. **`ANTHROPIC_AUTH_TOKEN`** — sent as `Authorization: Bearer` header (for LLM gateway/proxy routing)
3. **`ANTHROPIC_API_KEY`** — sent as `X-Api-Key` header. In non-interactive mode (`-p`), **always used when present** (no approval prompt)
4. **`apiKeyHelper` script** — shell script configured in settings that returns a dynamic/rotating API key
5. **OAuth subscription credentials** — from `/login` flow (Claude Pro/Max/Teams/Enterprise)

In `-p` mode specifically: `ANTHROPIC_API_KEY` is always used when present, without requiring user approval. This is different from interactive mode, which prompts once for approval.

Source: `https://code.claude.com/docs/en/authentication` (Authentication Precedence section)

---

### Q2: Where does Claude Code store credentials on disk?

**Confidence: HIGH**

| Platform | Location |
|----------|----------|
| macOS | Encrypted macOS Keychain |
| Linux | `~/.claude/.credentials.json` (mode 0600) |
| Windows | `~/.claude/.credentials.json` (inherits user profile ACLs) |
| Override | Set `$CLAUDE_CONFIG_DIR` to change the base directory |

The `~/.claude/.credentials.json` file contains OAuth tokens: access tokens, refresh tokens, expiration timestamps, and scopes.

The full `~/.claude/` directory structure also includes:
- `settings.local.json` — user preferences
- `projects/` — project history
- `todos/` — task management data
- `statsig/` — analytics/feature flags
- `package.json` — CLI dependencies

Source: `https://code.claude.com/docs/en/authentication` (Credential Management section)

---

### Q3: Can Claude Code authenticate non-interactively?

**Confidence: HIGH**

Yes — multiple mechanisms exist for non-interactive/headless operation:

**Primary method (direct API key):**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
claude -p "your prompt here"
```

**Bearer token method (for proxies/gateways):**
```bash
export ANTHROPIC_AUTH_TOKEN="your-bearer-token"
claude -p "your prompt here"
```

**Dynamic credential script:**
Configure `apiKeyHelper` in Claude Code settings to run a shell script that returns a fresh API key. Useful for Vault-based credential rotation. Refresh interval controlled by `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` env var.

**Cloud provider credentials:**
```bash
# AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

# Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID=...
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json

# Microsoft Foundry
export CLAUDE_CODE_USE_FOUNDRY=1
export ANTHROPIC_FOUNDRY_API_KEY=...
```

**Important caveat:** In interactive mode, using `ANTHROPIC_API_KEY` requires a one-time user approval. In `-p` (non-interactive) mode, the key is used automatically without approval.

Source: `https://code.claude.com/docs/en/authentication`

---

### Q4: `ANTHROPIC_API_KEY` env var — does Claude Code respect it?

**Confidence: HIGH**

Yes. `ANTHROPIC_API_KEY` is officially supported and documented as auth method #3 in the precedence chain.

Key behaviors:
- **Interactive mode**: Prompts user once to approve or decline the key. Choice is remembered. Can be toggled via "Use custom API key" in `/config`.
- **Non-interactive mode (`-p`)**: Key is always used without prompting.
- **Priority**: API key takes precedence over subscription OAuth. If you have an active Claude subscription AND `ANTHROPIC_API_KEY` set, the API key is used and you are billed at API rates (not subscription).
- **Conflict warning**: Claude Code notifies you if both subscription credentials and API key are active.
- **Diagnosis**: Run `/status` inside Claude Code to confirm which auth method is active.

Source: `https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code`

Additional env vars for headless operation:
- `ANTHROPIC_AUTH_TOKEN` — takes priority over `ANTHROPIC_API_KEY`; bearer token for proxy routing
- `CLAUDE_CODE_OAUTH_TOKEN` — pre-configured OAuth access token (skips browser flow)
- `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` — enables automatic token renewal (requires `CLAUDE_CODE_OAUTH_SCOPES`)
- `CLAUDE_CODE_SESSION_ACCESS_TOKEN` — session-scoped access token
- `CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_USER_EMAIL`, `CLAUDE_CODE_ORGANIZATION_UUID` — pre-configured account identifiers for headless operation

Source: Community-compiled env var reference gist

---

### Q5: What is `@anthropic-ai/claude-agent-sdk` and how does IT authenticate?

**Confidence: HIGH**

**Architecture:** The Claude Agent SDK (formerly Claude Code SDK) does NOT call the Anthropic API directly. It **spawns the Claude Code CLI binary as a subprocess** and communicates via JSON streaming. This is confirmed by:
- The `pathToClaudeCodeExecutable` option in `Options` type (line 219 of TypeScript API reference)
- The `spawnClaudeCodeProcess` option for custom subprocess spawning (VMs, containers, remote environments)
- Community reports of a "visible console window appearing when spawning Claude subprocess on Windows"

**Authentication:** Because the SDK spawns the CLI binary, authentication is identical to the CLI:
- Set `ANTHROPIC_API_KEY` in the environment before calling `query()`
- Or set `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK`, etc.
- The subprocess inherits environment variables from the parent process via the `env` option (defaults to `process.env`)

**Official documentation explicitly states:**
> "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Please use the API key authentication methods instead."

**TypeScript SDK `Options` type — auth-relevant fields:**
```typescript
env: Record<string, string | undefined>  // defaults to process.env — passed to subprocess
pathToClaudeCodeExecutable: string       // defaults to bundled binary
spawnClaudeCodeProcess: Function         // custom subprocess spawning
```

**Authentication methods for Agent SDK:**
- `ANTHROPIC_API_KEY` (primary for programmatic/service use)
- `CLAUDE_CODE_USE_BEDROCK=1` + AWS credentials
- `CLAUDE_CODE_USE_VERTEX=1` + GCP credentials
- `CLAUDE_CODE_USE_FOUNDRY=1` + Azure credentials

OAuth/claude.ai login is NOT supported for Agent SDK consumers.

Sources:
- `https://platform.claude.com/docs/en/agent-sdk/overview`
- `https://platform.claude.com/docs/en/agent-sdk/typescript` (Options type)
- `https://platform.claude.com/docs/en/agent-sdk/quickstart`

---

### Harness-Specific Finding: `ANTHROPIC_API_KEY` is Stripped from Subprocess Env

**Confidence: HIGH (from source code)**

In `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts`:

```typescript
const env: Record<string, string | undefined> = { ...process.env };
delete env.CLAUDECODE;
delete env.ANTHROPIC_API_KEY;  // <-- line 77
```

The orchestrator explicitly removes `ANTHROPIC_API_KEY` from the env before passing it to the Agent SDK `query()` call. This means the spawned Claude subprocess **cannot use API key auth**. It must authenticate via:
1. Interactive OAuth credentials from `~/.claude/.credentials.json` (the macOS Keychain or Linux file)
2. Or other env vars that are NOT stripped (e.g., `ANTHROPIC_AUTH_TOKEN`, cloud provider vars)

This is likely intentional — the orchestrator runs under the operator's interactive Claude login (Max subscription or Console account), and stripping the API key prevents accidental billing via pay-as-you-go when a dev environment has `ANTHROPIC_API_KEY` set in their shell.

---

## Key Takeaways

1. **For daemon/service use:** Set `ANTHROPIC_API_KEY` as an env var and use `claude -p`. The key is always used without interactive prompts in `-p` mode.

2. **Interactive mode behavior is asymmetric:** Interactive `claude` prompts once to approve `ANTHROPIC_API_KEY`; non-interactive `claude -p` uses it unconditionally. This is why Issue #27900 reports "Interactive Mode Ignores ANTHROPIC_API_KEY."

3. **Credential storage:** `~/.claude/.credentials.json` on Linux (mode 0600). macOS Keychain on macOS. Override with `$CLAUDE_CONFIG_DIR`.

4. **Agent SDK = CLI wrapper:** The npm package spawns the `claude` binary. Authentication is the same as the CLI. `ANTHROPIC_API_KEY` in the parent process env flows through to the subprocess unless explicitly deleted (as Harness does).

5. **Harness strips `ANTHROPIC_API_KEY`:** The orchestrator removes the API key from the subprocess env. The spawned Claude process authenticates via the operator's interactive login stored in `~/.claude/.credentials.json`. To run Harness as a daemon on a server, you'd need either: (a) pre-seeded OAuth credentials in `~/.claude/.credentials.json`, or (b) modify `create-session.ts` to NOT delete `ANTHROPIC_API_KEY`, or (c) use `ANTHROPIC_AUTH_TOKEN` instead (which is not currently stripped).

6. **OAuth in headless contexts:** Can be bootstrapped by: (a) SSH port forwarding to complete browser login on a remote machine, or (b) copying `~/.claude/.credentials.json` from an authenticated machine to the target server.

## Sources

- `https://code.claude.com/docs/en/authentication` — Official Claude Code authentication docs (credential management, precedence)
- `https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code` — Official help article on API key env vars
- `https://platform.claude.com/docs/en/agent-sdk/overview` — Agent SDK overview with authentication setup
- `https://platform.claude.com/docs/en/agent-sdk/typescript` — TypeScript SDK Options type (pathToClaudeCodeExecutable, env)
- `https://platform.claude.com/docs/en/agent-sdk/quickstart` — Agent SDK quickstart (ANTHROPIC_API_KEY setup)
- `https://github.com/anthropics/claude-code/issues/7100` — GitHub issue: headless/remote auth and CI/CD (closed NOT_PLANNED)
- `https://github.com/anthropics/claude-code/issues/29816` — GitHub issue: SSH sessions require re-login (macOS Keychain unavailable)
- `https://github.com/anthropics/claude-code/issues/27900` — GitHub issue: Interactive mode ignores ANTHROPIC_API_KEY
- Community env var reference gist: `https://gist.github.com/unkn0wncode/f87295d055dd0f0e8082358a0b5cc467`
- Promptfoo Claude Agent SDK docs: `https://www.promptfoo.dev/docs/providers/claude-agent-sdk/`
- Harness source: `/Users/quinn/dev/harness/apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts`
