# Time Plugin

## What it does

The time plugin gives Claude accurate awareness of the current date and time. It operates in two ways: by automatically replacing a `/current-time` token in any prompt before Claude sees it, and by exposing a `current_time` MCP tool that Claude can call explicitly during a conversation.

Both paths produce the same output: a human-readable timestamp in the orchestrator's configured timezone (e.g., "Saturday, March 1, 2026, 2:45:30 PM PST").

## Why it exists

Claude's training data has a knowledge cutoff. Without time grounding, Claude will either refuse to state the current time or report a stale date from its training. The time plugin solves this by injecting the real current time — from the server's clock — either automatically or on demand.

The configured timezone matters. Teams in different regions can set their local IANA timezone in the orchestrator config and Claude will report time in that zone consistently, across both prompt injection and tool calls.

## Two ways to use it

**Passive — prompt token replacement.** If a user message or assembled prompt contains `/current-time`, the plugin replaces it with the actual timestamp before Claude is invoked. The user never has to ask Claude to look up the time separately.

**Active — tool call.** Claude can call the `current_time` tool at any point during a response if it needs the time and the prompt did not already contain the token. This is useful for agentic tasks where time awareness is needed mid-reasoning rather than at message entry.

## What it does not do

The time plugin does not cache timestamps. Every invocation or tool call generates a fresh timestamp from the system clock. It does not provide date arithmetic, time zone conversion utilities, or calendar functions — it only reports the current moment.
