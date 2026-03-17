# Microsoft Graph API Setup

## 1. Create an App Registration

1. Go to the [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
3. Fill in:
   - **Name:** `Harness` (or whatever you prefer)
   - **Supported account types:** Choose based on your account:
     - *Personal Microsoft accounts only* — if using outlook.com / hotmail.com
     - *Accounts in any organizational directory and personal Microsoft accounts* — if you want both work/school and personal
   - **Redirect URI:** Select **Web** and enter `http://localhost:4000/api/oauth/callback`
4. Click **Register**
5. On the overview page, copy the **Application (client) ID** — this is your `MICROSOFT_CLIENT_ID`
6. Copy the **Directory (tenant) ID** — this is your `MICROSOFT_TENANT_ID`
   - If you selected "personal accounts only," use `consumers` instead
   - If you selected "any account type," use `common`

## 2. Create a Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Set a description (e.g., `harness-dev`) and expiration (24 months recommended)
4. Click **Add**
5. Copy the **Value** immediately (it won't be shown again) — this is your `MICROSOFT_CLIENT_SECRET`

## 3. Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add the following permissions:

| Permission | Category | Purpose |
|------------|----------|---------|
| `openid` | OpenID | Required for sign-in |
| `profile` | OpenID | User profile (display name) |
| `offline_access` | OpenID | Refresh tokens (keeps session alive) |
| `Mail.Read` | Mail | Search and read emails |
| `Mail.ReadWrite` | Mail | Move emails between folders |
| `Mail.Send` | Mail | Send and reply to emails |
| `Calendars.Read` | Calendars | List events and find free time |
| `Calendars.ReadWrite` | Calendars | Create, update, and delete events |

4. Click **Add permissions**
5. If you see a "Grant admin consent" button and you're an Azure AD admin, click it. For personal accounts, consent is granted during the OAuth flow.

## 4. Configure Environment Variables

Add these to your `.env` file:

```env
MICROSOFT_CLIENT_ID=<Application (client) ID from step 1>
MICROSOFT_CLIENT_SECRET=<Secret value from step 2>
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:4000/api/oauth/callback
OAUTH_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
```

Generate the encryption key:

```bash
openssl rand -hex 32
```

## 5. Push the Schema

If you haven't already, push the `OAuthToken` model to your database:

```bash
pnpm db:push
```

## 6. Connect Your Account

1. Start the dev server: `pnpm dev`
2. Go to `http://localhost:4000/admin/integrations`
3. Click **Connect Account**
4. Sign in with your Microsoft account and grant the requested permissions
5. You'll be redirected back with a success message

## 7. Verify

Once connected, the agent can use these MCP tools:

**Email (Outlook plugin):**
- `outlook__search_emails` — KQL search across your mailbox
- `outlook__read_email` — Read full email content
- `outlook__list_recent` — List recent emails from any folder
- `outlook__send_email` — Send emails
- `outlook__reply_email` — Reply to emails
- `outlook__move_email` — Move to inbox/archive/trash/etc.
- `outlook__list_folders` — List mail folders
- `outlook__find_unsubscribe_links` — Find unsubscribe links

**Calendar:**
- `calendar__list_events` — List upcoming events
- `calendar__get_event` — Get event details
- `calendar__create_event` — Create events
- `calendar__update_event` — Update events
- `calendar__delete_event` — Delete events
- `calendar__find_free_time` — Find available time slots
- `calendar__list_calendars` — List calendars

## Troubleshooting

**"AADSTS700016: Application not found"**
- Double-check `MICROSOFT_CLIENT_ID` and `MICROSOFT_TENANT_ID`
- If using a personal account, set `MICROSOFT_TENANT_ID=consumers`

**"AADSTS65001: The user or administrator has not consented"**
- The required permissions haven't been granted. The consent screen should appear during the OAuth flow. If it doesn't, go to API permissions in Azure Portal and click "Grant admin consent."

**"Invalid state parameter"**
- The CSRF cookie expired (10-minute window). Try connecting again.

**Token shows as expired (red dot) on the integrations page**
- Tokens auto-refresh when used. If the refresh token is also expired, click Disconnect and reconnect.

**Production redirect URI**
- Update `MICROSOFT_REDIRECT_URI` to your production URL (e.g., `https://harness.example.com/api/oauth/callback`)
- Also add the production URI in Azure Portal under **Authentication** → **Redirect URIs**
