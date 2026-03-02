# Web Plugin — Implementation Notes for Claude Code

Read this before editing any file in `packages/plugins/web/`.

## Fire-and-forget is intentional

`POST /api/chat` calls `onChatMessage`, which calls `ctx.sendToThread()` without awaiting it. The HTTP response returns `{ success: true }` before Claude has produced a single token. This is not a bug. The browser learns the pipeline is done via the `pipeline:complete` WebSocket event. Do not add `await` to the `sendToThread` call.

Errors from `sendToThread` are caught per-call and logged. They are not surfaced to the HTTP caller.

## `onBroadcast` is the only path to the browser

Every `ctx.broadcast(event, data)` call in the entire orchestrator — across all plugins — flows through this plugin's `onBroadcast` hook and out to WebSocket clients. There is no other delivery path. If a browser client is not receiving events, the problem is either: (1) the broadcast event was never fired, (2) the WebSocket connection is not open, or (3) serialization failed.

The broadcaster silently drops non-OPEN clients (`readyState !== OPEN`) on every `broadcast()` call. It does not close or evict them — they stay in the `clients` Set until they emit a `close` or `error` event. A client that stops reading but does not disconnect will keep receiving send attempts until it errors.

## WebSocket error isolation

Client errors are caught per-client inside a `try/catch` in the broadcast loop (`ws-broadcaster.ts`). One bad client will not prevent other clients from receiving the message. On send error, the client is deleted from the `clients` Set immediately.

## Mutable module-level state

`src/index.ts` declares a module-level `state` object holding `server` and `broadcaster` references. These are set during `register()` and read during `start()` and `stop()`. There is only ever one instance of this plugin per orchestrator process. Do not restructure this into constructor arguments — `register()` and `start()` are called by the orchestrator at different lifecycle points, so state must persist between them.

If `register()` has not been called before `start()`, the plugin throws. This is intentional.

## `ctx.invoker.prewarm` is optional

The `prewarm` method on the invoker is typed as optional. `POST /api/prewarm` checks for its existence before calling it (`if (ctx.invoker.prewarm)`). Do not remove this guard. If the invoker implementation does not expose `prewarm`, the endpoint still returns `{ success: true }` — the prewarm is silently skipped.

## CORS is wide open

`cors({ origin: true, credentials: true })` accepts requests from any origin. This is intentional for local development. Do not narrow this without understanding the deployment topology — the Next.js app and the orchestrator may run on different ports or domains.

## No pagination on list endpoints

`GET /api/threads` and `GET /api/tasks` fetch every record in the database, ordered by date. There is no cursor, no `limit` parameter, no pagination. At scale this will be slow. If you need to add pagination, add it to the routes in `_helpers/routes.ts` — do not add a new helper file just for pagination logic.

`GET /api/metrics` is the exception: it has a hardcoded `take: 100`.

## Shutdown order matters

`stop()` calls `broadcaster.close()` before `server.close()`. The broadcaster closes all WebSocket connections and waits for the `WebSocketServer` to close. Only then does the HTTP server close. Do not reverse this order — closing the HTTP server first would leave the WebSocket upgrade path broken while clients are still connected.

## Plugin reload endpoint

`POST /api/plugins/:name/reload` calls `ctx.notifySettingsChange(name)`. This is a `PluginContext` method, not a WebSocket broadcast. It triggers a settings-change notification inside the orchestrator for the named plugin. The implementation of what happens on receipt is the plugin's own responsibility.

## File layout

```
src/
  index.ts                    — plugin lifecycle: register, start, stop; onBroadcast hook
  _helpers/
    routes.ts                 — Express app and all route handlers
    ws-broadcaster.ts         — WebSocketServer wrapper; broadcast loop; client lifecycle
    __tests__/
      ws-broadcaster.test.ts  — broadcaster unit tests
```

`routes.ts` is the only place HTTP route definitions live. `ws-broadcaster.ts` owns all WebSocket logic. `index.ts` wires them together and implements the plugin lifecycle.
