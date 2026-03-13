# Music Plugin: Authentication, Settings & Admin UI

**Date:** 2026-03-12
**Status:** Design
**Scope:** YouTube Music auth (OAuth + cookie), Cast device management UI, playback settings, OAuth field type in plugin contract

---

## 1. Problem Statement

The music plugin has working search, cast, and playback infrastructure but is missing:

1. **YouTube Music authentication** — the Innertube client runs anonymously; no access to playlists, liked songs, history, or personalized recommendations
2. **Cast device visibility** — device discovery is invisible to the user; no settings UI to see, test, alias, or manage discovered devices
3. **Account status display** — no way to see which Google account is connected or its subscription tier
4. **Playback defaults** — no configurable defaults for volume, radio mode, or audio quality
5. **OAuth as a reusable settings primitive** — the plugin settings system only supports scalar fields (string/number/boolean/select); OAuth will be needed by multiple plugins (music, Microsoft, potentially Discord upgrade)

---

## 2. Design Decisions

### 2.1 Auth Strategy: OAuth Primary, Cookie Fallback

Both methods are fully implemented — first-class, not half-baked.

**OAuth TV Device-Code Flow (Primary)**
- Uses youtubei.js's TV Innertube client OAuth
- UX: "Visit google.com/device and enter code: ABCD-EFGH"
- Tokens auto-refresh (~60 min access token lifetime, refresh token indefinite)
- Plugin persists credentials encrypted in `PluginConfig.settings`; listens to `update-credentials` event to re-persist on refresh
- On orchestrator restart, `signIn(savedCredentials)` resumes the session

**Cookie-Based Auth (Fallback)**
- User pastes browser cookies (`__Secure-1PSID`, `__Secure-1PSIDTS`, etc.) into a secret settings field
- No auto-refresh — cookies expire in weeks/months; user must re-extract from DevTools
- Stored encrypted as a separate `cookie` field in `PluginConfig.settings`

**Auth precedence:** OAuth credentials checked first. If absent or expired with no refresh token, fall back to cookie. If neither exists, run anonymous (public search + streaming still works).

**PO Token:** A separate secret field for the Proof-of-Origin token (anti-bot attestation, ~12hr expiry). Required for reliable stream access from web clients. Independent of account auth. Stored encrypted.

### 2.2 OAuth Field Type in Plugin Contract

A new `'oauth'` field type added to `SettingsFieldType` in `packages/plugin-contract/src/index.ts`. This is a reusable primitive — any plugin can declare it.

**Schema declaration:**
```typescript
{
  youtubeAuth: {
    type: 'oauth',
    label: 'YouTube Music Account',
    provider: 'youtube-music',
    description: 'Connect your YouTube Music account.',
  },
}
```

**New types added to plugin-contract:**
```typescript
// Updated union — 'oauth' is its own discriminant branch, excluded from SettingsFieldScalar
type SettingsFieldType = 'string' | 'number' | 'boolean' | 'select' | 'oauth';

type SettingsFieldScalar = SettingsFieldBase & { type: Exclude<SettingsFieldType, 'select' | 'oauth'> };
type SettingsFieldSelect = SettingsFieldBase & {
  type: 'select';
  options: { label: string; value: string }[];
};
type SettingsFieldOAuth = SettingsFieldBase & {
  type: 'oauth';
  provider: string;  // identifies the OAuth provider handler
};

// Updated union
export type PluginSettingsField = (SettingsFieldScalar | SettingsFieldSelect | SettingsFieldOAuth) & { name: string };

// Generic stored credentials shape — provider-agnostic
// Individual providers may store additional fields in the JSON blob
export type OAuthStoredCredentials = {
  authMethod: 'oauth' | 'cookie';
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;         // ISO datetime
  // Cached account info (set by the provider after successful auth):
  accountEmail?: string;
  accountName?: string;
  accountPhoto?: string;
  // Provider-specific metadata — not typed here, each plugin interprets its own
  providerMeta?: Record<string, unknown>;
};

// Updated InferFieldValue — oauth maps to OAuthStoredCredentials
type InferFieldValue<F extends Omit<PluginSettingsField, 'name'>> =
  F['type'] extends 'boolean' ? boolean
  : F['type'] extends 'number' ? number
  : F['type'] extends 'oauth' ? OAuthStoredCredentials
  : string;
```

**Key type-system details:**
- `SettingsFieldScalar` excludes both `'select'` and `'oauth'` so the discriminated union is clean
- `OAuthStoredCredentials` is provider-agnostic — YouTube Music stores `subscriptionTier` in `providerMeta`, not as a top-level field. Future providers (Microsoft, etc.) store their own metadata there.
- `InferFieldValue` gains an `'oauth'` branch so `ctx.getSettings()` returns the correct type

**OAuth field behavior in SettingsForm and helpers:**
- `SettingsForm` **skips** `type === 'oauth'` fields in its standard field rendering loop. OAuth fields are not form inputs — they have their own lifecycle.
- `buildSettingsPayload` **skips** `type === 'oauth'` fields entirely. OAuth credentials are written by the orchestrator's OAuth callback, not by form submission.
- `buildFormData` **skips** `type === 'oauth'` fields. No FormData extraction for OAuth.
- Plugin-specific admin pages (like `/admin/plugins/music`) render OAuth UI as a custom component that reads the current credentials from the server and renders connect/disconnect/status.

**OAuth flow mechanics — plugin routes via PluginDefinition.routes:**

The plugin contract gains a new optional `routes` field:

```typescript
type PluginRoute = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;  // e.g., '/oauth/youtube-music/initiate'
  handler: (ctx: PluginContext, req: PluginRouteRequest) => Promise<PluginRouteResponse>;
};

type PluginRouteRequest = {
  body?: unknown;
  params: Record<string, string>;
  query: Record<string, string>;
};

type PluginRouteResponse = {
  status: number;
  body: unknown;
};

type PluginDefinition = {
  // ... existing fields
  routes?: PluginRoute[];  // Optional. HTTP routes mounted by the web plugin.
};
```

**Route context resolution:** Each plugin's route handlers need the plugin's own `PluginContext`, not the web plugin's. The orchestrator already constructs per-plugin contexts during startup. After all plugins `register()`, the orchestrator collects `{ pluginName, routes, ctx }` tuples for every plugin that declared routes, then passes this collection to all plugins via a new `PluginContext.pluginRoutes` field. The web plugin reads `ctx.pluginRoutes` in `start()` and mounts each route at `/api/plugins/:pluginName/<route.path>`, calling `route.handler(route.ctx, req)` with the originating plugin's context. This keeps per-plugin sandboxing intact.

For example, a music plugin route with `path: '/identify-device'` becomes `POST /api/plugins/music/identify-device`. A route with `path: '/oauth/initiate'` becomes `POST /api/plugins/music/oauth/initiate`.

This is the clean extensible approach — plugins register their own HTTP handlers without the web plugin knowing about music-specific or OAuth-specific logic. Future plugins (Microsoft OAuth, etc.) register their own routes the same way.

**Encryption for OAuth credentials:** Route handlers that write OAuth credentials to `PluginConfig.settings` must use `encryptValue` (the same utility used by `buildSettingsPayload` for secret fields) before writing to the database. This ensures OAuth tokens are encrypted at rest, matching the existing pattern for secret settings fields.

**OAuth endpoints registered by the music plugin:**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/oauth/initiate` | Start device-code flow, return `{ userCode, verificationUrl, expiresIn }` |
| `GET` | `/oauth/status` | Poll for completion: `{ status: 'pending' | 'completed' | 'error', account? }` |
| `POST` | `/oauth/disconnect` | Clear OAuth credentials, fire `notifySettingsChange` |
| `POST` | `/identify-device` | Play test chime on a Cast device |
| `GET` | `/devices` | Return current device list with status and aliases |
| `POST` | `/devices/alias` | Set a device alias |

These are all mounted at `/api/plugins/music/*` by the web plugin.

### 2.3 Music Plugin Admin Page: Hybrid Layout

The music plugin's admin page at `/admin/plugins/music` is a custom page that overrides the generic `[name]` route. Next.js App Router resolves static segments before dynamic, so this works without special routing.

**Page layout (top to bottom):**

1. **Account Section** (custom component — NOT rendered by SettingsForm)
   - Reads OAuth credentials from `PluginConfig.settings` server-side
   - **Disconnected:** "Connect YouTube Music" card with "Connect with OAuth" button + expandable "Or paste cookie" section with a secret text input + PO Token secret input
   - **Connected:** Account info card (email, name, profile photo, subscription tier badge from `providerMeta.subscriptionTier`) + "Disconnect" button
   - **Error/Expired:** Warning banner + "Reconnect" button

2. **Cast Devices Section** (custom component, not part of settingsSchema)
   - Header: "Cast Devices" + device count badge
   - Device list: each device shows friendly name (or alias), model, connection status indicator
   - Per-device actions: "Test/Identify" button (plays a short chime or shows a message on screen), "Set Alias" inline edit
   - Empty state: "No devices found — ensure devices are on the same network as the orchestrator"
   - Device aliases stored in `PluginConfig.settings.deviceAliases` as `Record<string, string>` (device ID → alias)

3. **Playback Settings Section** (generic SettingsForm, filtered to scalar fields only)
   - `defaultVolume` — number, 0-100, default 50
   - `radioEnabled` — boolean, default true
   - `audioQuality` — select: "auto" | "high" | "low", default "auto" ("high" requires Premium)

The custom page imports and renders the generic `SettingsForm` for the playback fields only — passing the fields array with OAuth fields filtered out. The account and device sections are separate custom components above it.

### 2.4 Cast Device Management

**Discovery:** Already implemented via `bonjour-service` mDNS in `start()`. No changes needed to discovery itself.

**Device aliases:** Stored as a JSON object in `PluginConfig.settings.deviceAliases`. The `resolveDevice` function is updated to check aliases before matching on mDNS names. Aliases are set from the admin UI via a server action that calls `POST /api/plugins/music/devices/alias`.

**Test/Identify action:** A server action calls `POST /api/plugins/music/identify-device`, which (via the plugin route handler):
1. Connects to the device via `castv2-client`
2. Launches the Default Media Receiver
3. Plays a short built-in chime URL (a public domain audio file hosted locally or embedded) OR displays a text card with the device name
4. Disconnects after 3 seconds

**Connection status:** The device list UI shows one of:
- Green dot: "Available" (discovered via mDNS, responsive)
- Yellow dot: "Playing" (active Cast session on this device)
- Gray dot: "Offline" (previously seen but not in current mDNS results)

Status is derived from combining the mDNS device registry with the active sessions map in the playback controller. The `/devices` plugin route returns this combined data.

### 2.5 New MCP Tools (Authenticated Features)

These tools are added to the music plugin's `tools` array. They require auth and return an error message if not authenticated.

| Tool | Description | Requires Auth |
|------|-------------|---------------|
| `my_playlists` | List the user's YouTube Music playlists | Yes |
| `liked_songs` | List the user's liked songs (playlist ID "LM") | Yes |
| `my_library` | Browse the user's YouTube Music library | Yes |
| `get_playback_settings` | Read current playback settings (volume, radio, quality) | No |
| `update_playback_settings` | Change playback settings via conversation | No |

The `get_playback_settings` and `update_playback_settings` tools allow conversational control of the same settings visible in the admin UI. `update_playback_settings` writes to `PluginConfig.settings` and calls `ctx.notifySettingsChange('music')`. Names are specific to avoid collision with similarly-named tools in other plugins.

### 2.6 Settings Integration with Playback

The music plugin adds an `onSettingsChange` hook (returned from `register()`). When settings change (from admin UI or conversational `update_playback_settings` tool):

1. **Auth credentials changed:** Reinitialize the Innertube client with new credentials (or switch from OAuth to cookie or vice versa)
2. **Playback defaults changed:** Update in-memory defaults. New Cast sessions pick up the new defaults. Active sessions are not interrupted.
3. **Device aliases changed:** Update the alias lookup map. `resolveDevice` immediately uses new aliases.

The plugin reads settings in `start()` via `ctx.getSettings(settingsSchema)` and stores them in a module-level ref for tool handlers to access. `register()` returns `{ onSettingsChange }`.

---

## 3. Settings Schema Definition

```typescript
// packages/plugins/music/src/_helpers/settings-schema.ts

import { createSettingsSchema } from "@harness/plugin-contract";

export const settingsSchema = createSettingsSchema({
  youtubeAuth: {
    type: 'oauth' as const,
    label: 'YouTube Music Account',
    provider: 'youtube-music',
    description: 'Connect your YouTube Music account for playlists, liked songs, and personalized recommendations.',
  },
  cookie: {
    type: 'string' as const,
    label: 'YouTube Music Cookie (Fallback)',
    description: 'Browser cookie string for fallback authentication. Extract from DevTools Network tab.',
    secret: true,
  },
  poToken: {
    type: 'string' as const,
    label: 'PO Token',
    description: 'Proof-of-Origin token for stream access. Expires every ~12 hours. Extract via BgUtils.',
    secret: true,
  },
  defaultVolume: {
    type: 'number' as const,
    label: 'Default Volume',
    description: 'Default volume for new Cast sessions (0-100).',
    default: 50,
  },
  radioEnabled: {
    type: 'boolean' as const,
    label: 'Radio / Autoplay',
    description: 'Automatically play related songs after the current track ends.',
    default: true,
  },
  audioQuality: {
    type: 'select' as const,
    label: 'Audio Quality',
    description: 'Preferred audio quality. "High" requires YouTube Music Premium.',
    default: 'auto',
    options: [
      { label: 'Auto (best available)', value: 'auto' },
      { label: 'High (Premium only)', value: 'high' },
      { label: 'Low (save bandwidth)', value: 'low' },
    ],
  },
});
```

---

## 4. File Changes Summary

### Plugin Contract (`packages/plugin-contract/src/index.ts`)
- Add `'oauth'` to `SettingsFieldType` union
- Update `SettingsFieldScalar` exclusion to `Exclude<SettingsFieldType, 'select' | 'oauth'>`
- Add `SettingsFieldOAuth` type (with `provider` field)
- Update `PluginSettingsField` discriminated union to include `SettingsFieldOAuth`
- Export `OAuthStoredCredentials` type (provider-agnostic, with `providerMeta` for extension)
- Update `InferFieldValue` to add `'oauth'` branch mapping to `OAuthStoredCredentials`
- Add `PluginRoute`, `PluginRouteRequest`, `PluginRouteResponse` types
- Add optional `routes?: PluginRoute[]` to `PluginDefinition`

### Settings Form (`apps/web/src/app/admin/plugins/[name]/_components/settings-form.tsx`)
- Skip `type === 'oauth'` fields in the field rendering loop (they are not form inputs)
- No OAuth UI in the generic form — OAuth rendering is handled by plugin-specific admin pages

### Build Settings Payload (`apps/web/.../build-settings-payload.ts`)
- Skip `type === 'oauth'` fields — OAuth credentials are managed out-of-band by plugin routes

### Code Generation (`scripts/generate-plugin-registry.ts`)
- Update the generated `PluginSettingsField.type` field from `string` to `'string' | 'number' | 'boolean' | 'select' | 'oauth'` for compile-time safety
- Add `provider?: string` to the generated type for OAuth fields

### Web Plugin (`packages/plugins/web/`)
- Mount plugin routes: iterate `ALL_PLUGINS`, for each with `routes`, register Express handlers at `/api/plugins/:pluginName/<route.path>`
- Routes receive `PluginContext` + parsed request, return response

### Music Plugin (`packages/plugins/music/`)
- New: `src/_helpers/settings-schema.ts` — schema definition
- New: `src/_helpers/youtube-music-auth.ts` — OAuth device-code flow + cookie auth + credential persistence + account info fetching
- New: `src/_helpers/device-alias-manager.ts` — read/write device aliases from settings
- New: `src/_helpers/oauth-routes.ts` — plugin route handlers for OAuth initiate/status/disconnect
- New: `src/_helpers/device-routes.ts` — plugin route handlers for device list/alias/identify
- Modified: `src/_helpers/youtube-music-client.ts` — `initYouTubeMusicClient` accepts credentials from settings
- Modified: `src/_helpers/cast-device-manager.ts` — `resolveDevice` checks aliases; export device status (mDNS + session state)
- Modified: `src/_helpers/playback-controller.ts` — read default volume/radio/quality from settings
- Modified: `src/index.ts` — add `settingsSchema`, `routes`, `onSettingsChange` hook (returned from `register()`), new MCP tools
- Test files for all new helpers in corresponding `__tests__/` directories

### Music Admin Page (`apps/web/src/app/admin/plugins/music/`)
- This is a custom page that overrides the generic `[name]` route for the music plugin
- New: `page.tsx` — server component shell (breadcrumb, heading, three sections)
- New: `_components/youtube-account-section.tsx` — OAuth connect/disconnect/status display
- New: `_components/cast-device-list.tsx` — device list with status, aliases, test button
- New: `_actions/initiate-oauth.ts` — server action: POST to `/api/plugins/music/oauth/initiate`
- New: `_actions/disconnect-account.ts` — server action: POST to `/api/plugins/music/oauth/disconnect`
- New: `_actions/set-device-alias.ts` — server action: POST to `/api/plugins/music/devices/alias`
- New: `_actions/identify-device.ts` — server action: POST to `/api/plugins/music/identify-device`

---

## 5. Data Flow

### OAuth Connect Flow
```
User clicks "Connect" in admin UI
  → Server action POST /api/plugins/music/oauth/initiate
  → Music plugin route handler starts youtubei.js TV device-code flow
  → Returns { userCode, verificationUrl, expiresIn } to browser
  → UI shows "Visit google.com/device, enter code XXXX"
  → UI polls GET /api/plugins/music/oauth/status every 3s
  → User completes auth in their browser
  → youtubei.js fires 'auth' event with credentials
  → Route handler encrypts + saves to PluginConfig.settings
  → Fires ctx.notifySettingsChange('music')
  → Music plugin onSettingsChange: reinitializes Innertube with new creds
  → Poll response returns { status: 'completed', account: { email, name, photo, tier } }
  → UI updates to show connected state
```

### Cookie Fallback Flow
```
User enters cookie in the cookie secret field on admin page
  → Standard form submit (part of SettingsForm for scalar fields)
  → save-plugin-settings encrypts + saves to PluginConfig.settings
  → Fires notifySettingsChange('music')
  → Music plugin onSettingsChange: reinitializes Innertube with cookie
```

### Device Identify Flow
```
User clicks "Test" on a device row
  → Server action POST /api/plugins/music/identify-device { deviceId }
  → Music plugin route handler connects via castv2-client
  → Launches DefaultMediaReceiver, plays short chime
  → Returns success/failure to UI
```

### Conversational Settings Flow
```
User: "set the default volume to 75"
  → Claude calls music__update_playback_settings({ defaultVolume: 75 })
  → Tool handler writes to PluginConfig.settings
  → Calls ctx.notifySettingsChange('music')
  → onSettingsChange updates in-memory defaults
  → Returns "Default volume set to 75%"
```

---

## 6. Open Questions / Risks

1. **PO Token automation** — currently requires manual extraction every ~12 hours via BgUtils. No clean server-side automation exists. For now this is a manual secret field; future work could add a BgUtils integration.

2. **OAuth scope deprecation** — the TV client OAuth scope `http://gdata.youtube.com` is deprecated (youtubei.js issue #1019). This may break in the future. The cookie fallback exists precisely for this scenario.

3. **Subscription tier detection** — fetching whether the account has YouTube Music Premium may require an extra API call via Innertube's account accessor. If this is unreliable, degrade gracefully to showing email + name only and store nothing in `providerMeta.subscriptionTier`.

4. **Test chime source** — need a short, pleasant audio file for the identify action. Options: host a small MP3 in the repo's public assets, use a data URI, or use the Cast protocol's built-in TTS. TBD during implementation.

5. **Plugin route mounting order** — the web plugin must mount routes after all plugins have registered (i.e., in `start()`, not `register()`). This follows the existing boot sequence constraint documented in `.claude/rules/cron-scheduler.md`.
