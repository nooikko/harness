# Plan: Morning News Digest (Discord)

## Summary

A cron job + prompt configuration that sends a daily curated news digest via Discord at a configurable time. The agent searches the web for specified topics (tech news, trans news, custom topics), formats a digest, and sends it to a designated Discord channel/thread.

## Design Decisions

- **Not a new plugin** — this is a CronJob configuration + a good prompt + web search capability. The existing cron, discord, and delegation plugins handle the infrastructure.
- **Web search via MCP tool** — needs a web search tool for the agent to use. Options: add a `web-search` plugin, or configure an MCP server (Brave Search, Tavily, etc.).
- **Configurable topics** — stored in the CronJob prompt itself or in a dedicated "digest config" that the agent reads from project memory.
- **Discord delivery** — cron fires `sendToThread` → assistant response → `pipeline:complete` broadcast → discord plugin's `onBroadcast` delivers to Discord.

## Prerequisites

1. **Discord plugin connected and delivering messages** (from Tier 3 #10-11 — already done)
2. **Web search capability** — the agent needs a tool to search the web
3. **Cron system working** (verified via cron-calendar-followups plan)

## Web Search Plugin: `@harness/plugin-web-search`

Since the agent needs to search the web for news, a search tool is required.

### Option A: Brave Search API (recommended — generous free tier)

```typescript
const webSearchPlugin: PluginDefinition = {
  name: "web-search",
  version: "1.0.0",
  tools: [{
    name: "search_web",
    description: "Search the web for current information. Returns titles, URLs, and snippets.",
    schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        count: { type: "number", description: "Number of results (max 20, default 10)" },
        freshness: { type: "string", description: "Recency filter: 'day', 'week', 'month'" },
      },
      required: ["query"],
    },
    handler: async (ctx, input) => {
      // Call Brave Search API
      // Return formatted results: title, URL, snippet, date
    },
  }, {
    name: "fetch_page",
    description: "Fetch and extract text content from a URL.",
    schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
      },
      required: ["url"],
    },
    handler: async (ctx, input) => {
      // Fetch URL, extract readable text (use readability algorithm)
      // Return cleaned text content
    },
  }],
  register: async (ctx) => ({}),
};
```

### Environment Variable

```env
BRAVE_SEARCH_API_KEY=<from Brave Search API dashboard>
```

### Option B: Tavily API (alternative — built for AI agents)

Same tool interface, different backend. Tavily is designed for AI agent use with better relevance. Also has a free tier.

## CronJob Configuration

### Seed a News Digest Job

```typescript
{
  name: "Morning News Digest",
  schedule: "0 14 30 * * *", // 7:30am MST (14:30 UTC) — adjust for daylight saving
  agentId: "<default-agent-id>",
  threadId: null, // Auto-create thread on first fire
  projectId: null,
  enabled: true,
  prompt: `You are delivering the morning news digest. Today's date: /current-time

Search for and compile a concise digest covering these topics:
1. **Tech News** — Major developments in AI, software, and tech industry
2. **Trans News** — Policy changes, legal updates, community news, healthcare developments
3. **General Interest** — Any breaking news or notable events

For each topic area:
- Search for news from the last 24 hours
- Select 3-5 most relevant/important items
- For each item: headline, 1-2 sentence summary, source link
- Flag anything that seems directly relevant or actionable

Format the digest clearly with sections and bullet points. Keep it scannable — this is a morning briefing, not a deep dive.

End with a "Worth Reading" section of 1-2 longer articles that look particularly interesting.`,
}
```

### Making Topics Configurable

Store topic configuration in project memory or as a separate config:

**Option 1: Project memory** — Agent reads from `Project.memory` to get topic list. User can say "add crypto news to my morning digest" → agent updates project memory.

**Option 2: CronJob prompt update** — Agent modifies the CronJob prompt directly via a new `cron__update_task` MCP tool (or the agent-malleable plugins plan handles this).

**Recommendation:** Option 2, since the prompt IS the configuration. The agent-malleable plugins plan adds `cron__update_task` which enables this naturally.

## Discord Delivery Chain

```
Cron fires at 7:30am MST
  → sendToThread(threadId, prompt)
    → handleMessage pipeline runs
      → Agent calls web_search tools, compiles digest
      → Assistant response written to thread
    → pipeline:complete broadcast
      → Discord plugin onBroadcast
        → Sends message to Discord channel
```

**Thread-to-Discord mapping**: The cron thread needs to be linked to a Discord channel. Options:
1. Use the existing `Thread.source` / `Thread.sourceId` fields (set source to "discord", sourceId to channel ID)
2. Or: Discord plugin looks up any thread that has a linked Discord channel via a mapping table

The simplest approach: create the cron thread with `source: "discord"` and `sourceId: "<discord-channel-id>"`. The discord plugin already knows how to route messages back to channels based on thread source.

## Implementation Steps

### Step 1: Web Search Plugin
- Create `packages/plugins/web-search/`
- Implement `search_web` and `fetch_page` tools
- Register in `ALL_PLUGINS`
- Get Brave Search API key (or Tavily)

### Step 2: Configure CronJob
- Update seed data with the Morning News Digest job
- Or create via admin UI
- Set appropriate schedule (7:30am MST)
- Link to a Discord-sourced thread

### Step 3: Test End-to-End
- Fire the cron job manually (or set fireAt to 2 minutes from now)
- Verify: agent searches web, compiles digest, sends to Discord
- Check formatting looks good in Discord

### Step 4: Topic Customization
- Enable prompt modification via agent-malleable plugins (or MCP tool)
- Test: "add crypto news to my morning digest" → agent updates the cron job prompt

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/plugins/web-search/src/index.ts` | Create | Web search plugin with search + fetch tools |
| `packages/plugins/web-search/src/_helpers/brave-search.ts` | Create | Brave Search API client |
| `packages/plugins/web-search/src/_helpers/extract-readable.ts` | Create | HTML → readable text |
| `apps/orchestrator/src/plugin-registry/index.ts` | Modify | Register web-search plugin |
| `packages/database/prisma/_helpers/cron-job-definitions.ts` | Modify | Update Morning Digest prompt |

## Dependencies

```json
{
  "@anthropic-ai/sdk": "already present",
  "linkedom": "^0.16.0"
}
```

(linkedom for lightweight HTML parsing / text extraction — lighter than jsdom)

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Brave Search API rate limits on free tier | Cache results, limit to 3-5 searches per digest |
| Discord message too long (2000 char limit) | Split into multiple messages, or use Discord embeds |
| Agent hallucinating news | Require source URLs for every claim; use `fetch_page` to verify |
| Stale news (searching "last 24 hours" but nothing new) | Fallback: extend to 48 hours, note "quiet news day" |
