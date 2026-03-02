# Auto-Namer Plugin

## What it does

The auto-namer plugin gives threads a human-readable name after the first user message. New threads start with no name (displayed as "New Chat" in the UI). When the first message arrives, the plugin fires a background Claude Haiku invocation to generate a 5-8 word descriptive title, updates the thread record, and broadcasts a `thread:name-updated` event so the sidebar refreshes without a page reload.

## Why it exists

Thread IDs are meaningless. Without auto-naming, the sidebar shows either a blank name or a raw `source/sourceId` string like `web/550e8400-...`, making it impossible to distinguish threads at a glance. Auto-naming makes the thread list useful immediately.

## How it works

- Hook: `onMessage` — fires before the main Claude invocation (step 1 of the pipeline)
- Guards: only fires for `role: 'user'` messages, only on the first message (count === 1), skips threads already named (unless the name is literally `"New Chat"`)
- Fires `generateNameInBackground` as a fire-and-forget void — runs in parallel with the main pipeline
- The background task: invokes Claude Haiku with the user's message → trims the output → updates `thread.name` in DB → broadcasts `thread:name-updated`

## Timing

Because the hook fires in `onMessage` (before Claude is invoked for the main response), the title generation runs concurrently with the pipeline. The name typically lands before or shortly after the main response completes. The sidebar refreshes on `thread:name-updated` via a WebSocket listener.

## What it does not do

The auto-namer does not rename threads after the first message. If a thread already has a non-default name, it is never overwritten. Renaming is a user action (via the Manage modal), not an automatic one.
