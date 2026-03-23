# Research: ytmusicapi (Python) — Authentication After OAuth Credential Removal

Date: 2026-03-23

## Summary

`ytmusicapi` (PyPI: `ytmusicapi`, GitHub: sigma67/ytmusicapi) is the most popular Python wrapper for YouTube Music's internal InnerTube API. As of late 2024, Google **broke third-party OAuth2** for YouTube Music, forcing the ecosystem back to browser-cookie-based authentication. The library now supports OAuth again but **requires users to supply their own Google Cloud OAuth client credentials** (client ID + secret). Browser header extraction remains the simpler and more stable approach for most use cases. There is no auto-refresh for browser sessions — those cookies last approximately 2 years by default. OAuth tokens auto-refresh automatically via `RefreshingToken`. Neither method uses the official YouTube Data API.

## Prior Research

- `/AI_RESEARCH/2026-03-05-youtube-music-nodejs-libraries.md` — library landscape for Node.js (parallel ecosystem)
- `/AI_RESEARCH/2026-03-12-youtubei-js-authentication-deep-dive.md` — cookie auth and OAuth for youtubei.js (Node.js)
- `/AI_RESEARCH/2026-03-23-youtubei-js-oauth-ytmusic-client-mismatch.md` — OAuth/TVHTML5 vs WEB_REMIX client mismatch

## Current Findings

---

### 1. Authentication Methods Supported (2025-2026)

**Confidence: HIGH** — from official documentation and source code inspection.

Source: https://ytmusicapi.readthedocs.io/en/stable/setup/index.html

As of version 1.11.5 (released 2026-01-31), ytmusicapi supports three `AuthType` values in `ytmusicapi/auth/types.py`:

| AuthType | Description |
|---|---|
| `UNAUTHORIZED` | No auth — unauthenticated/public requests only |
| `BROWSER` | Browser session headers (cookie + authorization header) |
| `OAUTH_CUSTOM_CLIENT` | OAuth via Google device-code flow using user-supplied client credentials |
| `OAUTH_CUSTOM_FULL` | Fully formed OAuth headers (skips browser auth refresh flow) |

**Key point:** The `OAUTH_DEFAULT` type (shared library-provided credentials) was explicitly **removed** in v1.10.0 (2025-01-31). The release notes state: "removed non-functional OAUTH_DEFAULT AuthType." This confirms that Google blocked the shared OAuth client the library previously bundled.

---

### 2. What Happened to OAuth in Late 2024

**Confidence: HIGH** — from GitHub issue #676 (created 2024-11-09, closed 2024-11-18).

Source: https://github.com/sigma67/ytmusicapi/issues/676

In November 2024, OAuth authentication broke across all third-party YouTube Music clients simultaneously. The symptom was `HTTP 400: Bad Request` with message `"Request contains an invalid argument."` — but only when using OAuth; browser-based auth continued to work. This affected ytmusicapi, yt-dlp, hass-music-assistant, and ytube_music_player simultaneously.

The root cause was identified by the community as Google disabling OAuth2 device-flow authentication for the shared/bundled OAuth client credentials that ytmusicapi (and many other tools) used internally. This was not a bug in ytmusicapi — it was a deliberate Google policy change.

The resolution path, implemented in **v1.9.0 (2024-12-17)**, was:
> "updated OAuth setup CLI implementation to require client ID and secret via YouTube Data API. Please check the updated documentation for usage and instructions to create the credentials."

Source: https://github.com/sigma67/ytmusicapi/releases/tag/1.9.0

v1.10.0 (2025-01-31) then cleaned up residual dead code: "removed non-functional OAUTH_DEFAULT AuthType."

---

### 3. Browser Authentication — How Cookie Extraction Works

**Confidence: HIGH** — from official docs + source code `ytmusicapi/auth/browser.py`.

Source: https://ytmusicapi.readthedocs.io/en/stable/setup/browser.html

This is a **purely manual process** with no automation tooling provided by ytmusicapi itself.

#### Required headers (minimum)
The library validates for two mandatory fields:
- `cookie` — the full Cookie header value from an authenticated YouTube Music session
- `x-goog-authuser` — numeric account index (usually `"0"`)

Other commonly present headers: `authorization`, `accept`, `accept-language`, `content-type`, `origin`, `x-origin`, `user-agent`, `x-youtube-client-name`, `x-youtube-client-version`.

#### Manual extraction steps (Firefox — recommended)
1. Open Network tab (Ctrl-Shift-I)
2. Navigate to `https://music.youtube.com` while logged in
3. Filter requests by `/browse`; find a POST request with Status 200
4. Right-click → "copy > copy request headers"
5. Run `ytmusicapi browser` and paste headers when prompted

#### Manual extraction steps (Chrome/Chromium — problematic as of 2025)
Chrome changed its copy format in early 2024: keys and values are now on **separate lines without colons**, breaking the ytmusicapi parser. As of 2026-01-27 (issue #857, still open), this is an **unresolved bug**.

Source: https://github.com/sigma67/ytmusicapi/issues/857

Workaround: manually reformat pasted Chrome headers to `Key: Value` format before pasting.

#### Programmatic setup
```python
import ytmusicapi

# From raw header string
ytmusicapi.setup(filepath="browser.json", headers_raw="<paste headers here>")

# Interactive CLI
# ytmusicapi browser
```

Source: `ytmusicapi/auth/browser.py`, function `setup_browser()`

#### The resulting `browser.json` file
A JSON file with lowercase header keys. Minimum viable structure:
```json
{
    "accept": "*/*",
    "authorization": "SAPISIDHASH ...",
    "content-type": "application/json",
    "cookie": "__Secure-1PSID=...; ...",
    "x-goog-authuser": "0",
    "x-origin": "https://music.youtube.com"
}
```

Note: The documentation formerly referred to this as `headers_auth.json` but the current docs and CLI use `browser.json`. The filename is arbitrary — it is passed as the `filepath` parameter to `YTMusic()`.

#### Usage
```python
from ytmusicapi import YTMusic
ytmusic = YTMusic("browser.json")
```

---

### 4. Cookie / Session Expiration and Refresh

**Confidence: HIGH** — from official docs and issue #676 discussion.

Source: https://ytmusicapi.readthedocs.io/en/stable/setup/browser.html

> "The credentials remain valid for approximately 2 years unless the user logs out."

**There is no auto-refresh for browser auth.** The `BROWSER` AuthType has no refresh mechanism — the `Cookie` header is static. When the session expires (logged out, password change, 2-year natural expiration, or Google security event), the user must manually re-extract headers and regenerate `browser.json`.

**Tips for extending session lifetime** (from community discussion, issue #676):
- Extract cookies from a **private/incognito browser window** to avoid the session being invalidated by normal browsing activity
- Use a **dedicated Google account** for the integration rather than a primary account

**Chrome vs Firefox note:** The community in issue #676 found that some browsers produced cookies with `"te": "trailers\u001a"` entries that caused auth failures. Removing that entry from the JSON file resolved the issue.

---

### 5. OAuth Authentication (Current Approach, v1.9.0+)

**Confidence: HIGH** — from official docs and source code.

Source: https://ytmusicapi.readthedocs.io/en/stable/setup/oauth.html

#### What it uses
Google's **"TV and Limited Input Devices" device-code OAuth flow** (not standard OAuth2 authorization code flow). This is designed for headless environments where a browser redirect isn't possible.

The OAuth scope used: `https://www.googleapis.com/auth/youtube`
Device code URL: `https://www.youtube.com/o/oauth2/device/code`
Token URL: `https://oauth2.googleapis.com/token`

Source: `ytmusicapi/constants.py`

#### Credential requirements
Users must create their own Google Cloud Console credentials:
1. Enable **YouTube Data API v3**
2. Create an OAuth 2.0 client ID with type **"TVs and Limited Input devices"**
3. Obtain `client_id` and `client_secret`

#### Initial setup (interactive, one-time)
```bash
ytmusicapi oauth --client-id YOUR_ID --client-secret YOUR_SECRET
```
This opens a verification URL, waits for user confirmation, then writes `oauth.json`.

#### Runtime usage
```python
from ytmusicapi import YTMusic, OAuthCredentials

ytmusic = YTMusic(
    "oauth.json",
    oauth_credentials=OAuthCredentials(
        client_id=client_id,
        client_secret=client_secret
    )
)
```

#### Auto-refresh behavior (key advantage over browser auth)
**OAuth tokens auto-refresh automatically.** The `RefreshingToken` class in `ytmusicapi/auth/oauth/token.py` overrides `__getattribute__` on `access_token`:

```python
def __getattribute__(self, item: str) -> Any:
    if item == "access_token" and self.is_expiring:
        fresh = self.credentials.refresh_token(self.refresh_token)
        self.update(fresh)
        self.store_token()
    return super().__getattribute__(item)
```

When the access token is within 60 seconds of expiring (`is_expiring` checks `expires_at - time.time() < 60`), it automatically calls `credentials.refresh_token()` and updates `oauth.json` with the new token. This means the `oauth.json` file is rewritten on disk after each refresh — **it must be writable by the process**.

#### Current OAuth bug (as of 2026-03-22)
Issue #887 (open, 2026-03-22) reports that Google recently added a `refresh_token_expires_in` field to the device-code OAuth response. This causes `RefreshingToken.__init__()` to crash with `TypeError: unexpected keyword argument`. The workaround is `raw_token.pop("refresh_token_expires_in", None)` before token construction.

Source: https://github.com/sigma67/ytmusicapi/issues/887

---

### 6. Headless / Server Environment Recommendations

**Confidence: HIGH** — synthesized from docs and issue discussions.

**Browser auth** is simpler but has an operational burden: sessions must be re-extracted manually every ~2 years (or earlier if the session is invalidated). For a server that runs indefinitely, this creates a maintenance window.

**OAuth auth** is designed for headless use (device-code flow doesn't require a browser on the server) and tokens auto-refresh indefinitely — meaning no manual intervention after initial setup. However:
- Requires a Google Cloud Console project and YouTube Data API credentials
- The initial `ytmusicapi oauth` setup must be run interactively once
- The `oauth.json` file must be writable at runtime (tokens are re-saved after refresh)
- As of 2026-03-22, there is a crash bug (issue #887) blocking the initial setup on the latest version

**Current (March 2026) pragmatic recommendation:** Use browser auth until issue #887 is patched. After the patch, OAuth is the better long-term choice for server environments due to automatic token refresh.

**Discussion #795 (programmatic oauth.json generation):** A user asked whether `oauth.json` can be generated non-interactively for production environments. As of the discussion (July 2025), there was no documented fully-headless initialization path — the `prompt_for_token` method requires the user to visit a URL and press Enter. The `RefreshingToken.prompt_for_token()` source shows it calls `input()` — this blocks until a human interacts. For a CI/deploy scenario, the `oauth.json` file must be pre-generated and then deployed as a secret.

Source: https://github.com/sigma67/ytmusicapi/discussions/795

---

### 7. Google OAuth2 with YouTube Data API Scopes as an Alternative

**Confidence: HIGH** — supported by the evidence, not speculative.

The OAuth flow that ytmusicapi uses (`OAUTH_CUSTOM_CLIENT`) IS Google OAuth2 — specifically the YouTube Data API's device-code flow with scope `https://www.googleapis.com/auth/youtube`. So there is no meaningful distinction between "ytmusicapi OAuth" and "Google OAuth2 with YouTube Data API scopes" — they are the same thing.

**Important distinction:** The `youtube` scope is broader than `youtube.readonly` but narrower than full YouTube access. ytmusicapi uses this scope for both read and write operations (e.g., adding to library, rating songs).

**Why this works for music-specific operations:** YouTube Music's internal InnerTube API is the same API as YouTube's web client uses. The OAuth token is used as a Bearer token in the `Authorization` header on requests to `music.youtube.com/youtubei/v1/`. The YouTube Data API OAuth credentials work because they grant a Google account session token, not because the YouTube Data API's REST endpoints are being called.

**Limitations:** Music uploads (`upload_song`) require browser auth, not OAuth — the upload endpoint does not accept OAuth credentials. This is documented explicitly.

Source: https://ytmusicapi.readthedocs.io/en/stable/setup/index.html

---

## Key Takeaways

- **OAuth was not "removed" — it was changed.** Shared built-in client credentials were removed in v1.10.0. OAuth still works with user-supplied Google Cloud credentials.
- **Browser auth uses raw cookie extraction** — no tooling automation, purely manual copy-paste from browser dev tools.
- **Browser cookies last ~2 years** with no auto-refresh. OAuth tokens auto-refresh indefinitely via `RefreshingToken`.
- **Chrome header extraction is currently broken** (issue #857, open since Jan 2026). Firefox is the reliable path.
- **OAuth has a crash bug** as of March 2026 (issue #887) due to a new Google response field.
- **Neither method uses official YouTube Music APIs.** Both target the internal InnerTube API at `music.youtube.com/youtubei/v1/`.
- **Music uploads require browser auth** — OAuth credentials do not work for the upload endpoint.
- **For production/server use:** OAuth is architecturally superior (auto-refresh), but requires a one-time interactive setup and a writable `oauth.json` file.

---

## Sources

| URL | Content |
|---|---|
| https://ytmusicapi.readthedocs.io/en/stable/setup/index.html | Auth overview |
| https://ytmusicapi.readthedocs.io/en/stable/setup/browser.html | Browser auth docs |
| https://ytmusicapi.readthedocs.io/en/stable/setup/oauth.html | OAuth auth docs |
| https://github.com/sigma67/ytmusicapi/releases/tag/1.9.0 | v1.9.0 changelog — OAuth credential change |
| https://github.com/sigma67/ytmusicapi/releases/tag/1.10.0 | v1.10.0 changelog — OAUTH_DEFAULT removal |
| https://github.com/sigma67/ytmusicapi/releases/tag/1.11.5 | v1.11.5 changelog — latest release (2026-01-31) |
| https://github.com/sigma67/ytmusicapi/issues/676 | Issue: OAuth 400 Bad Request (Nov 2024, root cause identified) |
| https://github.com/sigma67/ytmusicapi/issues/857 | Issue: Chrome header parsing broken (Jan 2026, still open) |
| https://github.com/sigma67/ytmusicapi/issues/887 | Issue: OAuth device flow crash on `refresh_token_expires_in` (Mar 2026, still open) |
| https://github.com/sigma67/ytmusicapi/discussions/793 | Discussion: Chrome browser auth failure (Jul 2025) |
| https://github.com/sigma67/ytmusicapi/discussions/795 | Discussion: Programmatic oauth.json generation (Jul 2025) |
| GitHub: `ytmusicapi/auth/types.py` | AuthType enum — UNAUTHORIZED, BROWSER, OAUTH_CUSTOM_CLIENT, OAUTH_CUSTOM_FULL |
| GitHub: `ytmusicapi/auth/oauth/token.py` | RefreshingToken auto-refresh logic |
| GitHub: `ytmusicapi/auth/oauth/credentials.py` | OAuthCredentials class |
| GitHub: `ytmusicapi/auth/browser.py` | setup_browser() — header parsing logic |
| GitHub: `ytmusicapi/constants.py` | OAuth URLs, scope, user agent |
