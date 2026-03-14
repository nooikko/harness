# Research: Claude Agent SDK Session Isolation and Filesystem Access

Date: 2026-03-13

## Summary

Claude Agent SDK sessions (`@anthropic-ai/claude-agent-sdk`) run with unrestricted filesystem access by default. Harness uses `permissionMode: 'bypassPermissions'` + `cwd: os.tmpdir()` — a combination that grants agents full read/write access to the entire filesystem with no built-in isolation. The `cwd` change to `/tmp` prevents auto-loading project config files but does not restrict what paths the agent can access. The sandbox option (`sandbox.filesystem`) only enforces restrictions on Bash-spawned processes, not on Write/Edit tool handlers (a known bug, closed as duplicate). `disallowedTools` is the only SDK mechanism that reliably blocks specific tools in `bypassPermissions` mode.

## Prior Research

None found in AI_RESEARCH/ on this specific topic. Related: `2026-03-01-agent-workspace-isolation-research.md`, `2026-03-01-git-worktree-agent-isolation.md`.

## Current Findings

### 1. Default Filesystem Access

By default (no options set), a Claude Agent SDK session:
- Has full OS-level filesystem access via built-in tools: Read, Write, Edit, Bash, Glob, Grep
- The `cwd` defaults to `process.cwd()` — the calling process's working directory
- There is NO built-in path restriction on the Read tool — it accepts any absolute path
- The `additionalDirectories` option ADDS directories Claude can access (expanding scope), does not restrict
- The built-in tools list (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, etc.) is always available unless explicitly blocked with `disallowedTools`

### 2. Permission Modes

```typescript
type PermissionMode =
  | "default"          // No auto-approvals; unmatched tools call canUseTool callback
  | "dontAsk"          // Deny anything not pre-approved by allowedTools (TypeScript only)
  | "acceptEdits"      // Auto-approve file edits and filesystem ops (mkdir, rm, mv, cp)
  | "bypassPermissions" // Bypass ALL permission checks — full autonomous access
  | "plan";            // No tool execution; planning only
```

**Key behaviors:**
- `default`: Requires `canUseTool` callback to approve tools — if no callback, tools are blocked
- `bypassPermissions`: Every tool runs without any approval. ANTHROPIC_WARNING: "Use with extreme caution. Claude has full system access in this mode."
- `dontAsk`: Tools NOT in `allowedTools` are denied (hardest lockdown for headless agents)

### 3. allowedTools vs disallowedTools Behavior

Official documentation (HIGH confidence):

> "`allowed_tools` does not constrain `bypassPermissions`. `allowed_tools` only pre-approves the tools you list. Unlisted tools are not matched by any allow rule and fall through to the permission mode, where `bypassPermissions` approves them. Setting `allowed_tools=["Read"]` alongside `permission_mode="bypassPermissions"` still approves every tool, including `Bash`, `Write`, and `Edit`."

Permission evaluation order:
1. Hooks (can allow, deny, or continue)
2. `disallowedTools` deny rules — checked FIRST, override everything including `bypassPermissions`
3. Permission mode (`bypassPermissions` approves everything reaching this step)
4. `allowedTools` allow rules
5. `canUseTool` callback (skipped in `dontAsk` mode)

**`disallowedTools` is the only reliable way to block specific tools when using `bypassPermissions`.**

### 4. Sandbox Mode

```typescript
type SandboxSettings = {
  enabled?: boolean;                    // false by default
  autoAllowBashIfSandboxed?: boolean;   // true by default
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;   // true by default
  network?: SandboxNetworkConfig;
  filesystem?: SandboxFilesystemConfig;
  ignoreViolations?: Record<string, string[]>;
  enableWeakerNestedSandbox?: boolean;
  ripgrep?: { command: string; args?: string[] };
};

type SandboxFilesystemConfig = {
  allowWrite?: string[];   // paths to allow writing
  denyWrite?: string[];    // paths to deny writing
  denyRead?: string[];     // paths to deny reading
};
```

**CRITICAL BUG (GitHub issue #29048, closed as duplicate):**
- `sandbox.filesystem.allowWrite` restrictions ONLY apply to Bash (via bubblewrap/bwrap OS isolation)
- Write/Edit tools execute `fs.writeFileSync()` in-process — NOT wrapped by bwrap
- Result: **In `bypassPermissions` mode, agents can use Write/Edit tools to write ANY path regardless of sandbox.filesystem configuration**
- Bash commands ARE restricted by sandbox (OS-level), but Write/Edit tool calls bypass it entirely

**Also critical:**
- `bypassPermissions` + `allowUnsandboxedCommands: true` (the default) = agent can silently escape Bash sandbox by setting `dangerouslyDisableSandbox: true` in the tool input

### 5. MCP Tool Injection

When custom MCP servers are added via `mcpServers`, they are ADDITIVE — Claude still has full access to all built-in tools (Read, Write, Edit, Bash, etc.) PLUS the MCP tools. MCP tools do NOT replace built-in tools.

MCP tools are namespaced as `serverName__toolName` to avoid collisions.

### 6. Subagent Permission Inheritance

Official documentation warning:
> "When using `bypassPermissions`, all subagents inherit this mode and it cannot be overridden. Subagents may have different system prompts and less constrained behavior than your main agent."

A GitHub feature request (#20264) to allow restricting subagent permissions independently of the parent was **closed as NOT PLANNED** by Anthropic (February 2026).

This means: if Harness's main session uses `bypassPermissions`, any subagent Claude spawns via the Agent tool also gets `bypassPermissions` with no way to restrict it.

### 7. settingSources and CLAUDE.md Loading

By default (when `settingSources` is omitted), the SDK loads NO filesystem settings. This means:
- No `.claude/settings.json` permission rules are applied
- No CLAUDE.md files are auto-loaded
- Complete isolation from project-level Claude configuration

Harness correctly exploits this by NOT setting `settingSources`, plus explicitly setting `cwd: os.tmpdir()`.

## What Harness Currently Configures

File: `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts`

```typescript
const q = query({
  prompt: messageStream(),
  options: {
    model,
    cwd: os.tmpdir(),                     // Prevents CLAUDE.md/rules auto-load
    permissionMode: 'bypassPermissions',   // Full autonomous access, no prompts
    allowDangerouslySkipPermissions: true, // Required companion to bypassPermissions
    env,                                   // Strips CLAUDECODE and ANTHROPIC_API_KEY
    ...(config?.mcpServerFactory ? { mcpServers: config.mcpServerFactory() } : {}),
  },
});
```

**What this does:**
- `cwd: os.tmpdir()`: Sets `/tmp` (or OS equiv) as working directory. ONLY prevents auto-loading of CLAUDE.md and .claude/rules/ from the harness project root. Does NOT restrict what paths the agent can read/write — the agent can trivially `Read('/Users/quinn/dev/harness/.env')` or any other absolute path.
- `permissionMode: 'bypassPermissions'`: All built-in tools (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch) run without any approval. No `canUseTool` callback exists to catch anything.
- `allowDangerouslySkipPermissions: true`: Required companion flag for `bypassPermissions`.
- `env`: Strips `CLAUDECODE` (prevents Claude from thinking it's running interactively) and `ANTHROPIC_API_KEY` (prevents sub-agents from making independent API calls). Other env vars (DATABASE_URL, etc.) from `process.env` are inherited.
- No `disallowedTools`: Nothing is explicitly blocked.
- No `sandbox`: Sandbox is disabled (default `false`).
- No `settingSources`: No filesystem config loaded (correct — this is intentional isolation from harness project settings).

**NOT configured:**
- No `disallowedTools` — no tools are blocked
- No `sandbox` — no OS-level restrictions
- No `allowedTools` — doesn't matter with `bypassPermissions` anyway
- No `canUseTool` — no runtime approval callback

## Risk Assessment

### What agents CAN do by default

With the current Harness configuration, a Claude session can:

1. **Read any file on the filesystem** — `.env` files, SSH keys (`~/.ssh/id_rsa`), secrets, other projects' source code, system files. The Read tool accepts any absolute path with no restriction.
2. **Write to any path** — can create/overwrite files anywhere the OS user has write access. This includes the harness source tree itself, other projects, home directory files.
3. **Execute arbitrary bash commands** — full shell access. Can run `curl`, `wget`, `git`, database clients, etc.
4. **Read environment variables** — via `Bash(command: 'env')`. While `ANTHROPIC_API_KEY` is stripped, `DATABASE_URL` and other secrets in `process.env` are present in the inherited env.
5. **Access the network** — WebSearch, WebFetch, and Bash with network tools are all available.
6. **Spawn subprocesses** — via Bash, which inherit the full env including DB credentials.

### Concrete attack scenarios

- **Cross-agent data leak**: Agent A's session (thread X) can `Read('/tmp/claude-sessions/thread-Y-session.json')` if another session wrote state there. Sessions are stored under the OS temp dir which is the agent's cwd.
- **Secret exfiltration**: Agent reads `~/dev/harness/packages/database/.env` (contains DATABASE_URL), `~/.env`, or any secrets file on disk.
- **Database access via env**: `process.env.DATABASE_URL` is available inside Bash commands — an agent can run `psql "$DATABASE_URL"` and query or modify the entire database.
- **Harness source modification**: Agent can write to `~/dev/harness/apps/orchestrator/src/` — modifying the orchestrator itself.
- **Inter-session pollution via /tmp**: `cwd: os.tmpdir()` means all sessions share the same working directory. A malicious or confused agent writing to relative paths lands in `/tmp`, potentially visible to other sessions.

### Severity by scenario

| Scenario | Severity | Likelihood |
|----------|----------|------------|
| Agent reads .env / secrets | HIGH | MEDIUM (requires prompt injection or confused agent) |
| Agent reads another project's source | HIGH | LOW (requires deliberate adversarial behavior) |
| DATABASE_URL accessible in shell | HIGH | MEDIUM (env is inherited) |
| Cross-session /tmp pollution | MEDIUM | LOW (agents would need to know file paths) |
| Agent modifies harness source | HIGH | LOW (agent has no reason to do this normally) |

### Current mitigations

1. `ANTHROPIC_API_KEY` is stripped — sub-agents can't make independent API calls
2. `CLAUDECODE` is stripped — prevents Claude from thinking it's in interactive mode
3. `cwd: os.tmpdir()` — prevents CLAUDE.md and `.claude/rules/` from being auto-loaded by the subprocess
4. `settingSources` omitted — no filesystem config loaded at all
5. Context plugin delivers context programmatically rather than via filesystem — agents don't need to look at the harness tree

**These mitigations are good for preventing config pollution but do NOT prevent filesystem read/write access.**

## Restriction Options Available

### Option A: disallowedTools (Recommended for quick wins)

Block specific dangerous tools while keeping others available:

```typescript
options: {
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
  disallowedTools: ['Bash'],  // Removes shell access; Write/Edit still work
  cwd: os.tmpdir(),
}
```

Or for read-only agents:
```typescript
disallowedTools: ['Write', 'Edit', 'Bash', 'NotebookEdit']
```

`disallowedTools` is evaluated BEFORE `bypassPermissions` and cannot be overridden.

### Option B: permissionMode: 'dontAsk' + allowedTools (Tightest lockdown)

```typescript
options: {
  permissionMode: 'dontAsk',  // Deny anything not in allowedTools
  allowedTools: ['Read', 'Glob', 'Grep'],  // Only these tools work
  cwd: os.tmpdir(),
  // No allowDangerouslySkipPermissions needed
}
```

This is the safest option for read-heavy agents. Loses `bypassPermissions` behavior but gains hard denies for all unlisted tools.

### Option C: hooks for path-level enforcement

```typescript
options: {
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
  hooks: {
    PreToolUse: [{
      hooks: [async (input) => {
        const toolInput = (input as any).tool_input;
        if (['Read', 'Write', 'Edit'].includes((input as any).tool_name)) {
          const path = toolInput?.file_path ?? toolInput?.path;
          if (path && !path.startsWith('/tmp') && !path.startsWith('/allowed/dir')) {
            return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Path outside allowed directories' } };
          }
        }
        return {};
      }]
    }]
  },
}
```

Hooks fire even in `bypassPermissions` mode. This enables path-level enforcement. Note: hook callbacks are TypeScript closures running in the host process, not in the subprocess.

### Option D: sandbox (Limited, buggy)

Available but has the known bug: `sandbox.filesystem` only applies to Bash, not Write/Edit. Would need to combine with `disallowedTools: ['Write', 'Edit']` to be meaningful. Not recommended as primary isolation mechanism.

## Key Takeaways

1. **`cwd: os.tmpdir()` is not a security boundary** — it only prevents CLAUDE.md auto-loading. Agents can read/write any absolute path regardless of cwd.

2. **`bypassPermissions` is genuinely dangerous** — Anthropic's own docs say "Use with extreme caution." Every built-in tool runs without approval.

3. **`disallowedTools` is the only reliable block** — it's evaluated before `bypassPermissions` and cannot be overridden. This is the correct primitive for limiting tool access.

4. **`sandbox.filesystem` is broken with `bypassPermissions`** — documented open bug. Write/Edit tools bypass bwrap OS sandboxing entirely.

5. **`DATABASE_URL` in env is a significant risk** — `process.env` (minus stripped keys) is inherited by the subprocess. Agents running Bash have full DB access.

6. **All sessions share `/tmp` as cwd** — no per-session or per-thread isolation within the temp directory.

7. **Subagent permission inheritance is a known limitation** — Anthropic closed the feature request to fix it.

## Sources

- [Official permissions documentation](https://platform.claude.com/docs/en/agent-sdk/permissions) — HIGH confidence
- [Official TypeScript SDK reference](https://platform.claude.com/docs/en/agent-sdk/typescript) — HIGH confidence
- [Official Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — HIGH confidence
- [GitHub issue #29048: sandbox.filesystem.allowWrite not enforced for Write/Edit tools](https://github.com/anthropics/claude-code/issues/29048) — HIGH confidence
- [GitHub issue #20264: Allow restrictive permission modes for subagents](https://github.com/anthropics/claude-code/issues/20264) — HIGH confidence, closed NOT PLANNED 2026-02-28
- Harness source: `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts` — direct inspection
