# Research: Google Calendar API and OAuth 2.0 Integration (Node.js/TypeScript)
Date: 2026-03-19

## Summary
Comprehensive research into Google OAuth 2.0 authorization code flow, Google Calendar API v3 endpoints, token lifecycle management, npm package ecosystem, and Google Cloud Console setup requirements. Includes concrete TypeScript patterns and key differences from Microsoft Graph.

## Prior Research
None directly relevant. See `2026-03-18-microsoft-graph-integration.md` context in `.claude/plan/microsoft-graph-integration.md` for the Outlook/Calendar plugin already implemented in this project.

---

## 1. OAuth 2.0 Authorization Code Flow (Server-Side)

### Authorization Endpoint
```
GET https://accounts.google.com/o/oauth2/v2/auth
```

**Required parameters:**

| Parameter | Value |
|-----------|-------|
| `client_id` | From Google Cloud Console |
| `redirect_uri` | Your callback URL (must be pre-registered) |
| `response_type` | `code` |
| `scope` | Space-delimited scope URIs |

**Strongly recommended parameters:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `access_type` | `offline` | Required to receive a refresh token |
| `state` | Random hex string | CSRF protection — validate on callback |
| `include_granted_scopes` | `true` | Incremental authorization (add scopes later) |
| `prompt` | `consent` | Force consent screen (needed to get refresh token again if already authorized) |

### Token Exchange Endpoint
```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

code=AUTH_CODE&
client_id=CLIENT_ID&
client_secret=CLIENT_SECRET&
redirect_uri=REDIRECT_URI&
grant_type=authorization_code
```

### Token Response
```json
{
  "access_token": "ya29.xxx",
  "expires_in": 3600,
  "token_type": "Bearer",
  "refresh_token": "1//xxx",
  "scope": "https://www.googleapis.com/auth/calendar.readonly"
}
```

**Token lifetimes:**
- Access token: ~3600 seconds (1 hour)
- Refresh token: No fixed expiry — see Section 4 for revocation conditions

### Token Refresh
```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id=CLIENT_ID&
client_secret=CLIENT_SECRET&
refresh_token=REFRESH_TOKEN&
grant_type=refresh_token
```

Response: New `access_token` + updated `expires_in`. The refresh token is NOT rotated on each refresh (unlike Microsoft Graph).

---

## 2. OAuth 2.0 Scopes for Google Calendar

### Recommended Minimum Scopes for Read Access

| Scope URI | Description | Sensitivity |
|-----------|-------------|-------------|
| `https://www.googleapis.com/auth/calendar.readonly` | See and download any accessible calendar | Sensitive |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | List calendars user is subscribed to | Sensitive |
| `https://www.googleapis.com/auth/calendar.events.readonly` | View events on all calendars | Sensitive |

### Full Scope Reference

| Scope URI | Access Level | Notes |
|-----------|-------------|-------|
| `https://www.googleapis.com/auth/calendar` | Full — see/edit/share/delete | Triggers additional verification |
| `https://www.googleapis.com/auth/calendar.readonly` | Read-only — all calendars | Recommended for read-only integrations |
| `https://www.googleapis.com/auth/calendar.events` | Full event CRUD | |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Read events on all calendars | More granular than calendar.readonly |
| `https://www.googleapis.com/auth/calendar.events.owned` | CRUD events on owned calendars only | |
| `https://www.googleapis.com/auth/calendar.events.owned.readonly` | Read events on owned calendars only | |
| `https://www.googleapis.com/auth/calendar.events.public.readonly` | Read public calendar events only | |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | List subscribed calendars | |
| `https://www.googleapis.com/auth/calendar.calendars.readonly` | Read calendar properties | |
| `https://www.googleapis.com/auth/calendar.freebusy` | View availability | Non-sensitive |
| `https://www.googleapis.com/auth/calendar.settings.readonly` | Read Calendar settings | |

**Scope strategy for this project (read-only):**
Use the pair `calendar.calendarlist.readonly` + `calendar.events.readonly` for minimal access, or use `calendar.readonly` as a single broad read-only scope. Both are classified as "sensitive" and require verification for production external apps.

---

## 3. Google Calendar API v3 Endpoints

**Base URL:** `https://www.googleapis.com/calendar/v3`

**All requests require** `Authorization: Bearer {access_token}` header.

### 3a. List Calendars

```
GET https://www.googleapis.com/calendar/v3/users/me/calendarList
```

**Query parameters:**

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `maxResults` | integer | 100 | Max 250 |
| `minAccessRole` | string | — | `freeBusyReader`, `reader`, `writer`, `owner` |
| `pageToken` | string | — | Pagination |
| `showDeleted` | boolean | false | Include deleted |
| `showHidden` | boolean | false | Include hidden |
| `syncToken` | string | — | Incremental sync |

**Response:**
```json
{
  "kind": "calendar#calendarList",
  "items": [
    {
      "id": "primary",
      "summary": "Quinn's Calendar",
      "description": "...",
      "timeZone": "America/Phoenix",
      "accessRole": "owner",
      "primary": true,
      "selected": true,
      "backgroundColor": "#0088aa",
      "foregroundColor": "#ffffff"
    }
  ],
  "nextPageToken": "...",
  "nextSyncToken": "..."
}
```

**Key CalendarList resource fields:**
- `id` — Calendar identifier (use as `calendarId` in event calls; `primary` = logged-in user's primary)
- `summary` — Display name (read-only; use `summaryOverride` for custom name)
- `timeZone` — IANA timezone string
- `accessRole` — `freeBusyReader | reader | writer | owner`
- `primary` — boolean, true for primary calendar
- `selected` — boolean, whether shown in Calendar UI

### 3b. List Events (with Time Range Filtering)

```
GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
```

Use `primary` as `calendarId` for the user's primary calendar.

**Key query parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| `timeMin` | RFC3339 datetime | Lower bound (exclusive) for event end time |
| `timeMax` | RFC3339 datetime | Upper bound (exclusive) for event start time |
| `singleEvents` | boolean | `true` = expand recurring events into instances |
| `orderBy` | string | `startTime` (requires `singleEvents=true`) or `updated` |
| `maxResults` | integer | Default 250, max 2500 |
| `pageToken` | string | Pagination |
| `syncToken` | string | Incremental sync — use instead of time range |
| `q` | string | Full-text search filter |

**RFC3339 datetime format required:** `2026-03-19T00:00:00-07:00` (timezone offset mandatory)

**Example — get this week's events:**
```
GET /calendars/primary/events
  ?timeMin=2026-03-16T00:00:00-07:00
  &timeMax=2026-03-23T00:00:00-07:00
  &singleEvents=true
  &orderBy=startTime
```

**Response:**
```json
{
  "kind": "calendar#events",
  "items": [...],
  "nextPageToken": "...",
  "nextSyncToken": "..."
}
```

### 3c. Get Event Details

```
GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}
```

**Optional query parameters:**
- `maxAttendees` — integer, limits attendees list size
- `timeZone` — string, IANA timezone for response datetimes

**Event resource fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Google Calendar event ID |
| `summary` | string | Event title |
| `description` | string | Can contain HTML |
| `location` | string | Free-form location text |
| `status` | string | `confirmed`, `tentative`, `cancelled` |
| `visibility` | string | `default`, `public`, `private`, `confidential` |
| `htmlLink` | string | Link to event in Google Calendar UI |
| `start.dateTime` | RFC3339 | Timed event start |
| `start.date` | date | All-day event start (`yyyy-mm-dd`) |
| `start.timeZone` | string | IANA timezone |
| `end.dateTime` | RFC3339 | Timed event end (exclusive) |
| `end.date` | date | All-day event end (exclusive) |
| `attendees[]` | array | `{email, displayName, responseStatus, organizer, optional}` |
| `organizer` | object | `{email, displayName, self}` |
| `creator` | object | `{email, displayName, self}` |
| `recurrence[]` | string[] | RRULE/EXRULE/RDATE/EXDATE per RFC5545 |
| `recurringEventId` | string | Parent event ID for recurring instances |
| `originalStartTime` | object | Original start for recurring instances |
| `reminders` | object | `{useDefault, overrides: [{method, minutes}]}` |
| `conferenceData` | object | Google Meet details |

**Attendee `responseStatus` values:** `accepted`, `declined`, `tentative`, `needsAction`

---

## 4. Token Refresh Mechanism

### Access Token Expiry
Access tokens expire after 3600 seconds (1 hour). The `googleapis` library handles refresh **automatically** when `setCredentials(tokens)` has been called with a valid refresh token.

### Manual Refresh
```typescript
const { credentials } = await oauth2Client.refreshAccessToken();
oauth2Client.setCredentials(credentials);
// Save updated credentials to DB — expires_in resets
```

### Refresh Token Revocation Conditions
Refresh tokens become invalid (`invalid_grant` error) when:

1. **User revokes access** — via Google Account settings
2. **6-month inactivity** — refresh token unused for 6 months
3. **Password change** — when Gmail scopes are included
4. **Token limit exceeded** — 100 refresh tokens per client/user combination; issuing a 101st silently invalidates the oldest
5. **Time-based access** — if user granted temporary access that expired
6. **Admin policy** — Google Workspace admins can restrict OAuth
7. **Consent screen not verified** — unverified external apps: refresh tokens expire in 7 days if app is in "Testing" status

**Critical:** Refresh tokens are issued **only once** during the initial authorization code exchange. Store them permanently. Re-obtaining requires re-running the full auth flow (or using `prompt=consent` to force re-consent).

**Handling `invalid_grant`:**
```typescript
try {
  await oauth2Client.refreshAccessToken();
} catch (error) {
  if (error.message?.includes('invalid_grant')) {
    // Token revoked — must re-authorize user from scratch
    // Delete stored tokens, redirect to auth URL
  }
}
```

---

## 5. Google Cloud Console Setup

### Step 1: Create or Select a Project
- Go to `https://console.cloud.google.com/`
- Create a new project or select existing

### Step 2: Enable Google Calendar API
- APIs & Services > Library
- Search "Google Calendar API" > Enable

### Step 3: Configure OAuth Consent Screen
- APIs & Services > OAuth consent screen
- Choose app type:
  - **Internal** — Only users within your Google Workspace org. No verification required. Scopes don't require review.
  - **External** — Any Google user. Requires verification for sensitive/restricted scopes.

**Required fields:**
- App name
- User support email
- Developer contact email (for Google notifications)
- Agreement to Google API Services User Data Policy

**Scope review tiers (External apps only):**
| Tier | Review needed | Calendar scopes affected |
|------|--------------|--------------------------|
| Non-sensitive | Basic (logo/links) | `calendar.freebusy` |
| Sensitive | Additional review | `calendar.readonly`, `calendar.events.readonly`, etc. |
| Restricted | Security assessment | `calendar` (full access) |

**Testing mode limitations:**
- External apps in "Testing" status: only explicitly added test users can authorize
- Refresh tokens issued to testing apps expire in **7 days**
- Must publish app to production for persistent tokens

### Step 4: Create OAuth 2.0 Credentials
- APIs & Services > Credentials > Create Credentials > OAuth Client ID
- Application type: **Web application**
- Add authorized redirect URIs (e.g., `http://localhost:3000/api/auth/google/callback`)
- Download credentials JSON: contains `client_id` and `client_secret`

**Important:** Redirect URIs must be registered exactly. `localhost` URIs are allowed for development.

---

## 6. npm Packages

### `googleapis` (primary package)
```bash
npm install googleapis
```
- Includes the full Google API Node.js client
- TypeScript types included
- Provides `google.auth.OAuth2` client
- Auto-handles token refresh when credentials are set
- Wraps all Google APIs (Calendar, Drive, Gmail, etc.) with typed methods

**Key classes:**
```typescript
import { google } from "googleapis";

// Create auth client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Get Calendar service
const calendar = google.calendar({ version: "v3", auth: oauth2Client });
```

### `google-auth-library` (lower-level)
```bash
npm install google-auth-library
```
- The auth layer used internally by `googleapis`
- Can be used standalone if you don't need the full `googleapis` bundle
- Exports `OAuth2Client`, `GoogleAuth`, `JWT`, etc.
- `googleapis` re-exports `google.auth.OAuth2` from this library

**Recommendation:** Use `googleapis` as the single dependency — it bundles `google-auth-library` and provides the Calendar API typed methods. Only use `google-auth-library` standalone if you want to reduce bundle size and handle raw HTTP calls yourself.

### Individual API packages (alternative)
```bash
npm install @googleapis/calendar
```
- Lighter alternative: only includes Calendar API types/methods
- Same auth — still needs `google-auth-library` or `googleapis` for `OAuth2Client`

---

## 7. TypeScript Code Patterns

### OAuth2 Flow Implementation

```typescript
import { google } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

type CreateOAuth2Client = () => OAuth2Client;
const createOAuth2Client: CreateOAuth2Client = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

// Step 1: Generate auth URL
type GetAuthUrl = (state: string) => string;
const getAuthUrl: GetAuthUrl = (state) => {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    include_granted_scopes: true,
    state,
    prompt: "consent", // Required to always get refresh token
  });
};

// Step 2: Exchange code for tokens
type ExchangeCode = (code: string) => Promise<Credentials>;
const exchangeCode: ExchangeCode = async (code) => {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
};

// Step 3: Create authenticated client from stored tokens
type GetAuthenticatedClient = (tokens: Credentials) => OAuth2Client;
const getAuthenticatedClient: GetAuthenticatedClient = (tokens) => {
  const client = createOAuth2Client();
  client.setCredentials(tokens);
  return client;
};
```

### Listing Calendars

```typescript
import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";

type ListCalendars = (
  auth: OAuth2Client
) => Promise<calendar_v3.Schema$CalendarListEntry[]>;
const listCalendars: ListCalendars = async (auth) => {
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.calendarList.list({
    minAccessRole: "reader",
  });
  return response.data.items ?? [];
};
```

### Listing Events with Time Range

```typescript
type ListEvents = (
  auth: OAuth2Client,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
) => Promise<calendar_v3.Schema$Event[]>;
const listEvents: ListEvents = async (auth, calendarId, timeMin, timeMax) => {
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,       // Expand recurring events into instances
    orderBy: "startTime",
    maxResults: 250,
  });
  return response.data.items ?? [];
};
```

### Getting Event Details

```typescript
type GetEvent = (
  auth: OAuth2Client,
  calendarId: string,
  eventId: string
) => Promise<calendar_v3.Schema$Event>;
const getEvent: GetEvent = async (auth, calendarId, eventId) => {
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.get({ calendarId, eventId });
  return response.data;
};
```

### Token Persistence Pattern

```typescript
import type { Credentials } from "google-auth-library";

// Store tokens (encrypted) in DB after OAuth
type SaveTokens = (userId: string, tokens: Credentials) => Promise<void>;
const saveTokens: SaveTokens = async (userId, tokens) => {
  await db.oauthToken.upsert({
    where: { userId_provider: { userId, provider: "google" } },
    create: {
      userId,
      provider: "google",
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!, // Only present on first auth
      expiresAt: new Date(tokens.expiry_date!),
      scope: tokens.scope ?? "",
    },
    update: {
      accessToken: tokens.access_token!,
      expiresAt: new Date(tokens.expiry_date!),
      // NOTE: Do NOT overwrite refreshToken here — it won't be in refresh responses
    },
  });
};

// Subscribe to token refresh events to persist new tokens automatically
const setupTokenRefreshListener = (
  client: OAuth2Client,
  userId: string
): void => {
  client.on("tokens", async (tokens) => {
    await saveTokens(userId, tokens);
  });
};
```

---

## 8. Key Differences from Microsoft Graph OAuth

| Aspect | Google OAuth 2.0 | Microsoft Graph (MSAL) |
|--------|-----------------|------------------------|
| **Auth library** | `googleapis` / `google-auth-library` | `@azure/msal-node` |
| **Auth endpoint** | `accounts.google.com/o/oauth2/v2/auth` | `login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize` |
| **Token endpoint** | `oauth2.googleapis.com/token` | `login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |
| **Scope format** | Full URI: `https://www.googleapis.com/auth/calendar.readonly` | Short: `Calendars.Read` (resolved by Graph) |
| **Token refresh** | Manual or auto via `googleapis` client; refresh token NOT rotated | MSAL handles automatically; tokens may rotate |
| **Refresh token expiry** | 6-month inactivity, 100-token limit per client/user | Typically 90 days inactive, 24h if `offline_access` only |
| **Tenant concept** | None — always `accounts.google.com` | Required — `common`, `organizations`, or specific tenant ID |
| **API base URL** | `https://www.googleapis.com/calendar/v3/` | `https://graph.microsoft.com/v1.0/` |
| **Calendar listing** | `GET /users/me/calendarList` | `GET /me/calendars` |
| **Event listing** | `GET /calendars/{id}/events?timeMin=...&timeMax=...` | `GET /me/calendars/{id}/calendarView?startDateTime=...&endDateTime=...` |
| **All-day events** | `start.date` field (no `start.dateTime`) | `isAllDay: true`, start/end still use dateTime at midnight |
| **Time format** | RFC3339 with timezone offset required | ISO 8601; `$select` to control fields returned |
| **Recurring events** | `singleEvents=true` param expands instances | Use `calendarView` endpoint (already expands) |
| **App registration** | Google Cloud Console | Azure Portal / app.microsoft.com |
| **Consent screen** | Google-branded, Google's UX | Microsoft-branded, Microsoft's UX |
| **Token storage** | Store `access_token` + `refresh_token` + `expiry_date` | MSAL has built-in token cache (in-memory or pluggable) |
| **Auto-refresh** | Via `googleapis` client's token event listener | MSAL handles silently via `acquireTokenSilent` |
| **App verification** | Required for sensitive scopes in external apps | Required for admin consent, less so for user consent |

**Implementation impact for this project (which already has Microsoft Graph):**

1. **Token storage schema:** Google needs `expiry_date` (Unix ms) rather than Microsoft's `expiresOn`. The refresh token is not returned on subsequent refreshes — must never overwrite it.

2. **Scope strategy:** Google uses granular URI scopes. For the existing Outlook plugin pattern, request `calendar.calendarlist.readonly` + `calendar.events.readonly` at minimum.

3. **Library pattern:** `googleapis` auto-refreshes via the `tokens` event — set up an event listener (shown above) rather than MSAL's `acquireTokenSilent`.

4. **Calendar ID:** Use `"primary"` as `calendarId` for the user's default calendar — no lookup needed for the common case.

5. **Recurring events:** Always use `singleEvents=true` when displaying events in a time range. Without it, recurring events appear as a single entry with RRULE instead of expanded instances.

6. **All-day event detection:** Check `event.start.date` (truthy) vs `event.start.dateTime` (truthy). Never both.

---

## Sources
- `https://developers.google.com/identity/protocols/oauth2/web-server` — OAuth 2.0 authorization code flow
- `https://developers.google.com/identity/protocols/oauth2/scopes#calendar` — All Calendar API scope URIs
- `https://developers.google.com/identity/protocols/oauth2#expiration` — Refresh token expiration conditions
- `https://developers.google.com/calendar/api/v3/reference` — API v3 resource overview
- `https://developers.google.com/calendar/api/v3/reference/calendarList/list` — calendarList.list endpoint
- `https://developers.google.com/calendar/api/v3/reference/calendarList#resource` — CalendarList resource schema
- `https://developers.google.com/calendar/api/v3/reference/events/list` — events.list endpoint
- `https://developers.google.com/calendar/api/v3/reference/events/get` — events.get endpoint
- `https://developers.google.com/calendar/api/v3/reference/events#resource` — Event resource schema
- `https://developers.google.com/workspace/guides/create-credentials` — Cloud Console credential creation
- `https://developers.google.com/workspace/guides/configure-oauth-consent` — OAuth consent screen setup
- `https://github.com/googleapis/google-api-nodejs-client` — googleapis Node.js client
- `https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code` — Node.js code examples

## Key Takeaways
- Request `access_type=offline` AND `prompt=consent` to guarantee receiving a refresh token every auth flow
- Google refresh tokens are NOT rotated on refresh (unlike Microsoft) — the same token works until revoked
- Refresh tokens have a **100-token-per-client-per-user limit** and a **6-month inactivity expiry**
- Use `singleEvents=true` with `orderBy=startTime` for time-range event queries — required to expand recurring events
- `calendarId: "primary"` works without a calendar lookup for the user's default calendar
- The `googleapis` library auto-refreshes tokens; set up a `tokens` event listener to persist updated access tokens
- Testing-mode external apps have refresh tokens that expire in 7 days — publish to production for persistent access
- Google Calendar API scopes (even read-only) are classified "sensitive" and require verification for external production apps
