# @harness/plugin-context

The context plugin is the memory layer of the Harness orchestrator. It ensures Claude always has access to conversation history and persistent project-level context files before it processes any message.

## What it does

Every time Claude is about to be invoked, the context plugin intercepts the prompt and prepends two things: the recent conversation history for the current thread, and any persistent context files you have placed in the `context/` directory at the root of your project.

This gives Claude continuity. Without it, each invocation would be stateless — Claude would have no knowledge of prior conversation turns or any standing instructions you have written.

## Why it exists

Claude Code CLI is stateless by default. The Harness orchestrator keeps Claude alive across many invocations, but it needs a way to bridge the gap between Claude's current subprocess and the history stored in the database. The context plugin is that bridge.

It also provides a lightweight way to inject persistent instructions, project facts, or world state into every prompt without modifying any code. Drop a Markdown file into the `context/` directory and Claude will see it on the next invocation.

## The context/ directory

Place `*.md` files in a `context/` directory at the root of your project. Common uses:

- `context/memory.md` — facts Claude should always remember
- `context/world-state.md` — current state of a long-running task or project
- `context/thread-summaries.md` — summaries of prior work sessions
- `context/inbox.md` — pending tasks or incoming requests

Files are loaded on every invocation. Changes take effect within a few seconds without restarting the orchestrator.
