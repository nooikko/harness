# Plan: Microsoft Graph API Integration (Email + Calendar)

## Summary

Two plugins (`@harness/plugin-outlook` and `@harness/plugin-calendar`) that integrate with Microsoft Graph API for Outlook email and Calendar operations. A shared OAuth package handles authentication for both (and future Microsoft integrations).

## Design Decisions

- **Shared OAuth package: `packages/oauth/`** — stores OAuth tokens in a new `OAuthToken` model. Both plugins (and future ones) use this for token acquisition/refresh. This avoids duplicating auth logic.
- **Two separate plugins** — email and calendar have distinct MCP tool sets and different permission scopes. Keeping them separate lets you disable one without the other.
- **Azure AD App Registration** — Quinn will create this manually. The app needs `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.Read`, `Calendars.ReadWrite` delegated permissions.
- **Token storage in DB** — `OAuthToken` model with encrypted refresh token, auto-refresh on expiry via the shared package.
- **No webhook/push notifications initially** — plugins poll on demand via MCP tools. Push notifications (Graph subscriptions) can be added later for real-time calendar change events.

## Schema

```prisma
model OAuthToken {
  id            String   @id @default(cuid())
  provider      String   // "microsoft", "google", "discord", etc.
  accountId     String   // Provider-specific user ID
  accessToken   String   @db.Text
  refreshToken  String?  @db.Text
  expiresAt     DateTime
  scopes        String[] // ["Mail.Read", "Calendars.ReadWrite", ...]
  metadata      Json?    // Provider-specific data (email, display name)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([provider, accountId])
  @@index([provider])
}
```

## Package: `packages/oauth/`

Shared OAuth2 utilities (not a plugin — a library package).

### Exports

```typescript
// Core
export { getValidToken } from "./get-valid-token";      // Returns fresh access token, auto-refreshes if expired
export { startOAuthFlow } from "./start-oauth-flow";    // Generates auth URL + state
export { handleOAuthCallback } from "./handle-callback"; // Exchanges code for tokens, stores in DB
export { revokeToken } from "./revoke-token";            // Revokes and deletes token record

// Microsoft-specific
export { microsoftConfig } from "./providers/microsoft"; // Client ID, tenant, endpoints, scopes
```

### OAuth Flow

1. User visits `/admin/integrations` → clicks "Connect Microsoft Account"
2. Redirected to Azure AD consent screen
3. Callback to `/api/oauth/callback?code=...&state=...`
4. `handleOAuthCallback` exchanges code → stores tokens in `OAuthToken`
5. Plugins call `getValidToken("microsoft")` — auto-refreshes if within 5min of expiry

### Environment Variables

```env
MICROSOFT_CLIENT_ID=<from Azure portal>
MICROSOFT_CLIENT_SECRET=<from Azure portal>
MICROSOFT_TENANT_ID=<"common" for personal, or specific tenant>
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/oauth/callback
OAUTH_ENCRYPTION_KEY=<32-byte key for token encryption at rest>
```

## Plugin: `@harness/plugin-outlook`

### MCP Tools

| Tool | Description |
|------|-------------|
| `outlook__search_emails` | Search emails by query string (KQL syntax). Returns subject, from, date, snippet, ID. |
| `outlook__read_email` | Read full email body by ID. Returns HTML body, attachments list, headers. |
| `outlook__list_recent` | List recent emails (inbox, sent, or folder). Paginated. |
| `outlook__send_email` | Send an email (to, cc, bcc, subject, body). |
| `outlook__reply_email` | Reply to an email by ID. |
| `outlook__move_email` | Move email to folder (archive, trash, etc.). |
| `outlook__list_folders` | List mail folders. |
| `outlook__find_unsubscribe_links` | Search for emails with "unsubscribe", extract unsubscribe links from body HTML. Returns list of sender + link pairs. |

### Key Implementation Details

- **Graph SDK**: Use `@microsoft/microsoft-graph-client` with auth provider from shared OAuth package
- **HTML parsing for unsubscribe**: Use `cheerio` to find `<a>` tags containing "unsubscribe" in href or text
- **Rate limiting**: Graph API has per-mailbox limits. Queue requests with 100ms delay between calls.
- **Pagination**: All list operations support `$top` and `$skip` via Graph API OData params

### Plugin Shape

```typescript
const outlookPlugin: PluginDefinition = {
  name: "outlook",
  version: "1.0.0",
  tools: [searchEmails, readEmail, listRecent, sendEmail, replyEmail, moveEmail, listFolders, findUnsubscribeLinks],
  register: async (ctx) => ({}), // No hooks — tool-only plugin
};
```

## Plugin: `@harness/plugin-calendar`

### MCP Tools

| Tool | Description |
|------|-------------|
| `calendar__list_events` | List upcoming events (today, this week, date range). Returns title, time, location, attendees. |
| `calendar__get_event` | Get full event details by ID. |
| `calendar__create_event` | Create a calendar event (subject, start, end, location, attendees, body). |
| `calendar__update_event` | Update event fields by ID. |
| `calendar__delete_event` | Delete/cancel an event by ID. |
| `calendar__find_free_time` | Find available time slots in a date range. Uses Graph `findMeetingTimes` API. |
| `calendar__list_calendars` | List available calendars (personal, shared, etc.). |

### Key Implementation Details

- **Timezone handling**: All times stored/returned in UTC. Display conversion happens in the tool response using `config.timezone` (America/Phoenix).
- **Recurring events**: Graph API handles recurrence natively. `create_event` accepts optional `recurrence` pattern.
- **Cross-plugin integration**: Calendar + Outlook combo (e.g., "find confirmation email and add to calendar") happens naturally — the agent calls `outlook__search_emails`, extracts event details, then calls `calendar__create_event`. No special inter-plugin wiring needed.

### Plugin Shape

```typescript
const calendarPlugin: PluginDefinition = {
  name: "calendar",
  version: "1.0.0",
  tools: [listEvents, getEvent, createEvent, updateEvent, deleteEvent, findFreeTime, listCalendars],
  register: async (ctx) => ({}), // No hooks — tool-only plugin
};
```

## UI: Integration Management

### Route: `/admin/integrations`

New admin page for managing OAuth connections.

- **Connected accounts list** — shows provider, email, connected date, scopes
- **Connect button** — initiates OAuth flow
- **Disconnect button** — revokes token, deletes record
- **Status indicator** — green (valid token), yellow (expiring soon), red (expired/revoked)

### Route: `/api/oauth/callback`

Next.js API route that handles the OAuth redirect callback.

## Implementation Steps

### Step 1: Schema + OAuth Package
- Add `OAuthToken` model to schema
- Create `packages/oauth/` with Microsoft provider config
- Implement `startOAuthFlow`, `handleOAuthCallback`, `getValidToken`, `revokeToken`
- Add encryption for token storage at rest

### Step 2: OAuth UI + API Route
- Create `/api/oauth/callback` route handler
- Create `/admin/integrations` page with connect/disconnect UI
- Wire up the OAuth flow end-to-end

### Step 3: Outlook Plugin
- Create `packages/plugins/outlook/` with standard structure
- Implement Graph client factory using shared OAuth
- Implement 8 MCP tools (start with `search_emails`, `read_email`, `list_recent`)
- Register in `ALL_PLUGINS`
- Tests for each tool handler (mock Graph API responses)

### Step 4: Calendar Plugin
- Create `packages/plugins/calendar/` with standard structure
- Implement 7 MCP tools
- Register in `ALL_PLUGINS`
- Tests for each tool handler

### Step 5: Cross-Plugin Scenarios
- Test: "find confirmation email and add to calendar"
- Test: "what's on my calendar tomorrow?"
- Test: "find unsubscribe links"

### Step 6: Admin UI Polish
- Token expiry monitoring
- Scope display
- Re-auth flow for expired tokens

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/database/prisma/schema.prisma` | Modify | Add OAuthToken model |
| `packages/oauth/src/index.ts` | Create | Shared OAuth2 utilities |
| `packages/oauth/src/providers/microsoft.ts` | Create | Microsoft-specific config |
| `packages/plugins/outlook/src/index.ts` | Create | Outlook plugin with 8 tools |
| `packages/plugins/calendar/src/index.ts` | Create | Calendar plugin with 7 tools |
| `apps/orchestrator/src/plugin-registry/index.ts` | Modify | Register both plugins |
| `apps/web/src/app/api/oauth/callback/route.ts` | Create | OAuth callback handler |
| `apps/web/src/app/admin/integrations/page.tsx` | Create | Integration management UI |

## Dependencies

```json
{
  "@microsoft/microsoft-graph-client": "^3.0.0",
  "cheerio": "^1.0.0"
}
```

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Token refresh race condition | Mutex on refresh — if two requests hit simultaneously, second waits for first's refresh |
| Graph API rate limits (10k req/10min) | Client-side rate limiter with exponential backoff |
| Large mailbox searches timeout | Limit results with `$top=50`, paginate via tool calls |
| Stale token after password change | Catch 401, surface "re-authenticate" message to user via tool response |
| Encryption key rotation | Store key version in `OAuthToken.metadata`, support decrypt with old key |
