# Research: Claude CLI Streaming, Non-Interactive Modes, and Cold Start Elimination

Date: 2026-02-24

## Summary

The Claude CLI (`claude`) is a Node.js process that spawns fresh for every `claude -p` invocation. The ~3-5 second cold start observed in the harness orchestrator is the Node.js/CLI initialization overhead. There is no daemon mode, no persistent CLI process that accepts multiple prompts over stdin, and no way to keep a bare `claude -p` process warm for subsequent calls. However, there are two official paths to eliminate or dramatically reduce this overhead:

1. **`@anthropic-ai/claude-agent-sdk` in streaming input mode** — keeps a single subprocess alive for the entire session, reducing subsequent-message latency from ~12s to ~2-3s.
2. **`unstable_v2_createSession()`** — a cleaner multi-turn API (unstable preview) that wraps the same subprocess-persistence mechanism.

Note: The SDK still spawns a subprocess (the `claude` binary). It is not a direct in-process call to the Anthropic API. The subprocess stays alive between turns when using streaming input mode.

---

## Prior Research

None — this is the first research document on this topic.

---

## Current Findings

### 1. CLI Flags Reference (Confidence: HIGH)

Source: https://code.claude.com/docs/en/cli-reference

The complete set of flags relevant to performance and session management:

| Flag | What it does |
|------|-------------|
| `-p` / `--print` | Non-interactive mode: run prompt, print result, exit. This is the harness's current approach. |
| `--output-format` | `text` (default), `json`, or `stream-json`. The harness uses `json`. |
| `--output-format stream-json` | Emits newline-delimited JSON events as they arrive. Requires `--print` mode. |
| `--include-partial-messages` | Include streaming token-level events. Requires `--print` AND `--output-format stream-json`. |
| `--continue` / `-c` | Load the most recent conversation in the current directory (not a performance optimization — loads session file from disk). |
| `--resume` / `-r` | Resume a specific session by ID or name (loads from disk; file size grows with context, adding ~2-3s for large sessions). |
| `--no-session-persistence` | Skip saving session to disk (print mode only, slightly faster per invocation). |
| `--input-format` | `text` or `stream-json` — used when piping stream-json output between chained claude processes. |
| `--session-id` | Use a specific UUID for the session. |
| `--fork-session` | When resuming, create a new session instead of reusing the original. |

**No daemon mode, no server mode, no REPL mode that accepts multiple prompts via stdin.** The `claude` command without `-p` starts an interactive TUI REPL (terminal UI) that cannot be controlled programmatically via stdin in any reliable way. Issue #6009 on the claude-code GitHub repo explicitly requests this as a feature that does not yet exist.

**`claude remote-control`** — This starts a Remote Control session to control Claude Code from Claude.ai or the Claude app while running locally. It is for human-in-the-loop remote access, not programmatic automation.

**`claude mcp`** — Configures MCP server connections. Not an API proxy or daemon mode.

### 2. `--output-format stream-json` (Confidence: HIGH)

Source: https://code.claude.com/docs/en/headless and CLI reference

`--output-format stream-json` combined with `--include-partial-messages` streams newline-delimited JSON events as the model generates tokens. Each event is a JSON object on its own line (NDJSON format). This eliminates waiting for the full response before receiving any output, enabling real-time token streaming to clients.

Example:
```bash
claude -p "Write a haiku" \
  --output-format stream-json \
  --include-partial-messages \
  --verbose
```

To extract just the text tokens:
```bash
claude -p "Write a poem" \
  --output-format stream-json \
  --verbose \
  --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

**Key limitation**: `--output-format stream-json` does NOT reduce cold start. The process still spawns fresh for each invocation. It only allows consuming output incrementally rather than waiting for the process to exit.

### 3. `--continue` and `--resume` Flags (Confidence: HIGH)

Source: https://code.claude.com/docs/en/cli-reference and community docs

`--continue` (`-c`) loads the most recent conversation from the current directory. `--resume` (`-r`) loads a specific session by ID or name.

**Performance impact**: These flags do NOT reduce subprocess cold start. They affect what context is loaded into the prompt, not how the process initializes. A 90% full context (~180K tokens) results in ~3-5 MB session files, which adds ~2-3 seconds of file I/O on top of the existing cold start. For sessions with small context, the overhead is negligible.

**What they are useful for**: Maintaining conversation continuity across separate invocations — the model remembers prior messages. This is the harness's current approach via the `sessionId` option passed to `--resume`.

### 4. Interactive/Persistent REPL Mode (Confidence: HIGH)

Source: GitHub Issues #6009 and #12507 on anthropics/claude-code

There is **no documented way** to pipe multiple prompts to a single long-running `claude` process via stdin. Running `claude` without `-p` starts a TUI (terminal user interface) REPL that uses raw terminal mode, which is incompatible with stdin piping. Attempts to pipe to it result in the process detecting a non-TTY stdin and either exiting immediately or behaving unpredictably.

Feature request #6009 explicitly asks for a mode where `cat file.txt | claude` (without `-p`) pre-populates an interactive session — this was requested and not implemented as of this research date.

**There is no daemon mode, socket mode, or long-polling mode for the CLI.**

### 5. `@anthropic-ai/claude-agent-sdk` — The Official Programmatic API (Confidence: HIGH)

Source: https://platform.claude.com/docs/en/agent-sdk/overview and https://platform.claude.com/docs/en/agent-sdk/typescript

The **Claude Code SDK was renamed to Claude Agent SDK** in late 2025. The npm package is now `@anthropic-ai/claude-agent-sdk`. The old `@anthropic-ai/claude-code` package at npm is the CLI binary itself, not a programmatic SDK.

**Critical architecture note**: The Agent SDK still spawns the `claude` binary as a subprocess. It is NOT a direct in-process call to the Anthropic API. The SDK communicates with the subprocess over IPC (stdin/stdout), abstracting the protocol. This means:

- There IS still a subprocess
- The subprocess CAN be kept alive across multiple turns in streaming input mode
- The cold start is still incurred on the first query, but NOT on subsequent queries within the same session

**Installation:**
```bash
npm install @anthropic-ai/claude-agent-sdk
```

**Primary function — `query()`:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  if (message.type === "result") console.log(message.result);
}
```

The `query()` function returns an async generator that streams `SDKMessage` objects.

**Subprocess reuse with streaming input mode:**

When `prompt` is an `AsyncIterable<SDKUserMessage>` (rather than a plain string), the SDK keeps the subprocess alive and accepts multiple messages through the generator. This is called "streaming input mode" and is the recommended approach for multi-turn sessions.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function* generateMessages() {
  yield { type: "user", message: { role: "user", content: "First message" } };
  // The process stays alive. Yield more messages over time:
  await someCondition();
  yield { type: "user", message: { role: "user", content: "Follow-up message" } };
}

for await (const message of query({
  prompt: generateMessages(),  // AsyncIterable keeps process alive
  options: { allowedTools: ["Read", "Grep"] }
})) {
  console.log(message);
}
```

**Session resume via SDK:**
```typescript
let sessionId: string | undefined;

// First query — incurs cold start
for await (const msg of query({ prompt: "Read the auth module", options: { allowedTools: ["Read"] } })) {
  if (msg.type === "system" && msg.subtype === "init") sessionId = msg.session_id;
}

// Second query — new subprocess spawn, BUT with prior context loaded
for await (const msg of query({
  prompt: "Now find all callers",
  options: { resume: sessionId }
})) { ... }
```

**Note**: `resume` in the SDK spawns a NEW subprocess with the prior session loaded from disk. It does NOT reuse the old process. The cold start is still incurred.

### 6. Performance Numbers (Confidence: HIGH — from official GitHub response)

Source: https://github.com/anthropics/claude-agent-sdk-typescript/issues/34

**Anthropic's own collaborator confirmed these numbers:**

| Mode | Latency |
|------|---------|
| Old Claude Code SDK (pre-rename) | ~40-44s per query |
| Agent SDK, `query()` with string prompt | ~12s per query (fresh subprocess each call) |
| Agent SDK, streaming input mode (subsequent messages) | ~2-3s (subprocess stays alive) |
| Agent SDK, streaming input mode (first message) | ~12s (initial subprocess cold start) |

The Anthropic collaborator's exact statement on issue #34:
> "This is expected behavior when passing a string prompt. We recommend using streaming input to keep the process alive between turns."

**Sessions expire after 10 minutes of inactivity** in streaming input mode.

### 7. `unstable_v2_createSession()` — V2 Preview API (Confidence: MEDIUM)

Source: https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview

A simplified multi-turn API that wraps the same subprocess persistence mechanism as streaming input mode but with a cleaner interface:

```typescript
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

await using session = unstable_v2_createSession({ model: "claude-opus-4-6" });

// First turn — ~12s cold start
await session.send("What files are in this directory?");
for await (const msg of session.stream()) {
  if (msg.type === "assistant") console.log(/* text */);
}

// Second turn — ~2-3s (same subprocess)
await session.send("Now summarize the main entry point");
for await (const msg of session.stream()) { ... }

// Session auto-closes via `await using`
```

**Status**: Marked `unstable` — APIs may change. Not all V1 features are available (e.g., session forking). Suitable for experimentation but not production-critical paths until stabilized.

### 8. `createSdkMcpServer()` — In-Process MCP Servers (Confidence: HIGH)

Source: https://platform.claude.com/docs/en/agent-sdk/typescript

This function creates an MCP server that runs in the same Node.js process as the SDK consumer — no separate subprocess for the MCP server itself. However, the Claude agent subprocess is still separate.

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const myServer = createSdkMcpServer({
  name: "my-tools",
  tools: [
    tool("get_data", "Fetches data", { id: z.string() }, async ({ id }) => ({
      content: [{ type: "text", text: `Data for ${id}` }]
    }))
  ]
});

for await (const msg of query({
  prompt: "Use the get_data tool",
  options: {
    mcpServers: { "my-tools": myServer }  // type: "sdk" — runs in-process
  }
})) { ... }
```

This eliminates subprocess overhead for tool execution within the agent loop. The Claude subprocess itself still spawns and manages the agent loop.

### 9. `spawnClaudeCodeProcess` Option (Confidence: MEDIUM — undocumented)

Source: https://github.com/anthropics/claude-agent-sdk-typescript/issues/103

An undocumented escape hatch exists in the SDK types (`Options.spawnClaudeCodeProcess`) that allows providing a custom subprocess spawn function. This was added to support Windows `windowsHide: true` behavior. It could theoretically be used to provide a custom process factory, but there is no documented API for process pooling or reuse via this mechanism.

### 10. CLAUDECODE Environment Variable (Confidence: HIGH)

Source: https://github.com/anthropics/claude-agent-sdk-python/issues/573 and the harness invoker source

The `CLAUDECODE=1` environment variable is set by the Claude CLI when running as an interactive session. If this variable is present in the child process environment, a spawned CLI subprocess will detect it and refuse to start (guarding against nested Claude sessions).

The harness's current invoker at `/mnt/ramdisk/harness/apps/orchestrator/src/invoker/index.ts` already handles this correctly:
```typescript
delete env.CLAUDECODE;
delete env.ANTHROPIC_API_KEY;
```

The Agent SDK's `Options.env` property can be used to pass a custom environment to the subprocess, similarly stripping this variable.

---

## Key Takeaways

1. **The ~3-5s cold start in the harness is real and structural** — it is the Node.js process initialization + `claude` CLI startup time. There is no way to eliminate it for a fresh `claude -p` invocation.

2. **The only official way to eliminate per-message cold start is to keep one subprocess alive** using the `@anthropic-ai/claude-agent-sdk` in streaming input mode (or the V2 `createSession()` API). This reduces subsequent-message latency from ~12s to ~2-3s.

3. **`--output-format stream-json` does not reduce cold start** — it only changes how output is delivered (incrementally vs all-at-once). The process still exits after each invocation.

4. **`--continue` and `--resume` do not reduce cold start** — they load session history from disk, which is a separate concern from process initialization overhead.

5. **There is no daemon/server/REPL mode** for the Claude CLI that accepts programmatic stdin input across multiple invocations.

6. **The Agent SDK is the right tool for warm sessions** — it wraps the CLI subprocess and keeps it alive between turns in streaming input mode, with official Anthropic support.

7. **Session expiry**: Streaming input mode sessions expire after 10 minutes of inactivity. Any architecture using warm sessions needs to handle reconnection on expiry.

8. **The V2 `unstable_v2_createSession()` API** is the cleanest interface for the harness use case (multi-turn sessions) but is unstable. V1 streaming input mode via `query({ prompt: asyncIterable })` is stable.

9. **`@anthropic-ai/claude-code`** (the old npm package name) is the CLI binary itself — not a programmatic SDK. The programmatic SDK is `@anthropic-ai/claude-agent-sdk`.

10. **The ANTHROPIC_API_KEY and CLAUDECODE env var stripping** that the harness already does is also required by the Agent SDK when used inside a Claude Code session (hooks/plugins).

---

## Recommended Architecture for Cold Start Elimination

To eliminate the per-message cold start in the harness orchestrator, the invoker should be migrated from spawning `claude -p` per message to using the Agent SDK in streaming input mode with a session pool:

**High-level pattern:**
- Maintain a pool of `query()` sessions (one per thread or a shared pool)
- Each session is an async generator fed by a message queue
- Thread messages are enqueued into the generator; responses are dequeued from the async iterator
- Sessions expire after ~10 minutes of inactivity (as per SDK behavior)
- On session expiry or error, spawn a new one (accepting the ~12s cold start once)

**Package to add:**
```bash
pnpm --filter orchestrator add @anthropic-ai/claude-agent-sdk
```

**Alternative (simpler but less warm):** Use `--continue` with a rapidly-recycled subprocess — a new process is spawned per message but loads existing session context. This does not eliminate cold start but preserves conversation continuity. The harness already does this via `--resume`.

---

## Gaps Identified

- No official documentation on exactly how long session warm-up takes on the harness's hardware (the ~12s number is from a third-party GitHub issue, confirmed by Anthropic collaborator but not an official SLA).
- No documentation on whether the Agent SDK subprocess reuse works correctly when `CLAUDECODE` and `ANTHROPIC_API_KEY` are stripped from the environment (the harness requires these to be absent for nested spawning to work).
- The `unstable_v2_createSession()` API does not document its session timeout behavior explicitly (inferred from issue #34 that it is ~10 minutes, matching the streaming input mode behavior).
- No documentation on process pool limits — whether spawning many concurrent `query()` sessions causes rate limiting or resource exhaustion.

---

## Sources

- [CLI Reference — Claude Code Docs](https://code.claude.com/docs/en/cli-reference)
- [Run Claude Code Programmatically — Claude Code Docs (headless)](https://code.claude.com/docs/en/headless)
- [Agent SDK Overview — Anthropic](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Streaming Input vs Single Mode — Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [TypeScript V2 Preview — Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)
- [GitHub Issue #34: ~12s overhead, Anthropic response on streaming input mode](https://github.com/anthropics/claude-agent-sdk-typescript/issues/34)
- [GitHub Issue #103: spawnClaudeCodeProcess, windowsHide](https://github.com/anthropics/claude-agent-sdk-typescript/issues/103)
- [GitHub Issue #573: CLAUDECODE env var in SDK subprocesses](https://github.com/anthropics/claude-agent-sdk-python/issues/573)
- [GitHub Issue #6009: Feature request — stdin piping to interactive mode](https://github.com/anthropics/claude-code/issues/6009)
- [GitHub Issue #12507: HPC interactive session stdin consumed by shell detection](https://github.com/anthropics/claude-code/issues/12507)
- [@anthropic-ai/claude-agent-sdk on npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- [ClaudeLog — What is --output-format](https://claudelog.com/faqs/what-is-output-format-in-claude-code/)
- [Stream-JSON Chaining — ruvnet/claude-flow Wiki](https://github.com/ruvnet/claude-flow/wiki/Stream-Chaining)
