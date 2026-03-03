# CLAUDE.md — @harness/plugin-discord

Implementation notes and gotchas for the Discord plugin. Read this before editing any file in this package.

## What hooks this plugin implements

This plugin implements **only** `start` and `stop` lifecycle hooks, plus `onSettingsChange`. It does not implement `onCommand`, `onBeforeInvoke`, `onAfterInvoke`, or `onBroadcast`. It is purely a message source and message sink — it does not participate in the prompt transformation or command handling pipeline at all.

Do not add pipeline hooks to this plugin without a clear reason. If you need to intercept or modify Claude's output before it reaches Discord, consider a separate plugin or a new hook type rather than entangling Discord delivery with prompt logic.

## Token resolution order

The plugin resolves its bot token in this order:

1. `PluginConfig.botToken` from the database
2. `DISCORD_TOKEN` environment variable

If neither is available, the plugin starts in a degraded state — it logs a warning but does not throw. This is intentional: the orchestrator should start successfully even without Discord configured. Treat a missing token as a soft failure, not a hard one.

Token reload is supported without restarting the orchestrator. When `onSettingsChange` fires with a new `botToken`, the plugin disconnects the current Discord client and reconnects with the new token. Do not cache the token in a module-level variable; always read from the current config.

## Message filtering rules

The plugin applies two filters before routing a message to the orchestrator:

1. **Bot messages are always ignored.** This prevents infinite loops if another bot or the Harness bot itself posts in a channel.
2. **Guild messages require an @mention.** DMs are passed through unconditionally. Guild messages without a direct mention of the bot are silently dropped.

The mention check uses Discord.js's `message.mentions.has(client.user)`. Do not simplify this to a string search on the message content — Discord's mention format includes the user ID and can appear anywhere in the message.

## Mention stripping

Before the message content is sent to the orchestrator, the bot's own mention (`<@BOT_ID>`) is stripped from the beginning of the content. This means the prompt Claude receives does not contain the mention prefix.

This stripping loses the fact that the message came via mention. Claude has no way to know it was @mentioned vs. receiving a DM. This is acceptable because mention context is not meaningful to the pipeline, but keep it in mind if you add mention-aware behavior in the future.

## Message splitting

Discord enforces a 2000-character limit per message. Claude's responses often exceed this. The plugin splits long responses at natural boundaries in this order of preference:

1. Double newlines (paragraph breaks)
2. Single newlines
3. Word boundaries (spaces)
4. Hard cut at 2000 characters if no break is found

Each split chunk is sent as a separate Discord message in sequence. There is no batching or delay between chunks — they are sent immediately. If Discord rate-limits the bot, the error will surface as an unhandled rejection on the send call. Rate limiting is not currently handled gracefully.

## Upsert race condition

When a message arrives from a guild channel the bot has not seen before, the plugin upserts a `Thread` record keyed on the channel ID. Concurrent messages in the same new channel can race and both attempt the upsert simultaneously, triggering a Prisma `P2002` unique constraint violation.

The plugin catches `P2002`, re-fetches the thread that the winning upsert created, and retries with the existing thread. This is logged at `debug` level, not `error` — it is expected behavior under load, not a bug.

If you see `P2002` errors at `error` level or unhandled rejections from thread upserts, something changed in this retry logic.

## Connection status broadcasting

When the Discord client connects, disconnects, or encounters an error, the plugin calls `ctx.broadcast('discord:connection', { status, ... })`.

These broadcasts are fire-and-forget — they are not awaited. A failure to broadcast connection status should not abort the connection lifecycle. Do not add `await` to these calls.

The `discord:connection` event is consumed by the web plugin's `onBroadcast` hook, which forwards it to the browser over WebSocket so the dashboard can display connection state.

## Start/stop lifecycle

`start` is where the Discord client is created and the gateway connection is established. `stop` disconnects the client and cleans up listeners.

The plugin is designed to tolerate `stop` being called before `start` completes (e.g., if the orchestrator shuts down immediately after startup). Guard any cleanup logic against a null or uninitialized client.

If the Discord token is invalid, Discord.js will throw during `start`. This exception propagates to the plugin loader. The orchestrator will log it but continue running — other plugins are not affected.

## No onBroadcast hook

The Discord plugin does not listen to `onBroadcast` events. It does not forward pipeline events or other orchestrator activity to Discord. If you want to post pipeline notifications or alerts to a Discord channel, that is a separate concern — either a new plugin or an extension of this one — but it would require adding an `onBroadcast` implementation and deciding which events to forward and to which channel.
