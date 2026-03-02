# @harness/plugin-discord

The Discord plugin makes the Harness orchestrator accessible through Discord. Users can chat with Claude in any Discord channel or DM without needing the web dashboard.

## What it does

The plugin connects to Discord's gateway and listens for incoming messages. When a user sends a message in a watched channel or DM, that message is routed through the full Harness pipeline — the same pipeline the web interface uses. Claude's response is then sent back to the same Discord channel.

It works in both directions: Discord messages become prompts, and Claude's output becomes Discord replies.

## Why it exists

Not everyone wants a browser tab open to talk to Claude. Discord is where many teams already communicate. The Discord plugin meets users where they are, letting them invoke the orchestrator from any device that runs Discord, asynchronously, without opening a separate interface.

It also means you can build Discord bots backed by Claude without writing any bot infrastructure yourself — the orchestrator handles conversation threading, history, and the Claude session lifecycle.

## Configuration

The plugin requires a Discord bot token. Set it in one of two ways:

- **Database:** Store the token in the `PluginConfig` record for `discord` under the `botToken` field. This supports live reload without restarting the orchestrator.
- **Environment variable:** Set `DISCORD_TOKEN`. Used as a fallback when no database token is configured.

The bot must be invited to any guild (server) where you want it to respond, with permission to read and send messages.

## Triggering the bot

- **Direct messages:** The bot responds to all DMs unconditionally.
- **Guild channels:** The bot only responds when directly @mentioned. Messages without a mention are ignored.

To talk to the bot in a server channel, mention it at the start of your message: `@BotName what should I work on today?`
