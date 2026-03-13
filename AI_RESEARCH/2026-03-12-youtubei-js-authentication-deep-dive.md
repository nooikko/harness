# Research: youtubei.js Authentication — Deep Dive

Date: 2026-03-12

## Summary

`youtubei.js` (npm: `youtubei.js`, GitHub: LuanRT/YouTube.js) supports two authentication mechanisms for accessing a Google/YouTube account: **cookie-based authentication** (recommended for all clients) and **OAuth2 via the TV Innertube client** (the only OAuth path still working after Google's 2024 changes). Authenticated sessions unlock user playlists, liked songs, library, history, and personalized recommendations. YouTube Music Premium ad-free streams are accessible via cookie auth tied to a Premium account, but NOT via any mechanism that bypasses the subscription itself. Token persistence is achievable via the `cacheCredentials()` API (OAuth) or by storing cookie strings (cookies). Practical risks are significant: the library is reverse-engineered, violates YouTube's ToS in letter, and uses the same BotGuard/PO Token infrastructure that YouTube uses to detect non-browser clients.

## Prior Research

- `/AI_RESEARCH/2026-03-05-youtubei-js-api-surface.md` — full `yt.music.*` API surface, streaming data, format selection
- `/AI_RESEARCH/2026-03-05-youtube-music-nodejs-libraries.md` — library landscape, auth requirements comparison table

## Current Findings

---

### 1. Authentication Methods Supported

#### A. Cookie-Based Authentication (Recommended)

**Confidence: HIGH** — documented at https://ytjs.dev/guide/authentication

This is the officially recommended method in the YouTube.js documentation for all non-TV clients. You extract the `Cookie` header from an authenticated YouTube browser session and pass it at initialization.

```typescript
import { Innertube } from 'youtubei.js';

const innertube = await Innertube.create({
  cookie: '__Secure-1PSID=...; __Secure-1PSIDTS=...; SID=...; HSID=...; ...'
});

console.log(innertube.session.logged_in); // true
```

**How to extract the cookie:**
1. Open YouTube or YouTube Music in a desktop browser (incognito window recommended)
2. Sign in to your Google account
3. Press F12 to open DevTools, go to the Network tab
4. Apply XHR filter, type "browse" in the filter box
5. Scroll the page to trigger a browse request
6. Select that request, go to Headers → Request Headers → find `Cookie`
7. Right-click and copy the value
8. Close the incognito window WITHOUT signing out (signing out invalidates the session)

**Critical gotcha — HttpOnly cookies (Confidence: HIGH):** Issue #707 (August 2024) identified that cookie authentication in Node.js requires manually appending two HttpOnly cookies that browser DevTools does not normally expose:
- `__Secure-1PSID`
- `__Secure-1PSIDTS`

These are marked HttpOnly in the browser, meaning standard DevTools inspection does not show them in the same way. Users must explicitly look for them in the Application → Cookies panel (Chrome) and append them to the cookie string. Without these, Node.js usage returns 401 UNAUTHENTICATED errors even with an otherwise valid cookie string.

**Cookie validity:** Cookies remain valid until you sign out of the session or Google expires it server-side. Using an incognito window and NOT signing out before closing maximizes cookie lifetime. No documented fixed expiry — Google controls this server-side.

Sources:
- https://ytjs.dev/guide/authentication
- https://github.com/LuanRT/YouTube.js/issues/707
- https://github.com/patrickkfkan/Volumio-YouTube.js/wiki/How-to-obtain-Cookie

---

#### B. OAuth2 via TV Innertube Client (Limited)

**Confidence: HIGH** — documented at https://ytjs.dev/guide/authentication

**Critical constraint:** As of 2024, Google restricted OAuth2 authentication to the TV Innertube client only. Standard web-client OAuth no longer works. The documentation explicitly states: "Due to changes made by Google, OAuth2 authentication now only works with the TV Innertube client."

The TV OAuth flow uses Google's device authorization flow (same as smart TV apps), where the user visits a URL and enters a device code:

```typescript
import { Innertube, UniversalCache } from 'youtubei.js';

const innertube = await Innertube.create({
  cache: new UniversalCache(false), // or true for disk persistence
});

// Register event handlers BEFORE calling signIn()
innertube.session.on('auth-pending', (data) => {
  // data.verification_url — e.g. "https://www.google.com/device"
  // data.user_code — e.g. "XXXX-XXXX"
  console.log(`Go to ${data.verification_url} and enter code: ${data.user_code}`);
});

innertube.session.on('auth', ({ credentials }) => {
  console.log('Sign in successful');
  // credentials = { access_token, refresh_token, expiry_date, ... }
  // Persist these for reuse (see section 4 below)
});

innertube.session.on('update-credentials', ({ credentials }) => {
  // Fired when access token is automatically refreshed
  // Re-persist the updated credentials here
});

// Trigger the auth flow (blocks until user completes verification)
await innertube.session.signIn();
```

**Token lifetime:** Based on Google's standard TV OAuth flow:
- Access tokens: valid for ~60 minutes
- Refresh tokens: valid until explicitly revoked or account security event
- The `update-credentials` event fires automatically when the access token is refreshed

**OAuth scope deprecation (Issue #1019, December 2025):** The library historically used the scope `http://gdata.youtube.com`. This scope is no longer available in Google's OAuth2 console and cannot be added to Google Auth clients. The reporter suggested replacing it with `https://www.googleapis.com/auth/youtube`. The issue was closed as stale without a formal fix. This may affect developers trying to set up their own Google Cloud OAuth credentials (as opposed to using the library's built-in TV client credentials).

Sources:
- https://ytjs.dev/guide/authentication
- https://github.com/LuanRT/YouTube.js/issues/1019

---

#### C. API Keys

**Confidence: HIGH — NOT SUPPORTED for user authentication.** The library accepts no `api_key` parameter for Google account authentication. YouTube Data API v3 uses API keys, but that is a separate product from the InnerTube private API that youtubei.js wraps. InnerTube does not use public API keys for user authentication.

---

#### D. `po_token` and `visitor_data` (Anti-Bot, Not Auth)

**Confidence: HIGH** — documented at https://ytjs.dev/guide/getting-started and https://github.com/LuanRT/BgUtils

These are NOT authentication credentials for a user account. They are anti-bot attestation tokens required by YouTube since August 2024 to confirm that requests originate from a legitimate browser environment. Without a valid PO Token, streaming requests from web-based clients may return 403 errors or be rate-throttled after ~1-2MB.

```typescript
const innertube = await Innertube.create({
  po_token: 'YOUR_PO_TOKEN',  // proof of origin token
  visitor_data: 'YOUR_VISITOR_DATA',
});
```

PO Tokens are bound to a session (Visitor ID or account Session ID) and to specific video IDs for some request types. They expire (possibly as short as 12 hours). The companion library `LuanRT/BgUtils` reverse-engineers the BotGuard attestation process to generate these tokens programmatically.

PO Tokens and cookie/OAuth auth are orthogonal — you may need both for full production use.

---

### 2. What Authenticated Access Unlocks

**Confidence: HIGH** — verified against https://www.ytjs.dev/api/classes/Innertube and https://ytjs.dev/api/youtubei.js/namespaces/Clients/classes/Music.html

#### On the main `Innertube` class (requires auth):
| Method | What It Returns | Auth Required |
|--------|----------------|---------------|
| `getHistory()` | User's watch/listen history | Yes |
| `getLibrary()` | User's saved content library | Yes |
| `getPlaylists()` | User's created/saved playlists | Yes |
| `getSubscriptionsFeed()` | Videos from subscribed channels | Yes |
| `getChannelsFeed()` | Subscribed channels content | Yes |
| `getHomeFeed()` | Personalized home feed | Recommended (better personalization) |
| `account` accessor | Account management interface | Yes |

#### On the `Music` class (`innertube.music.*`) (requires auth):
| Method | What It Returns | Auth Required |
|--------|----------------|---------------|
| `getLibrary()` | User's YouTube Music library | Yes |
| `getHomeFeed()` | Personalized Music home feed | Recommended |
| `getExplore()` | Explore/charts/trending | No (public) |
| `search()` | Music search results | No (public) |
| `getInfo()` | Track info + streaming data | No (public) |
| `getAlbum()` | Album metadata + tracks | No (public) |
| `getArtist()` | Artist page | No (public) |
| `getPlaylist()` | Playlist tracks | No (public playlists) / Yes (private) |
| `getUpNext()` | Radio/up-next queue | No (public) |
| `getRelated()` | Related content | No |
| `getLyrics()` | Song lyrics | No |

**Liked Songs:** There is no explicit `getLikedSongs()` method on the `Music` class. Liked songs are accessible via `getLibrary()` (which returns the library including liked songs as a playlist) or by calling `getPlaylist()` with the special liked songs playlist ID (`LM`).

**YouTube Music Premium — ad-free streams:** If the authenticated user has an active YouTube Music Premium subscription, the streams returned by `getInfo()` → `streaming_data` will contain high-quality, ad-free audio formats (including `AUDIO_QUALITY_HIGH`). The library itself does not bypass the subscription — it simply passes your authentication credentials to YouTube's servers, and YouTube returns Premium-quality streams if your account has Premium. **There is no mechanism to get Premium streams without an active Premium subscription.**

**Personalized recommendations:** Authenticated sessions return personalized `getHomeFeed()` content based on listen history, liked songs, and subscriptions. Unauthenticated sessions return generic trending/popular content.

---

### 3. How to Implement Authentication — Full Code Flows

#### Cookie Auth (recommended for most use cases)

```typescript
import { Innertube, UniversalCache } from 'youtubei.js';

// One-time setup: extract cookie from browser DevTools
// (see section 1A for step-by-step instructions)
const COOKIE = '__Secure-1PSID=...; __Secure-1PSIDTS=...; SID=...; HSID=...; SSID=...; APISID=...; SAPISID=...; __Secure-3PAPISID=...';

const innertube = await Innertube.create({
  cookie: COOKIE,
  cache: new UniversalCache(true),      // true = persist session to disk
  generate_session_locally: true,
  retrieve_player: true,
  lang: 'en',
  location: 'US',
});

// Verify authentication
console.log(innertube.session.logged_in); // true if cookie is valid

// Access authenticated features
const history = await innertube.getHistory();
const playlists = await innertube.getPlaylists();
const musicLibrary = await innertube.music.getLibrary();
const musicHome = await innertube.music.getHomeFeed();
```

No token refresh is needed for cookie auth — the cookie is either valid or it isn't. If it expires, you must re-extract it from the browser.

#### OAuth2 Auth with Credential Persistence

```typescript
import { Innertube, UniversalCache } from 'youtubei.js';
import fs from 'fs';

const CREDENTIALS_PATH = './credentials.json';

const innertube = await Innertube.create({
  cache: new UniversalCache(false),
});

// Load previously cached credentials if available
let credentials;
if (fs.existsSync(CREDENTIALS_PATH)) {
  credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

innertube.session.on('auth-pending', (data) => {
  console.log(`Visit: ${data.verification_url}`);
  console.log(`Enter code: ${data.user_code}`);
});

innertube.session.on('auth', ({ credentials: creds }) => {
  console.log('Authenticated successfully');
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds));
  credentials = creds;
});

innertube.session.on('update-credentials', ({ credentials: creds }) => {
  // Access token was refreshed — update stored credentials
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds));
  credentials = creds;
});

// Pass existing credentials (skips device-code flow if still valid)
await innertube.session.signIn(credentials);

// --- Alternatively, use the built-in cache API ---
// Cache to disk (but docs warn this "may lead to security issues"):
await innertube.session.oauth.cacheCredentials();

// Later, in a new process:
// innertube.session will automatically load cached credentials
// just call signIn() — it will check cache first

// Sign out and revoke:
await innertube.session.signOut();         // full revocation
await innertube.session.oauth.removeCache(); // delete cache only
```

**Important:** The `cacheCredentials()` method stores credentials to disk in an unencrypted form. The documentation marks this as "not a recommended practice, as it may lead to security issues." For production, implement your own encrypted storage and use the `auth` / `update-credentials` event handlers as shown above.

---

### 4. Session Persistence

**Confidence: HIGH** — documented at https://ytjs.dev/guide/authentication

#### Cookie Auth Persistence
The cookie string is static — store it in an environment variable or secrets manager. Pass it to `Innertube.create()` on each process start. No refresh mechanism; re-extract when expired.

```typescript
// In .env:
// YT_COOKIE="__Secure-1PSID=...; ..."

const innertube = await Innertube.create({
  cookie: process.env.YT_COOKIE,
});
```

**Lifetime:** Indefinite until Google invalidates the session (which can happen due to password changes, security events, or inactivity). In practice, cookies from an incognito session can last weeks to months.

#### OAuth2 Credential Persistence
Persist the credentials object from the `auth` event and reload it on subsequent process starts. Pass to `signIn(credentials)`:

```typescript
// On process start:
const savedCredentials = loadFromStorage(); // your encrypted storage
await innertube.session.signIn(savedCredentials);
// If credentials are still valid, no device-code flow is triggered
// If access token is expired, the library refreshes it via refresh_token
// 'update-credentials' event fires with new access_token
```

#### UniversalCache for Session State
```typescript
const innertube = await Innertube.create({
  cache: new UniversalCache(true),  // true = persist to disk
});
```
`UniversalCache(true)` persists session metadata (session tokens, player data) to disk, speeding up re-initialization. This is separate from OAuth credentials — it caches InnerTube session state, not Google account auth tokens.

**Token lifetimes:**
- OAuth access tokens: ~60 minutes (auto-refreshed via `update-credentials` event)
- OAuth refresh tokens: until revoked by Google
- Cookies: weeks to months (Google-controlled)
- PO Tokens: ~12 hours (require regeneration)
- UniversalCache session data: recreated as needed

---

### 5. Rate Limiting and TOS Risks

**Confidence: HIGH** — multiple authoritative sources

#### YouTube Terms of Service Violation

YouTube's ToS explicitly prohibits:
> "access the Service using any automated means (such as robots, botnets or scrapers), except as permitted by Google"

`youtubei.js` is a reverse-engineered client that emulates InnerTube API calls. Its use without YouTube's explicit permission violates these terms. The library's own README acknowledges: "This project is not affiliated with, endorsed, or sponsored by YouTube or any of its affiliates or subsidiaries."

Source: https://developers.google.com/youtube/terms/developer-policies

#### Account Suspension Risk

Community reports (Hacker News discussion, 2022) describe:
- Heavy or automated usage risks account suspension
- Google may ban accounts AND linked accounts (accounts sharing recovery email domains or payment methods)
- The cascading ban risk makes it dangerous to use a primary Google account for automation

**Practical mitigation:** Use a dedicated secondary Google account for automated access. Never use your primary account.

#### API Stability Risk

YouTube's private InnerTube API changes without notice. The library breaks periodically when YouTube updates internal API response formats, client versions, or authentication mechanisms:
- OAuth was deprecated/restricted in 2024 (limiting it to TV clients only)
- Cookie auth gained new HttpOnly requirements in mid-2024 (Issue #707)
- PO Token requirement added August 2024
- OAuth scope `http://gdata.youtube.com` deprecated (Issue #1019, late 2025)

yt-dlp briefly added TV OAuth support in 2024 but YouTube killed it within months. The pattern is clear: Google actively closes unofficial authentication methods.

#### PO Token Complexity

Since August 2024, YouTube requires PO Tokens for stream access from web clients. Without one:
- Web-based clients receive streams throttled or cut off after ~1-2MB
- Requests may return 403 errors
- The `BgUtils` library can generate PO Tokens but requires a compliant environment (running BotGuard's bytecode)

This adds ongoing maintenance burden — PO Tokens expire in ~12 hours and the BotGuard challenge changes as Google updates it.

#### Rate Limiting

YouTube applies server-side rate limiting on InnerTube requests. No specific rate limits are documented publicly. Heavy streaming or API hammering will trigger throttling or temporary blocks. All YouTube streams are rate-limited at the network level by default (bandwidth throttling on stream bytes served).

#### Copyright Risk (Music Streaming)

For YouTube Music streams specifically: even if you have a valid Premium account and can get ad-free streams, streaming copyrighted music outside of an official YouTube Music client may violate DMCA and music licensing agreements. Personal offline use is a different legal situation from building a service that streams music to other users.

---

## Key Takeaways

1. **Cookie auth is the only reliable method as of 2025.** OAuth2 is restricted to the TV client only and requires a device-code flow. Cookie auth works for web, mobile, and music clients.

2. **Two HttpOnly cookies are required** (`__Secure-1PSID`, `__Secure-1PSIDTS`) and must be manually extracted from the Application → Cookies panel in browser DevTools, not just from request headers. Without them, Node.js usage returns 401 errors.

3. **Auth unlocks: playlists, liked songs (via library/playlist ID `LM`), history, personalized home feed, YouTube Music library.** Premium audio quality streams are available if the authenticated account has an active Premium subscription — the library does not bypass the subscription.

4. **OAuth persistence** uses `signIn(credentials)` with credentials saved from the `auth` event. The `update-credentials` event handles automatic token refresh. Access tokens live ~60 minutes; refresh tokens until revoked.

5. **Cookie persistence** is a stored string in an env var or secrets manager. No refresh mechanism — re-extract from browser when expired (weeks to months lifetime).

6. **PO Tokens are a separate concern** from account authentication. They are anti-bot attestation tokens required for stream access since August 2024 and expire every ~12 hours.

7. **The TOS risk is real.** Using `youtubei.js` for automated access violates YouTube's Terms of Service. Account bans are possible, especially with heavy use. Use dedicated accounts and implement conservative request rates.

8. **API breakage is ongoing.** Google actively restricts unofficial access methods. OAuth was broken/restricted in 2024. OAuth scopes deprecated in 2025. This requires ongoing maintenance.

---

## Gaps Identified

- **No official documentation on what "YouTube Music Premium" quality level is returned** vs non-Premium for authenticated streams. The library returns whatever YouTube's servers provide for the credentials — testing against a Premium account is needed to confirm format quality differences.
- **`getHistory()` on the Music client** — not explicitly listed on the `Music` class methods. History appears to be accessible via the top-level `Innertube.getHistory()` (which returns all watch history including music). A dedicated `music.getHistory()` was not found in the Music class API docs.
- **Liked Songs playlist ID `LM`** — this is a well-known constant in ytmusicapi (Python) but not explicitly documented in youtubei.js docs. Community usage confirms it works with `innertube.music.getPlaylist('LM')` for authenticated sessions.
- **PO Token generation in production** — the full pipeline for generating PO Tokens programmatically (using BgUtils) requires running BotGuard's bytecode in a compliant JS environment. The exact production requirements for this are not fully documented.

---

## Sources

| Source | URL | Confidence |
|--------|-----|------------|
| YouTube.js Authentication Guide (official docs) | https://ytjs.dev/guide/authentication | HIGH |
| YouTube.js Getting Started Guide (official docs) | https://ytjs.dev/guide/getting-started | HIGH |
| Innertube class API reference | https://www.ytjs.dev/api/classes/Innertube | HIGH |
| Music class API reference | https://ytjs.dev/api/youtubei.js/namespaces/Clients/classes/Music.html | HIGH |
| GitHub — LuanRT/YouTube.js | https://github.com/LuanRT/YouTube.js | HIGH |
| GitHub — LuanRT/BgUtils (PO Token generation) | https://github.com/LuanRT/BgUtils | HIGH |
| Issue #707 — Cookie auth HttpOnly problem (Aug 2024) | https://github.com/LuanRT/YouTube.js/issues/707 | HIGH |
| Issue #1019 — OAuth scope deprecated (Dec 2025) | https://github.com/LuanRT/YouTube.js/issues/1019 | HIGH |
| Issue #824 — Custom OAuth scope error | https://github.com/LuanRT/YouTube.js/issues/824 | HIGH |
| Volumio wiki — How to obtain Cookie | https://github.com/patrickkfkan/Volumio-YouTube.js/wiki/How-to-obtain-Cookie | MEDIUM |
| Hacker News discussion — YouTube.js community risks | https://news.ycombinator.com/item?id=31021611 | MEDIUM |
| yt-dlp wiki — PO Token Guide | https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide | MEDIUM |
| YouTube API Developer Policies | https://developers.google.com/youtube/terms/developer-policies | HIGH |
| Music Assistant — YouTube Music auth changes 2024 | https://www.music-assistant.io/music-providers/youtube-music/ | MEDIUM |
| Prior research: youtubei.js API surface | /AI_RESEARCH/2026-03-05-youtubei-js-api-surface.md | HIGH |
| Prior research: YouTube Music Node.js libraries | /AI_RESEARCH/2026-03-05-youtube-music-nodejs-libraries.md | HIGH |
