# Audit Plugin

## What it does

The audit plugin handles "Audit & Delete" — a safe deletion mode that extracts the full conversation into a persistent record before hard-deleting the thread. When triggered, it loads the conversation history, invokes Claude Haiku to extract all important information as generously as possible, stores the result in the `ThreadAudit` table (which survives thread deletion), then deletes the thread and all associated data.

## Why it exists

Deleting a thread is irreversible. A user might be deleting a thread because they're done with it — but "done with it" doesn't mean the information in it has no future value. The audit plugin creates a safety net: before anything is deleted, everything worth saving is extracted and stored.

The design principle is **over-save rather than under-save**. Data loss from a trusted process is the worst kind — better to keep too much than to silently discard something important.

## How it works

- Hook: `onBroadcast` — listens for the `audit:requested` event
- Triggered by `POST /api/audit-delete` on the orchestrator HTTP server
- Duplicate guard: skips if a `ThreadAudit` record was created in the last 60 seconds for the same thread
- Fires `runAuditInBackground` as a fire-and-forget void
- Background flow: load messages → invoke Haiku with extraction prompt → write `ThreadAudit` → detach child threads → delete thread → broadcast `thread:deleted`
- The browser navigates away on `thread:deleted`

## What it stores

One `ThreadAudit` row per audit:
- `threadId`: the deleted thread's ID (stored as a plain string, not a foreign key — survives deletion)
- `threadName`: snapshot of the thread name at time of audit
- `content`: the full extraction output from Claude
- `metadata.messageCount`: how many messages were analyzed

## What it does not do

The audit plugin does not provide a UI for browsing `ThreadAudit` records — that is a future feature. The records exist and are queryable via the database, but there is no dedicated view for them yet.

The plugin caps message history at 200 entries. Threads longer than 200 messages will have their oldest messages omitted from the extraction.
