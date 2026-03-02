# @harness/plugin-web

The web plugin is the HTTP and WebSocket bridge between the Next.js dashboard and the orchestrator pipeline. It gives the web frontend a way to send messages to Claude and receive real-time updates as the pipeline runs.

## What it does

When a user sends a message in the web dashboard, it travels through a Next.js server action, hits `POST /api/chat` on this plugin, and is handed off to the orchestrator pipeline. The HTTP response returns immediately — before Claude has finished. The browser learns the pipeline is complete via a `pipeline:complete` WebSocket event pushed over a persistent connection at `/ws`.

The plugin also exposes read-only REST endpoints for browsing threads, tasks, and recent metrics, and a `/api/prewarm` endpoint the dashboard can call to warm up a Claude session before the user starts typing.

## Why it exists

The orchestrator is a Node.js service, not a Next.js app. It has no built-in HTTP layer. This plugin provides that layer without coupling the orchestrator core to any particular transport. The web dashboard gets fire-and-forget chat submission and real-time pipeline visibility; the orchestrator stays clean.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| POST | `/api/chat` | Submit a message to a thread |
| POST | `/api/prewarm` | Pre-warm a Claude session for a thread |
| POST | `/api/plugins/:name/reload` | Notify a plugin of a settings change |
| GET | `/api/threads` | List all threads |
| GET | `/api/tasks` | List all orchestrator tasks |
| GET | `/api/metrics` | List the 100 most recent metrics |

## WebSocket

Connect to `/ws` on the same port as the HTTP server. The server pushes JSON messages for every orchestrator event. Any call to `ctx.broadcast()` anywhere in the system reaches connected clients through this channel.

Wire format:

```json
{ "event": "pipeline:complete", "data": { ... }, "timestamp": 1234567890 }
```
