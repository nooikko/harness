# Research: youtubei.js — OAuth/TVHTML5 vs WEB_REMIX Client Mismatch and YouTube Music Authentication

Date: 2026-03-23

## Summary

The TVHTML5 device-code OAuth flow and the YTMUSIC (WEB_REMIX) client are fundamentally incompatible. This is a known, intentional Google-side constraint — not a youtubei.js bug. Google restricted OAuth2 authentication to the TV Innertube client in 2024, and the `yt.music.*` methods force `client: 'YTMUSIC'` (WEB_REMIX) on every request. There is no way to use device-code OAuth tokens with the WEB_REMIX client. Cookie-based authentication is the only practical path for YouTube Music access in a Node.js server application. Cookies last weeks to months and can be made more persistent with a dedicated account and incognito extraction. PO Tokens are a separate anti-bot requirement for stream access (not library/search).

## Prior Research

- `/AI_RESEARCH/2026-03-12-youtubei-js-authentication-deep-dive.md` — comprehensive coverage of auth methods, cookie extraction, OAuth persistence, PO Tokens, and TOS risks. **Read this first.**
- `/AI_RESEARCH/2026-03-05-youtubei-js-api-surface.md` — `yt.music.*` API surface
- `/AI_RESEARCH/2026-03-05-youtube-music-nodejs-libraries.md` — library landscape

## Current Findings

---

### 1. Is the TVHTML5/WEB_REMIX Mismatch a Known Issue?

**Confidence: HIGH** — Confirmed in official documentation

The youtubei.js official documentation at https://ytjs.dev/guide/authentication states explicitly:

> "Due to changes made by Google, OAuth2 authentication now only works with the TV Innertube client."

This is the root cause. The device-code OAuth flow (designed for smart TVs and limited-input devices) authenticates the session as a TVHTML5 client. When that session subsequently makes requests through `yt.music.*`, those methods unconditionally set `client: 'YTMUSIC'` (WEB_REMIX) in the request payload. YouTube's servers see OAuth credentials issued to a TVHTML5 client being used from a WEB_REMIX context and reject with 400 INVALID_ARGUMENT.

The Music.ts source at `github.com/LuanRT/YouTube.js/blob/main/src/core/clients/Music.ts` confirms that `'YTMUSIC'` is hardcoded as the client identifier in 15+ method calls with no mechanism to override it per-request to use a TV client context.

This is **not a bug** that will be fixed — it is a Google-side policy constraint. The library's own docs acknowledge it without offering a Music-specific workaround.

---

### 2. Has This Specific Mismatch Been Reported as a Bug?

**Confidence: MEDIUM** — Corroborated by multiple related reports, no single canonical youtubei.js issue

No single GitHub issue in LuanRT/YouTube.js explicitly frames this as "OAuth token from TV flow + Music WEB_REMIX client = 400." However, the symptom has been reported across multiple related projects:

- **ytmusicapi (Python) Issue #676 and Discussion #682** — OAuth produces 400 INVALID_ARGUMENT on all `yt.music.*` endpoints including search, rate_song, and get_history while browser cookie auth works. The maintainer labeled this `yt-update` (server-side change). One user resolved it by switching from a branded account to a primary Gmail account — suggesting account-level scope restrictions may also play a role.

- **yt-dlp Issue #11462** — "HTTP Error 400 Bad Request using OAuth, but cookies work." Same pattern across a different library.

- **multi-scrobbler Issue #345** — "YTM error 400 on API call" when using OAuth credentials with a YouTube Music endpoint.

The pattern is consistent: OAuth tokens (issued for TV/device-code flow) fail with 400 on Music endpoints. Cookie auth succeeds. This is the TVHTML5/WEB_REMIX client context mismatch manifesting as a 400.

**The harness music plugin already has a comment acknowledging this.** In `packages/plugins/music/src/_helpers/youtube-music-client.ts`, line 118:
```typescript
// Authenticated clients can get 400s from YouTube's search endpoint.
// Fall back to an anonymous client for search — it doesn't need auth.
```
The existing fallback only covers `searchSongs`. Methods like `getLibrary()`, `getPlaylist('LM')` (liked songs), and `getHomeFeed()` require auth and have no fallback.

---

### 3. Is There a Way to Use Google OAuth That Produces WEB_REMIX-Compatible Tokens?

**Confidence: HIGH — No, not via youtubei.js**

There is no documented path to get OAuth tokens compatible with WEB_REMIX from youtubei.js. The reasons:

- The library's OAuth implementation uses the "TVs and Limited Input devices" application type in Google's OAuth2 system, which produces tokens scoped to the TVHTML5 client context.
- Standard web application OAuth (Authorization Code flow) produces tokens for web clients, but the library does not implement this flow, and using raw Google OAuth tokens with InnerTube is not documented.
- Issue #1019 raised that the default scope `http://gdata.youtube.com` used by the library is deprecated. The correct scope is `https://www.googleapis.com/auth/youtube`, but fixing the scope alone does not change the client-type binding problem — tokens still come from a TV client registration.

**The only workaround within youtubei.js architecture** would be to use cookie auth, which is how the WEB_REMIX client context was originally authenticated in the browser.

---

### 4. Are There Alternative Approaches for Server-Side Long-Term Authenticated Access?

**Confidence: HIGH** — established community consensus

#### Option A: Cookie Authentication (Recommended — Practical Best Path)

This is the official recommendation from the youtubei.js docs and the established approach across all YouTube Music unofficial libraries (ytmusicapi, Music Assistant, Volumio, etc.).

```typescript
const innertube = await Innertube.create({
  cookie: process.env.YT_MUSIC_COOKIE,
  cache: new UniversalCache(true),
  generate_session_locally: true,
  retrieve_player: true,
});
// innertube.session.logged_in === true
// yt.music.getLibrary(), getHomeFeed(), etc. all work
```

**Cookie longevity in practice:**
- Extracting via incognito window and NOT signing out before closing: weeks to several months
- Using a dedicated account exclusively for the server (not used for personal music playback): longest lifetime
- Google may invalidate server-side at any time (password change, security event, inactivity)
- Community reports range from "a few days" (family account) to "over a year" (dedicated account, incognito extraction, never logged out)

**Critical extraction gotcha** (Issue #707, confirmed HIGH confidence): The cookies `__Secure-1PSID` and `__Secure-1PSIDTS` are marked HttpOnly in the browser. Standard DevTools "Request Headers → Cookie" copy does NOT include them. They must be copied from the Application → Cookies panel. Without them, Node.js gets 401 UNAUTHENTICATED even with an otherwise valid cookie string.

**What cookies are needed (minimum viable set):**
```
__Secure-1PSID=...
__Secure-1PSIDTS=...
SID=...
HSID=...
SSID=...
APISID=...
SAPISID=...
__Secure-3PAPISID=...
```

**Persistence:** Store in environment variable or secrets manager. No refresh mechanism — re-extract when expired.

#### Option B: Dedicated Account + Cookie Refresh Automation

For a persistent server application, the most reliable pattern documented in the community is:

1. Create a dedicated Google account used only for the server (not personal music playback)
2. Give it YouTube Music Premium (same family plan as primary)
3. Extract cookies from incognito window once
4. Store in secrets manager
5. When 401 errors appear, re-extract (schedule manually or alert on failure)
6. Optionally automate re-extraction using Playwright against the YouTube Music web UI (not documented in youtubei.js but used by some self-hosted setups)

This is what Music Assistant's documentation recommends: "setting up a dedicated account for MA" for best longevity.

#### Option C: SAPISID/SAPISIDHASH-based Auth (Advanced)

**Confidence: MEDIUM** — community-confirmed but not fully documented in youtubei.js

The underlying authentication mechanism for YouTube InnerTube requests uses:
- Cookie header (SID, SAPISID, __Secure-1PSID, etc.)
- Authorization header: `SAPISIDHASH {timestamp}_{sha1(timestamp + " " + SAPISID + " " + origin)}`

youtubei.js computes this automatically from the cookie string. Some users have reported that providing the full cookie string including HttpOnly cookies resolves authentication failures. There is an open stale issue (#1012) about whether `DATASYNC_ID` also needs to be incorporated into SAPISIDHASH computation.

This is not a separate auth path — it is what happens under the hood when you pass a cookie to `Innertube.create()`. Understanding it is useful for debugging auth failures.

#### Option D: Use PO Tokens for Stream Access (Separate from Account Auth)

**Confidence: HIGH** — documented at https://github.com/LuanRT/BgUtils and https://ytjs.dev

Since August 2024, YouTube requires Proof of Origin (PO) tokens for streaming URLs from web clients. This is **orthogonal to account auth** — it does not help with the OAuth/WEB_REMIX 400 problem, but it is required for streams to work alongside cookie auth.

```typescript
const innertube = await Innertube.create({
  cookie: process.env.YT_MUSIC_COOKIE,
  po_token: process.env.YT_PO_TOKEN,
  visitor_data: process.env.YT_VISITOR_DATA,
});
```

PO Tokens expire in ~12 hours. The companion library `LuanRT/BgUtils` can generate them programmatically by running BotGuard's attestation challenge. The `youtube-po-token-generator` npm package automates this.

For the harness music plugin: PO tokens matter for `getAudioStreamUrl()` (streaming). They do not affect `search()`, `getLibrary()`, `getPlaylist()`, or `getHomeFeed()`.

---

### 5. Recent Changes in youtubei.js Regarding OAuth + YouTube Music (2024-2026)

**Confidence: HIGH**

A timeline of relevant changes:

| Date | Change | Impact |
|------|--------|--------|
| 2024 (Q3) | Google restricts OAuth2 to TV client only | OAuth no longer works for any non-TV client, including WEB_REMIX/YTMUSIC |
| August 2024 | PO Token requirement added for web streaming | `po_token` needed for stream URL access |
| Mid-2024 | HttpOnly cookies issue confirmed (#707) | Cookie auth in Node.js requires manual extraction of `__Secure-1PSID` and `__Secure-1PSIDTS` |
| November 2024 | ytmusicapi (Python) confirms: OAuth → 400, cookie → works | Corroborates the client-type mismatch |
| October 2025 | Issue #1051: `OAuth.revokeCredentials` bug | Library sends access token for revocation but should send refresh token in JSON body |
| December 2025 | Issue #1019: Default OAuth scope deprecated | `http://gdata.youtube.com` scope no longer valid; should be `https://www.googleapis.com/auth/youtube` |
| March 2025 | PO Token enforcement tightened | Music Assistant confirms signature extraction failures without PO Token add-on |

No v13–v17 changelog entries address the OAuth/Music client mismatch directly. The CHANGELOG shows v14 added `TV_SIMPLY` client, v17 added `ANDROID_VR` client, but no Music client auth changes.

---

### 6. Implications for the Harness Music Plugin

The current implementation (`packages/plugins/music/src/_helpers/youtube-music-client.ts`) does the right thing:
- Cookie auth path is correctly wired through `Innertube.create({ cookie })`
- OAuth path (device-code flow) will silently fail for all `yt.music.*` endpoints due to the client mismatch
- The `searchSongs` fallback to anonymous client handles the 400 for search specifically
- `getLibrary()` and `getPlaylist('LM')` (liked songs) are authenticated-only and have no fallback — these will fail if OAuth is the auth method

**Practical fix:** The OAuth auth method in the settings should either be removed from the music plugin or displayed with a clear warning that it only authenticates against the TV Innertube client and will fail for all `yt.music.*` methods. Cookie auth is the only supported path for YouTube Music functionality.

---

## Key Takeaways

1. **Root cause confirmed:** Google restricted OAuth2 to TV (TVHTML5) client in 2024. The Music client hardcodes WEB_REMIX. Tokens are client-scoped. This cannot be fixed within youtubei.js.

2. **No fix exists** for getting OAuth tokens to work with YTMUSIC client — this is a Google policy, not a library bug.

3. **Cookie auth is the only path** for `yt.music.*` methods (library, liked songs, playlists, home feed). It is documented, stable, and works.

4. **Cookie longevity** is the real reliability concern: incognito extraction, dedicated account, and not using the account for personal playback maximizes lifetime (potentially months to a year+).

5. **HttpOnly cookie extraction is required.** Standard DevTools Network tab copy misses `__Secure-1PSID` and `__Secure-1PSIDTS`. Must use Application → Cookies panel.

6. **PO Tokens are separate.** They affect streaming (audio stream URLs) but not library/search/playlist API calls. The current music plugin code already handles the stream decipher path.

7. **The harness plugin should deprecate/remove the OAuth auth method** for YouTube Music, or show a clear warning that OAuth only authenticates to a TVHTML5 session which is incompatible with all `yt.music.*` endpoints.

---

## Gaps Identified

- **Automated cookie refresh via Playwright**: No documented approach in youtubei.js ecosystem, but technically feasible. Would eliminate the manual re-extraction step.
- **ytmusicapi (Python) as an alternative**: The Python library uses a different auth approach (direct browser cookies with specific headers). It may handle the OAuth removal more gracefully. Not applicable to Node.js context.
- **Whether ANDROID client type** could be used as an alternative to YTMUSIC for music search while being OAuth-compatible: the `yt.music.*` methods hardcode YTMUSIC and there is no client override. The main `Innertube` class allows `{ client: 'ANDROID' }` on some methods but ANDROID client does not access YouTube Music endpoints.

---

## Sources

| Source | URL | Confidence |
|--------|-----|------------|
| YouTube.js Authentication Guide | https://ytjs.dev/guide/authentication | HIGH |
| Music.ts source — hardcoded YTMUSIC client | https://github.com/LuanRT/YouTube.js/blob/main/src/core/clients/Music.ts | HIGH |
| Issue #707 — HttpOnly cookie requirement | https://github.com/LuanRT/YouTube.js/issues/707 | HIGH |
| Issue #1019 — Default OAuth scope deprecated | https://github.com/LuanRT/YouTube.js/issues/1019 | HIGH |
| Issue #1051 — OAuth revokeCredentials bug | https://github.com/LuanRT/YouTube.js/issues/1051 | HIGH |
| CHANGELOG — v13–v17 client changes | https://github.com/LuanRT/YouTube.js/blob/main/CHANGELOG.md | HIGH |
| ytmusicapi Issue #676 — OAuth 400 on all Music endpoints | https://github.com/sigma67/ytmusicapi/issues/676 | HIGH |
| ytmusicapi Discussion #682 — Nov 2024 OAuth removal | https://github.com/sigma67/ytmusicapi/discussions/682 | HIGH |
| ytmusicapi OAuth setup docs | https://ytmusicapi.readthedocs.io/en/stable/setup/oauth.html | HIGH |
| Music Assistant — YouTube Music auth | https://www.music-assistant.io/music-providers/youtube-music/ | MEDIUM |
| yt-dlp Issue #11462 — OAuth 400 cookie works | https://github.com/yt-dlp/yt-dlp/issues/11462 | MEDIUM |
| multi-scrobbler Issue #345 — YTM error 400 | https://github.com/FoxxMD/multi-scrobbler/issues/345 | MEDIUM |
| Issue #1012 — SAPISIDHASH DATASYNC_ID question | https://github.com/LuanRT/YouTube.js/issues/1012 | LOW |
| Prior research: authentication deep dive | /AI_RESEARCH/2026-03-12-youtubei-js-authentication-deep-dive.md | HIGH |
