# CLAUDE.md — @harness/plugin-context

Implementation notes and gotchas for the context plugin. Read this before editing any file in this package.

## Role in the pipeline

This plugin implements `onBeforeInvoke`, which is a chain hook. Each plugin in the chain receives the output of the previous plugin and returns a modified prompt. The context plugin runs **first** in registration order, meaning the time plugin runs after it. History and context files are injected before time substitution happens — this ordering is intentional and must not change.

## The session resumption short-circuit

If `thread.sessionId` is set, the plugin skips history injection entirely and only prepends context files.

This is the most important non-obvious behavior in this plugin. When a Claude subprocess session already exists for a thread, that subprocess has the full conversation in its native context window. Injecting history again would duplicate every prior message, potentially filling the context window with redundant content and confusing Claude.

The short-circuit lives in `src/index.ts` in the `onBeforeInvoke` implementation. Do not remove or weaken this check. Any change to history injection logic must account for this branch.

## File discovery and priority ordering

The plugin reads `*.md` files from `contextDir` (defaults to `process.cwd()/context`). Files are not loaded in alphabetical order. A priority list defines which files load first:

1. `memory.md`
2. `world-state.md`
3. `thread-summaries.md`
4. `inbox.md`

All other files load after these four, sorted alphabetically. If you add a new well-known file that should load early, add it to the priority list in `src/_helpers/read-context-files.ts` — do not assume alphabetical ordering will put it where you want it.

## File cache

Files are cached in memory with a 5-second TTL. Cache invalidation is mtime-based: if a file's modification time has not changed, the cached content is returned. If mtime changed or the TTL expired, the file is re-read from disk.

This means file changes propagate within 5 seconds, not immediately. Do not rely on synchronous file reload in tests — use a short wait or mock the cache.

The cache is module-level (not per-invocation). It persists across multiple `onBeforeInvoke` calls for the lifetime of the orchestrator process.

## File size limit

Files larger than 50KB are truncated. A marker string is appended at the truncation point so Claude knows the content was cut. This is a hard limit — increasing it risks overflowing Claude's context window with a single file. If you need larger context files, consider splitting them.

Empty files (zero bytes or whitespace-only) are silently skipped. They do not appear in the assembled prompt.

## DB failure handling

If the database query for conversation history throws, the plugin logs a warning and continues with only the context files. It does not propagate the error or abort the pipeline.

This means the plugin has two possible outputs in the error case: context files only (if DB fails) vs. context files + history (normal case). Code that depends on history being present should not assume it always is.

## Prompt assembly order

The final assembled prompt is, from top to bottom:

1. Context section (files from `context/` directory)
2. History section (recent messages from DB, omitted if `thread.sessionId` is set)
3. The original base prompt

Each section is separated by `\n\n---\n\n`. If the context directory does not exist or contains no files, the context section is omitted entirely (not an empty heading). Same for history.

## History depth

The plugin loads the last 50 messages for the thread, in chronological order. This limit is hardcoded in `src/_helpers/history-loader.ts`. Threads with very long histories will have older messages silently excluded. If you change this limit, be aware of context window pressure.

## Test placement

Tests live in `src/__tests__/index.test.ts` and `src/_helpers/__tests__/`. Each helper file has a corresponding test file. Do not place tests alongside source files.
