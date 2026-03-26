# CLAUDE.md — @harness/plugin-discord

Implementation notes and gotchas for the Discord plugin. Read this before editing any file in this package.

## What hooks this plugin implements

This plugin implements `start` and `stop` lifecycle hooks, `onSettingsChange` for token/channel/owner reload, and `onBroadcast` for delivering assistant responses to Discord channels and proactive DMs. It exposes one MCP tool: `send_dm`. It does not implement `onBeforeInvoke`, `onAfterInvoke`, or `onMessage`. It is a message source, message sink, and proactive notifier — it does not participate in the prompt transformation pipeline.

Do not add pipeline hooks to this plugin without a clear reason. If you need to intercept or modify Claude's output before it reaches Discord, consider a separate plugin or a new hook type rather than entangling Discord delivery with prompt logic.

## DM routing to primary thread

DMs are routed to the **primary assistant thread** (kind: 'primary'), not a separate Discord thread. This means Discord DMs share the same conversation context, history, identity, and tools as the web UI. Guild channel messages still create per-channel threads with `source: 'discord'`.

When a DM arrives:
1. `resolvePrimaryThread` looks up the primary thread (cached for 5 minutes)
2. The user message is persisted with `metadata: { discordChannelId: 'discord:<channelId>' }`
3. The pipeline runs via `sendToThread` on the primary thread

If no primary thread exists (deleted or not seeded), the plugin falls back to the old behavior — creating a Discord-specific thread via upsert.

## Reply routing: metadata-based

The reply system uses **per-message metadata** instead of per-thread source to decide where to deliver responses. `sendDiscordReply` checks two paths:

1. **Thread-source path** (guild channels): `thread.source === 'discord'` → extract channel ID from `thread.sourceId`
2. **Metadata path** (DMs on primary thread): Find the most recent user message before the assistant response → check `metadata.discordChannelId`

This dual routing means:
- A Discord DM reply goes back to Discord, even though the thread is `source: 'system'`
- A web UI message on the same primary thread does NOT trigger Discord delivery
- Guild channel replies work unchanged via the thread-source path

## Proactive DM delivery

The plugin supports proactive messaging to the owner's Discord DM. Two mechanisms:

1. **`discord:send-dm` broadcast**: Any plugin can broadcast `ctx.broadcast('discord:send-dm', { content: '...' })` to send a DM. Requires `ownerDiscordUserId` in settings and a connected client.

2. **Cron pipeline forwarding**: When a `pipeline:complete` fires for a `kind: 'cron'` thread that is NOT already `source: 'discord'`, the assistant response is automatically forwarded to the owner's DM. This prevents double-delivery for cron threads that are already Discord-sourced.

Both paths use `sendProactiveDm` which calls `client.users.fetch(userId)` → `user.createDM()` → `channel.send()`.

## MCP tool: send_dm

The `discord__send_dm` tool lets Claude explicitly message the user on Discord during any pipeline run. Input: `{ message: string }`. Returns an error string if `ownerDiscordUserId` is not configured or the client is not connected.

## Token resolution order

The plugin resolves its bot token in this order:

1. `PluginConfig.botToken` from the database
2. `DISCORD_TOKEN` environment variable

If neither is available, the plugin starts in a degraded state — it logs a warning but does not throw.

Token reload is supported without restarting the orchestrator via `onSettingsChange`.

## Settings schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `botToken` | string (secret) | Yes | Discord bot token from Developer Portal |
| `allowedChannelIds` | string | No | Comma-separated channel IDs for guild filtering |
| `ownerDiscordUserId` | string | No | Your Discord user ID for proactive DM delivery |

## Message filtering rules

1. **Bot messages are always ignored.** Prevents infinite loops.
2. **Guild messages require an @mention.** DMs are passed through unconditionally.

## Partials requirement

The Discord.js client is created with `Partials.Channel` to receive DM `messageCreate` events. Without this partial, DMs are silently ignored by the Discord.js gateway.

## Mention stripping

The bot's own mention (`<@BOT_ID>`) is stripped from message content before it enters the pipeline. Claude receives clean text without the mention prefix.

## Message splitting

Discord's 2000-character limit is handled by splitting at natural boundaries: newlines → spaces → hard cut. Chunks are sent sequentially without delay.

## Upsert race condition

Guild channel thread upserts catch `P2002` unique constraint violations from concurrent messages. The plugin re-fetches the winning thread and retries. Logged at `debug` level — expected behavior, not a bug.

## Connection status broadcasting

`discord:connection` events are broadcast on connect, disconnect, and error. These are fire-and-forget and consumed by the web plugin for dashboard display.

## onBroadcast — events handled

| Event | Behavior |
|-------|----------|
| `discord:send-dm` | Sends proactive DM to `ownerDiscordUserId` |
| `pipeline:complete` | Delivers reply via `sendDiscordReply` + forwards cron output to DM |
| Other events | Ignored |
