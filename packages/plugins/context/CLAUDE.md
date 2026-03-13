# CLAUDE.md — @harness/plugin-context

Implementation notes and gotchas for the context plugin. Read this before editing any file in this package.

## Role in the pipeline

This plugin implements `onBeforeInvoke`, which is a chain hook. Each plugin in the chain receives the output of the previous plugin and returns a modified prompt. The `onBeforeInvoke` chain order is: identity (soul injection) → context (file references + history) → time (timestamp substitution). The context plugin runs after identity and before time — this ordering is intentional and must not change.

## The session resumption short-circuit

If `thread.sessionId` is set, the plugin skips history injection entirely but **still injects file references**.

This is the most important non-obvious behavior in this plugin. When a Claude subprocess session already exists for a thread, that subprocess has the full conversation in its native context window. Injecting history again would duplicate every prior message. However, file references must always be injected because new files may have been uploaded since the session was created.

The short-circuit lives in `src/index.ts` in the `onBeforeInvoke` implementation. Do not remove or weaken this check for history. Do not extend it to file references.

## File reference injection (DB-driven)

The plugin queries the `File` table for THREAD-scoped and PROJECT-scoped files associated with the current thread. DECORATIVE files (agent avatars etc.) are never included.

Files are loaded via `loadFileReferences(db, uploadDir, threadId, projectId)` and formatted via `formatFileReferences(fileRefs)`. The result is a markdown section listing each file's name, MIME type, size, and full disk path.

File references are injected UNCONDITIONALLY — they appear in the prompt regardless of whether `thread.sessionId` exists. This differs from conversation history, which is skipped when a session is active.

## DB failure handling

If the database query for conversation history throws, the plugin logs a warning and continues with only the file references and prompt. It does not propagate the error or abort the pipeline.

If the file reference query fails, a warning is logged and the file references section is omitted. The pipeline continues with history and prompt.

## Prompt assembly order

The final assembled prompt is, from top to bottom:

1. Project instructions (XML-tagged `<project_instructions>`)
2. Project memory (XML-tagged `<project_memory>`)
3. User profile section
4. File references section (`# Available Files` with `## Project Files` / `## Thread Files`)
5. Summary section (prior conversation summaries, if any)
6. History section (recent messages from DB, omitted if `thread.sessionId` is set)
7. The original base prompt

Each section is separated by `\n\n---\n\n`. Empty sections are omitted entirely (not an empty heading).

## History depth

The plugin loads the last 50 messages for the thread, in chronological order. When summaries exist, the limit is reduced to 25. Both values are configurable via plugin settings (`historyLimit`, `historyLimitWithSummary`). The `summaryLookback` setting controls how many summaries are injected (default: 2).

## Test placement

Tests live in `src/__tests__/index.test.ts` and `src/_helpers/__tests__/`. Each helper file has a corresponding test file. Do not place tests alongside source files.
