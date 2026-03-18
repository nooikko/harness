# Research: Claude Code Hooks — Complete Reference for Documentation Automation
Date: 2026-03-17

## Summary

Claude Code hooks are user-defined automation points that fire at specific lifecycle events. They support four handler types: command (shell), HTTP, prompt (single-turn LLM), and agent (subagent with full tool access). Hooks can block actions (PreToolUse, Stop, etc.), inject context, trigger additional Claude work via the Stop hook returning `ok: false`, or observe events passively.

**Documentation automation** is achievable via PostToolUse command hooks that detect file edits and run scripts, or via agent hooks on Stop that spawn a subagent to read changed files and update docs. No first-party Anthropic examples exist specifically for doc automation — but the Stop+agent-hook pattern is the recommended mechanism.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-02-26-claude-code-context-files-reference.md`
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-12-everything-claude-code-analysis.md`

## Current Findings

### 1. Hook Types (All 4)

| Type | How it runs | Can block? | Use case |
|------|-------------|------------|----------|
| `command` | Shell script, receives JSON on stdin | Yes (exit 2) | Formatting, linting, guards |
| `http` | POST to URL, receives JSON body | Yes (via response JSON) | External audit services, team logging |
| `prompt` | Single LLM call (Haiku default), returns `{"ok": bool, "reason": str}` | Yes | Judgment calls without file I/O |
| `agent` | Spawns Claude subagent with tool access (Read, Grep, Glob, Bash) | Yes | Verification requiring codebase inspection |

Source: https://code.claude.com/docs/en/hooks, https://code.claude.com/docs/en/hooks-guide.md

### 2. All Hook Events — When They Fire

| Event | When | Can Block | Matcher Field |
|-------|------|-----------|---------------|
| `SessionStart` | Session begins/resumes | No | `startup`, `resume`, `clear`, `compact` |
| `UserPromptSubmit` | Before Claude processes prompt | Yes | None |
| `PreToolUse` | Before tool execution | Yes | Tool name (regex) |
| `PermissionRequest` | Permission dialog about to show | Yes | Tool name |
| `PostToolUse` | After tool succeeds | No (already ran) | Tool name |
| `PostToolUseFailure` | After tool fails | No | Tool name |
| `Notification` | Notification sent to user | No | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog` |
| `SubagentStart` | Subagent spawned | No | Agent type |
| `SubagentStop` | Subagent finishes | Yes | Agent type |
| `Stop` | Claude finishes responding | Yes | None |
| `TeammateIdle` | Agent team teammate about to idle | Yes | None |
| `TaskCompleted` | Task marked complete | Yes | None |
| `ConfigChange` | Config file changes during session | Yes | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` |
| `WorktreeCreate` | Worktree being created | Yes (non-zero exit) | None |
| `WorktreeRemove` | Worktree being removed | No | None |
| `PreCompact` | Before context compaction | No | `manual`, `auto` |
| `PostCompact` | After compaction | No | `manual`, `auto` |
| `Elicitation` | MCP server requests user input | Yes | MCP server name |
| `ElicitationResult` | User responds to MCP elicitation | Yes | MCP server name |
| `InstructionsLoaded` | CLAUDE.md or rules file loaded | No | None |
| `SessionEnd` | Session terminates | No | `clear`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` |

Source: https://code.claude.com/docs/en/hooks-guide.md (table)

### 3. JSON Payloads Each Hook Receives

**Every hook receives these common fields:**
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default|plan|acceptEdits|dontAsk|bypassPermissions",
  "hook_event_name": "EventName",
  "agent_id": "optional - when inside subagent",
  "agent_type": "optional - agent name"
}
```

**PreToolUse / PostToolUse specific fields:**
```json
{
  "tool_name": "Bash|Edit|Write|Read|Glob|Grep|Agent|WebFetch|WebSearch|mcp__server__tool",
  "tool_input": {
    // Edit: { "file_path": "...", "old_string": "...", "new_string": "...", "replace_all": false }
    // Write: { "file_path": "...", "content": "..." }
    // Bash: { "command": "...", "description": "...", "timeout": 120000, "run_in_background": false }
    // Read: { "file_path": "...", "offset": 10, "limit": 50 }
  },
  "tool_use_id": "toolu_01ABC123...",
  // PostToolUse also includes:
  "tool_response": { "filePath": "...", "success": true }
}
```

**Stop specific fields:**
```json
{
  "stop_hook_active": true,       // true when Claude is already continuing due to a hook
  "last_assistant_message": "..."  // Claude's last response text
}
```

**Key insight for documentation automation:** `PostToolUse` on `Edit|Write` receives `tool_input.file_path` — you know exactly which file was modified. (Confidence: HIGH)

Source: https://code.claude.com/docs/en/hooks (full schema section)

### 4. Hook Output — How Hooks Communicate Back

**Exit codes (command hooks):**
- `exit 0` — allow, JSON in stdout is parsed if present
- `exit 2` — block, stderr text is fed to Claude as feedback
- Other non-zero — non-blocking error, stderr shown in verbose mode only

**JSON stdout (exit 0, command/HTTP hooks):**
```json
{
  "continue": true,
  "stopReason": "...",
  "suppressOutput": false,
  "systemMessage": "..."
}
```

**PreToolUse permission decision:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "Shown to user/Claude",
    "updatedInput": { "field": "new_value" },
    "additionalContext": "For Claude"
  }
}
```

**Stop/SubagentStop blocking:**
```json
{
  "decision": "block",
  "reason": "Must complete all tests first"
}
```

**Prompt/Agent hooks return:**
```json
{ "ok": true }
// or
{ "ok": false, "reason": "What remains to be done — Claude receives this as instruction" }
```

Source: https://code.claude.com/docs/en/hooks (output section)

### 5. Can Hooks Trigger Claude to Do Additional Work?

**YES — three mechanisms:** (Confidence: HIGH)

**Mechanism A: Stop hook with `ok: false` (most powerful)**
When a Stop or SubagentStop prompt/agent hook returns `ok: false`, Claude receives the `reason` as new instructions and continues working. This is the primary pattern for causing Claude to perform additional work (like doc updates) after completing its main task:

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "prompt",
        "prompt": "Review the transcript. If any source files were modified without corresponding documentation updates, return {\"ok\": false, \"reason\": \"Update docs for: <list changed files>\"}."
      }]
    }]
  }
}
```

Claude then receives the `reason` as its next instruction and proceeds to update docs. The `stop_hook_active` field must be checked to prevent infinite loops:
```bash
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Allow Claude to stop — don't loop again
fi
```

**Mechanism B: Agent hooks with file access**
Agent hooks spawn a subagent that can read files, run commands, and do real verification. For a `Stop` event:
```json
{
  "type": "agent",
  "prompt": "Read the modified source files from this session. Check if corresponding .md documentation files are up-to-date. Return ok: false with specific files to update if they're stale.",
  "timeout": 120
}
```

**Mechanism C: PostToolUse command hook calling claude -p**
A PostToolUse command hook can shell out to `claude -p` for headless doc generation:
```bash
FILE=$(jq -r '.tool_input.file_path')
if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  claude -p "Update the documentation for $FILE based on its current contents" --print
fi
```
**Caveat:** This spawns a separate Claude session with no context of the current conversation. It does not have access to what Claude just changed or why.

Source: https://code.claude.com/docs/en/hooks-guide.md, https://code.claude.com/docs/en/hooks

### 6. PostToolUse vs PreToolUse for Documentation

| Hook | Timing | Best For |
|------|--------|----------|
| `PreToolUse` on `Write\|Edit` | Before file is written | Blocking writes missing docs, validating doc co-existence |
| `PostToolUse` on `Write\|Edit` | After file is written | Auto-formatting, triggering doc generation scripts |
| `Stop` (prompt or agent) | After Claude finishes | Holistic doc review, catching missed updates across all files |

**PostToolUse cannot undo actions** — the file has already been written. It can only trigger follow-on work.

Source: https://code.claude.com/docs/en/hooks-guide.md (Limitations section)

### 7. Matchers for Targeting File Edits

For documentation automation, the most useful matchers:

```json
"matcher": "Edit|Write"          // Any file write (both tools)
"matcher": "Write"               // New file creation only
"matcher": "Edit"                // File modifications only
"matcher": "mcp__.*"             // All MCP tool calls
"matcher": "mcp__filesystem__.*" // Filesystem MCP tools specifically
```

Matchers are **regex patterns** applied to the tool name. Case-sensitive.

Source: https://code.claude.com/docs/en/hooks-guide.md (Filter hooks with matchers)

### 8. Hook Configuration Location and Scope

```
~/.claude/settings.json              — All your projects (personal)
.claude/settings.json                — Single project, committable to git
.claude/settings.local.json          — Single project, gitignored (personal)
Plugin hooks/hooks.json              — When plugin is enabled
Skill/agent frontmatter              — While skill/agent is active
```

For documentation automation shared across a team, use `.claude/settings.json` committed to the repo.

Source: https://code.claude.com/docs/en/hooks-guide.md (Configure hook location table)

### 9. Official Anthropic Examples for Documentation Automation

**No official Anthropic example specifically covers documentation automation.** (Confidence: HIGH — verified by checking the examples directory)

The only official hook example in the GitHub repo is:
- `examples/hooks/bash_command_validator_example.py` — validates bash commands (PreToolUse pattern)

Source: https://github.com/anthropics/claude-code/tree/main/examples/hooks

The official docs reference three doc-adjacent examples:
1. **Auto-format after edits** (PostToolUse + Prettier) — direct analog to doc generation
2. **Re-inject context after compaction** (SessionStart) — maintaining doc context
3. **Stop hook preventing early exit** (Stop + prompt hook) — quality gate pattern

Source: https://code.claude.com/docs/en/hooks-guide.md

### 10. Community Examples (Not Primary Sources)

No community examples specifically for documentation automation were found in official channels. The pattern is achievable but requires custom implementation.

### 11. Timeout Defaults

| Hook Type | Default Timeout |
|-----------|-----------------|
| Command | 600 seconds |
| HTTP | 30 seconds |
| Prompt | 30 seconds |
| Agent | 60 seconds |
| SessionEnd hooks | 1.5 seconds (override: `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`) |

Source: https://code.claude.com/docs/en/hooks

### 12. Supported Events for Prompt/Agent Hooks

Prompt and agent hooks only work on 8 decision-making events:
- `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `PreToolUse`, `Stop`, `SubagentStop`, `TaskCompleted`, `UserPromptSubmit`

All other events (observability-only events like `Notification`, `SessionEnd`, `InstructionsLoaded`) support only `command` and `http` types.

Source: https://code.claude.com/docs/en/hooks

## Key Takeaways

1. **PostToolUse on `Edit|Write`** receives `tool_input.file_path` — enables targeting specific file types (e.g., only `.ts` files) for doc triggers.

2. **Stop hook + agent/prompt type** is the primary mechanism for causing Claude to do additional work after finishing. When it returns `ok: false`, Claude receives the `reason` as a new instruction.

3. **Agent hooks** are unique — they spawn a Claude subagent with Read/Grep/Glob/Bash access. This is how a hook can "read the codebase and decide" whether docs need updating, without those decisions being hardcoded in shell scripts.

4. **`stop_hook_active` guard** is required in Stop hooks to prevent infinite loops. Always check `jq -r '.stop_hook_active'` and exit 0 if true.

5. **PostToolUse cannot block** — the tool has already run. Use PreToolUse to prevent writes; use PostToolUse to react after writes.

6. **No official doc-automation examples** exist from Anthropic. The auto-format (Prettier) example in the official guide is the closest analog.

7. **Hooks run in parallel** when multiple hooks match an event. Identical hook commands are deduplicated.

8. **Shell profile noise** in `~/.zshrc`/`~/.bashrc` can corrupt JSON output — hooks run in non-interactive shells so unconditional `echo` statements prepend to JSON, causing parse failures.

## Architecture for Documentation Automation (Synthesized Pattern)

Based on official docs, the recommended approach for "update docs when code changes" has two layers:

**Layer 1: Immediate reaction (PostToolUse command hook)**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "bash .claude/hooks/maybe-update-docs.sh"
      }]
    }]
  }
}
```
The script reads `tool_input.file_path` and can: (a) write a flag file listing changed source files, (b) run a static doc generator (typedoc, jsdoc), or (c) queue a doc-update request.

**Layer 2: Holistic gate (Stop agent hook)**
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "agent",
        "prompt": "Check $ARGUMENTS stop_hook_active first — if true, return {\"ok\": true}. Otherwise read the session transcript at transcript_path. For each .ts file that was modified, check if a corresponding doc file exists and is current. Return {\"ok\": false, \"reason\": \"Please update docs for: <files>\"} if any docs are missing or stale.",
        "timeout": 120
      }]
    }]
  }
}
```

This causes Claude to receive "Please update docs for: X, Y, Z" as its next instruction after finishing, then it will update those files before stopping again.

## Gaps Identified

- No official Anthropic guidance specifically on documentation automation with hooks
- No community registry or examples repo for hook patterns (as of 2026-03-17)
- Agent hooks documentation does not specify exactly which tools the spawned subagent has access to beyond "Read, Grep, Glob, Bash" — whether it can call `claude -p` is unconfirmed
- The `$ARGUMENTS` placeholder in prompt/agent hook prompts is documented but the exact substitution behavior (full JSON or specific fields) is not spelled out in the reference

## Sources

- Primary: https://code.claude.com/docs/en/hooks (full reference)
- Primary: https://code.claude.com/docs/en/hooks-guide.md (guide with examples)
- Primary: https://code.claude.com/docs/en/common-workflows.md (documentation workflow section)
- Primary: https://code.claude.com/docs/en/overview.md (overview mentioning hooks)
- Primary: https://github.com/anthropics/claude-code/tree/main/examples/hooks (official examples)
- Docs index: https://code.claude.com/docs/llms.txt
