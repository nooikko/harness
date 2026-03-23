# Plugin System

How to add new behavior. How existing plugins work. What the hook system can and cannot do.

**Live plugin contract (zero-drift source of truth):**
@packages/plugin-contract/src/index.ts

---

## Adding New Behavior: The Decision Tree

```
Need new behavior?
    |
    v
Does an existing hook fire at the right pipeline step?
    |
    +-- YES -> Write a new plugin (or add a hook implementation to an existing one)
    |          See: "Creating a Plugin" below
    |
    +-- NO  -> Does the pipeline have a step where this SHOULD fire but currently doesn't?
                  |
                  +-- YES -> Add a new hook type to packages/plugin-contract/src/index.ts
                  |          Add one hook call in apps/orchestrator/src/orchestrator/index.ts
                  |          Then implement the plugin
                  |
                  +-- NO  -> Add a new PluginContext method if plugins need new capability
                             Do NOT add logic directly to handleMessage
```

---

## PluginDefinition Shape

File: `packages/plugin-contract/src/index.ts`

```typescript
type PluginDefinition = {
  name: string;
  version: string;
  register: (ctx: PluginContext) => Promise<PluginHooks>;  // Required. Return implemented hooks.
  start?: (ctx: PluginContext) => Promise<void>;           // Optional. After all plugins register.
  stop?: (ctx: PluginContext) => Promise<void>;            // Optional. On graceful shutdown.
  tools?: PluginTool[];                                    // Optional. MCP tools for Claude.
  system?: boolean;                                        // Optional. If true, receives unsandboxed PluginContext.
  settingsSchema?: PluginSettingsSchemaInstance<...>;       // Optional. Typed settings definition for admin UI.
};
```

`register` is called at startup. It receives `PluginContext` and returns only the hooks this plugin implements. Unimplemented hooks are simply omitted from the returned object.

`start` fires after all plugins have registered — use it for things that need other plugins to exist first (e.g., starting an HTTP server, connecting to Discord).

`stop` fires on graceful shutdown.

---

## PluginHooks — All Available Hooks

File: `packages/plugin-contract/src/index.ts`, line 130

```typescript
type PluginHooks = {
  onMessage?:          (threadId, role, content) => Promise<void>
  onBeforeInvoke?:     (threadId, prompt) => Promise<string>       // returns modified prompt
  onAfterInvoke?:      (threadId, result: InvokeResult) => Promise<void>
  onBroadcast?:        (event, data) => Promise<void>
  onTaskCreate?:       (threadId, taskId) => Promise<void>
  onTaskComplete?:     (threadId, taskId, result) => Promise<void>
  onTaskFailed?:       (threadId, taskId, error) => Promise<void>
  onPipelineStart?:    (threadId) => Promise<void>
  onPipelineComplete?: (threadId, result: { invokeResult, pipelineSteps, streamEvents }) => Promise<void>
  onSettingsChange?:   (pluginName) => Promise<void>
};
```

---

## PluginContext — What Every Plugin Receives

File: `packages/plugin-contract/src/index.ts`, line 119

```typescript
ctx.db                  // PrismaClient — full DB access (sandboxed per-plugin unless system: true)
ctx.invoker             // { invoke(prompt, opts?), prewarm?(opts) } — call Claude as sub-agent
ctx.config              // OrchestratorConfig — { port, claudeModel, claudeTimeout, timezone, ... }
ctx.logger              // Logger — .info(), .warn(), .error(), .debug()
ctx.sendToThread        // (threadId, content) => Promise<void> — run full pipeline + persist response
ctx.broadcast           // (event, data) => Promise<void> — fan out to all onBroadcast hooks
ctx.getSettings         // <T>(schema) => Promise<InferSettings<T>> — read typed plugin settings from DB
ctx.notifySettingsChange // (pluginName) => Promise<void> — triggers onSettingsChange hooks for all plugins
```

`ctx.sendToThread` runs the full pipeline (onPipelineStart -> handleMessage -> onPipelineComplete -> persist assistant text -> broadcast pipeline:complete).
`ctx.broadcast` reaches the browser via the web plugin's `onBroadcast` implementation.
`ctx.getSettings` reads `PluginConfig` records from the database and returns typed values matching the plugin's settings schema.
`ctx.notifySettingsChange` fires all `onSettingsChange` hooks — used after admin UI updates a plugin's config.

---

## Plugin Tool Registration (MCP)

Plugins can expose tools to Claude that it can call during invocation.

```typescript
const myPlugin: PluginDefinition = {
  name: 'my-plugin',
  version: '1.0.0',
  tools: [{
    name: 'my_tool',
    description: 'What this tool does',
    schema: { /* JSON Schema for input */ },
    handler: async (ctx, input, meta) => {
      // meta.threadId — current thread
      // meta.taskId  — if running inside a delegation task
      // meta.traceId — for correlating with originating pipeline run
      return 'result string';
    },
  }],
  register: async (ctx) => ({ /* hooks */ }),
};
```

Tools are qualified as `pluginName__toolName` (e.g., `delegation__delegate`) when exposed to Claude.
Claude calls them as MCP tools during `invoker.invoke()` within the current session.

File: `apps/orchestrator/src/tool-server/index.ts`

---

## Plugin Registration Order

File: `apps/orchestrator/src/plugin-registry/index.ts`

```typescript
const ALL_PLUGINS: PluginDefinition[] = [
  identityPlugin,         // onBeforeInvoke: injects agent soul + memories (MUST be first)
  activityPlugin,         // onPipelineStart + onPipelineComplete: persists rich activity records
  contextPlugin,          // onBeforeInvoke: injects context files + conversation history
  discordPlugin,          // start/stop: Discord gateway; onSettingsChange: token reload
  webPlugin,              // start/stop: HTTP server + WebSocket; onBroadcast: WebSocket fan-out
  cronPlugin,             // start/stop: reads CronJob records, schedules with croner
  delegationPlugin,       // tools: delegate, checkin; runs delegation loop in background
  validatorPlugin,        // onTaskComplete: quality-gates sub-agent outputs via rubric
  metricsPlugin,          // onAfterInvoke: records token usage + cost as Metric rows
  summarizationPlugin,    // onAfterInvoke: compresses history every 50 messages
  autoNamerPlugin,        // onMessage: generates thread title after first user message
  auditPlugin,            // onBroadcast: extracts conversation to ThreadAudit, then deletes thread
  timePlugin,             // onBeforeInvoke: replaces /current-time tokens; tool: current_time
  projectPlugin,          // tools: get_project_memory, set_project_memory
  tasksPlugin,            // tools: task CRUD for UserTask records
  outlookPlugin,          // tools: email read/send via Microsoft Graph
  calendarPlugin,         // onSettingsChange: re-sync; start/stop: sync timer; tools: unified calendar CRUD + Outlook Graph
  musicPlugin,            // start/stop: YouTube Music + Cast discovery; onSettingsChange: reload; tools: playback control
  searchPlugin,           // start: Qdrant backfill; onMessage + onPipelineComplete: index content; onBroadcast: re-index threads
  playwrightPlugin,       // start/stop: headless browser; onPipelineComplete: cleanup; tools: browser automation + visual capture
  logsPlugin,             // tools: structured log querying via Loki or file
  sshPlugin,              // onSettingsChange: reload; start/stop: connection pool; tools: remote execution via SSH
];
```

Hook runners iterate in this order. For `onBeforeInvoke` (chain): identity runs first (soul injection), then context (history + files), then time (timestamp substitution).

Plugins can be disabled at runtime via `PluginConfig.enabled` in the database without code changes.

---

## What Each Existing Plugin Owns

### identity plugin
**Hooks:** `onBeforeInvoke`, `onAfterInvoke`
**Tool:** `update_self`
**Does:** Injects agent soul, identity, and memories into prompts (dual injection: header before message, anchor after). When `AgentConfig.bootstrapped === false`, also injects a bootstrap prompt that guides conversational identity discovery. After invocation, scores response importance and writes `EPISODIC` AgentMemory records. Also triggers reflection cycle (fire-and-forget) when enough unreflected memories accumulate. The `update_self` MCP tool lets the agent write its own name, soul, identity, role, goal, and backstory — and sets `bootstrapped: true`.
**Key behavior:** No-op if thread has no assigned agent (`thread.agentId` null or agent not enabled).

### activity plugin
**Hooks:** `onPipelineStart`, `onPipelineComplete`
**Does:** Owns all rich activity persistence. On pipeline start: writes `pipeline_start` status record. On pipeline complete: writes `pipeline_step` records, `thinking`/`tool_call`/`tool_result` stream event records, and `pipeline_complete` status record. The orchestrator only writes `kind:'text'` (assistant response) — everything else is this plugin.

### context plugin
**Hook:** `onBeforeInvoke`
**Does:** Injects context/ directory files + conversation history + project instructions/memory into every prompt. Also injects thread summaries if available.
**Key behavior:** If `thread.sessionId` exists, skips history injection (Claude already has it via session resume). Also injects project-level instructions and memory as XML-tagged sections.

### delegation plugin
**Tools:** `delegate`, `checkin`
**Does:** Runs the delegation loop: creates task thread, iterates invoke+validate, notifies parent thread. All delegation is triggered via MCP tools (no slash commands). The tool handler is fire-and-forget — the loop runs in the background.

### validator plugin
**Hook:** `onTaskComplete`
**Does:** Quality-gates sub-agent delegation outputs via a rubric prompt. Uses Opus for evaluation. If verdict is `fail`, throws with feedback (delegation loop retries). Safety valve: always accepts on the last iteration to prevent infinite loops.

### web plugin
**Hook:** `onBroadcast`
**Lifecycle:** `start` / `stop`
**Does:** Fans every `ctx.broadcast()` event to WebSocket clients. Also runs the HTTP server (`POST /api/chat` -> `onChatMessage` -> fire-and-forget `sendToThread`). Exposes `POST /api/plugins/:name/reload` which calls `ctx.notifySettingsChange`.

### metrics plugin
**Hook:** `onAfterInvoke`
**Does:** Records token usage and cost estimate as 4 `Metric` rows (input, output, total, cost) after each Claude invocation. Uses hardcoded pricing map. Silently skips if result is missing model/token fields.

### discord plugin
**Hook:** `onSettingsChange`
**Lifecycle:** `start` / `stop`
**Does:** Connects Discord.js gateway, routes incoming messages to threads via `ctx.db` + `ctx.broadcast`. On `onSettingsChange`, reconnects with updated bot token from settings. Persists connection state to `PluginConfig.metadata`.

### cron plugin
**Hook:** `onSettingsChange`
**Lifecycle:** `start` / `stop`
**Tool:** `schedule_task`
**Does:** Reads enabled `CronJob` records from DB, partitions into recurring (cron expression) and one-shot (`fireAt` datetime) jobs, and schedules with croner (UTC). On trigger: resolves threadId (auto-creates thread if null via lazy thread creation), calls `ctx.sendToThread(threadId, job.prompt)`, and atomically updates `lastRunAt`/`nextRunAt`. One-shot jobs auto-disable after firing (`enabled: false`). The `schedule_task` MCP tool allows agents to create scheduled tasks during conversation — `agentId` and `projectId` are auto-resolved from the current thread. Supports hot-reload via `onSettingsChange('cron')` — stops all running jobs and rebuilds from DB. Admin UI actions and the MCP tool both trigger reload automatically.

### summarization plugin
**Hook:** `onAfterInvoke`
**Does:** At every 50th message in a thread, fires a background summarization. Uses Haiku to generate a summary, writes it as a `kind:'summary'` Message record. 60-second duplicate guard prevents double-summarization.

### auto-namer plugin
**Hook:** `onMessage`
**Does:** On the first user message in a thread (when name is null or "New Chat"), generates a short title using Haiku in the background. Broadcasts `thread:name-updated` for real-time sidebar refresh.

### audit plugin
**Hook:** `onBroadcast`
**Does:** Listens for `audit:requested` events. Extracts conversation (up to 200 text messages) using Haiku, writes a `ThreadAudit` record, then hard-deletes the thread. 60-second duplicate guard. Thread is only deleted after audit record is successfully written.

### time plugin
**Hook:** `onBeforeInvoke`
**Tool:** `current_time`
**Lifecycle:** `start` (timezone validation)
**Does:** Replaces `/current-time` tokens in prompts with the actual timestamp in configured timezone. Two modes: standalone (rewrites entire user message section) and inline (token replacement). Tool provides the same formatted time on demand.

### project plugin
**Tools:** `get_project_memory`, `set_project_memory`
**Does:** Exposes MCP tools for Claude to read and write the `Project.memory` field associated with the current thread's project. No hooks — tool-only plugin.

### search plugin
**Hooks:** `onMessage`, `onPipelineComplete`, `onBroadcast`
**Lifecycle:** `start` (ensure Qdrant collections + backfill existing content), `stop` (abort backfill)
**Does:** Maintains Qdrant vector indexes for semantic search. Indexes user messages via `onMessage`, assistant responses via `onPipelineComplete`, and re-indexes threads on name change via `onBroadcast('thread:name-updated')`. All indexing is fire-and-forget. On startup, runs a cancellable backfill of existing content. No-op if `QDRANT_URL` is not configured — search degrades to FTS-only.
**Key behavior:** Uses `@harness/vector-search` package (HuggingFace `all-MiniLM-L6-v2`, 384 dimensions). Truncates content to 512 chars for embedding focus.

### tasks plugin
**Tools:** `add_task`, `list_tasks`, `update_task`, `complete_task`, `add_dependency`, `remove_dependency`
**Does:** CRUD for `UserTask` records via MCP tools. Supports task dependencies with cycle detection/rejection. `add_task` auto-resolves `projectId` and `sourceThreadId` from the current thread via `meta.threadId`. `list_tasks` filters by status and project scope. No hooks — tool-only plugin.

### outlook plugin
**Tools:** `search_emails`, `read_email`, `list_recent`, `send_email`, `reply_email`, `move_email`, `list_folders`, `find_unsubscribe_links`
**Does:** Email access via Microsoft Graph API. All tools authenticate using OAuth tokens stored in PluginConfig. `search_emails` supports KQL syntax. `list_recent` browses inbox/sent/drafts/archive/trash. `find_unsubscribe_links` scans recent emails for unsubscribe URLs. No hooks — tool-only plugin.

### calendar plugin
**Hooks:** `onSettingsChange`
**Lifecycle:** `start` (initial sync from Outlook + Google + project virtual events, starts periodic sync timer), `stop` (stops sync timer)
**Tools:** `create_event`, `update_event`, `delete_event`, `list_events`, `get_event`, `respond_to_event`, `outlook_create_event`, `outlook_update_event`, `outlook_delete_event`, `outlook_list_events`, `outlook_get_event`, `outlook_find_free_time`, `outlook_list_calendars`, `sync_now`
**Does:** Unified calendar system merging events from Outlook (via Graph API), Google Calendar, and local events into a single CalendarEvent table. On startup and periodically, syncs external calendars and projects virtual events from memories, tasks, and cron jobs. `list_events` queries the unified local database; `outlook_list_events` queries Graph API directly for real-time data. `respond_to_event` handles RSVP for Outlook and Google invitations. `onSettingsChange('calendar')` re-syncs all providers.
**Key behavior:** `system: true` — receives unsandboxed PluginContext. Local events support categories and color overrides.

### music plugin
**Hooks:** `onSettingsChange`
**Lifecycle:** `start` (check yt-dlp binary, fetch PO token from sidecar, init YouTube Music client, start Cast device mDNS discovery, init playback controller), `stop` (destroy client, stop discovery, destroy controller)
**Tools:** `search`, `play`, `pause`, `resume`, `stop`, `skip`, `queue_add`, `queue_view`, `set_volume`, `list_devices`, `my_playlists`, `liked_songs`, `like_song`, `unlike_song`, `get_playback_settings`, `update_playback_settings`
**Does:** YouTube Music playback on Cast devices (Chromecast, Google Home, Nest speakers). `play` accepts a search query or videoId and resolves a target Cast device by name (or uses last-used). Radio/autoplay mode keeps music playing after the current track ends. `update_playback_settings` persists changes to PluginConfig and triggers settings reload. `onSettingsChange('music')` resets PO token cache and reloads credentials and playback defaults.
**Dual auth architecture:** OAuth device-code tokens (stored in PluginConfig) are used with TVHTML5 Innertube client context (`innertube-api.ts`) for authenticated operations: search, playlists, liked songs, like/unlike. Stream URL resolution uses `yt-dlp` as a subprocess (`resolve-stream-url.ts`) because youtubei.js's decipher is broken (returns empty strings as of v17.0.1). yt-dlp handles cipher rotation, PO tokens, and all YouTube-side auth internally and updates far more frequently than youtubei.js.
**External dependencies:** `yt-dlp` must be installed on the host (`brew install yt-dlp`). `bgutil-ytdlp-pot-provider` Docker sidecar (port 4416) auto-generates Proof-of-Origin tokens with 6h TTL. Both are checked/logged on startup.
**Key behavior:** Settings schema defines YouTube OAuth credentials, PO token server URL (default `http://localhost:4416`), manual PO token override, default volume, radio toggle, and audio quality. PO token is fetched fresh from the sidecar (5h local cache) for each stream resolution — not stale module state.

### playwright plugin
**Hooks:** `onPipelineComplete`
**Lifecycle:** `start` (launch headless Chromium browser), `stop` (close browser, cleanup all temp files)
**Tools:** `navigate`, `snapshot`, `click`, `fill`, `select_option`, `check`, `screenshot`, `press_key`, `start_recording`, `stop_recording`, `validate_pages`
**Does:** Browser automation for E2E testing and visual capture. Each thread gets its own browser page that persists across tool calls within a pipeline run. `screenshot` persists images as File records via `ctx.uploadFile` — visible inline in the chat UI. `start_recording`/`stop_recording` capture WebM video at 1280x720. `validate_pages` batch-screenshots a list of URLs. `onPipelineComplete` is a safety net: cleans up any open recording state, removes temp files for the trace, and closes the thread's browser page.
**Key behavior:** `snapshot` returns an accessibility tree (not a visual screenshot) — preferred for understanding page structure. Per-thread page isolation prevents cross-thread interference.

### logs plugin
**Tools:** `query`
**Does:** Searches structured logs from the running Harness instance. Dual backend: prefers Loki (via `LOKI_URL`) for LogQL queries, falls back to rotating log files (via `LOG_FILE`) for JSON-line parsing. Filters by level, source (plugin name), threadId, traceId, text search, and time window. `errorsOnly` flag reads from a dedicated error log file for faster diagnosis. Default time window is 15 minutes.
**Key behavior:** No hooks or lifecycle methods. Designed as a diagnostic companion for the playwright plugin — when Playwright tests fail, query logs by threadId to find related errors.

### ssh plugin
**Hooks:** `onSettingsChange`
**Lifecycle:** `start` (log ready), `stop` (release all pooled connections)
**Tools:** `exec`, `list_hosts`, `add_host`, `remove_host`, `test_connection`
**Does:** Remote command execution via SSH. `exec` connects to a registered `SshHost` record, runs a command with configurable timeout, and returns stdout/stderr/exit code. Commands are logged to the database with duration and agent context. `test_connection` verifies connectivity and saves the host key fingerprint on first connection (TOFU — Trust On First Use). `add_host` registers hosts; private keys must be configured separately via admin UI. Connection pool reuses SSH sessions across tool calls.
**Key behavior:** Requires `HARNESS_ENCRYPTION_KEY` for secure private key storage. `onSettingsChange('ssh')` reloads timeout and pool settings. Error responses are classified by category (AUTH_FAILED, TIMEOUT, CONNECTION_FAILED, HOST_KEY_CHANGED).
