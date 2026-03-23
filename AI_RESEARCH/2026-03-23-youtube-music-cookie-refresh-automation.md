# Research: YouTube Music Cookie Refresh Automation for Server-Side Applications

Date: 2026-03-23

## Summary

There is no clean, automated solution for YouTube Music cookie refresh. The ecosystem has explored multiple approaches — headless browser automation, RotateCookies endpoint implementation, Firefox SQLite extraction, and PO Token delegation — but each has significant friction or is actively countered by Google. The most practical current path for server-side use is: (1) cookie auth via ytmusicapi's OAuth TV flow for Python contexts (RefreshingToken auto-refresh), or (2) cookie-based auth with a dedicated account, incognito extraction, and manual re-extraction on expiry (weeks to months lifetime). Automated Playwright/Puppeteer re-authentication against Google sign-in is known to be blocked in headless mode. PO Tokens (for stream access) have their own separate automated solution: `bgutil-ytdlp-pot-provider` runs as a Docker sidecar with no cookies required.

## Prior Research

- `/AI_RESEARCH/2026-03-23-youtubei-js-oauth-ytmusic-client-mismatch.md` — OAuth/TVHTML5 vs WEB_REMIX client mismatch confirmed. Cookie auth is the only viable path for `yt.music.*` methods.
- `/AI_RESEARCH/2026-03-12-youtubei-js-authentication-deep-dive.md` — full authentication deep dive: cookie extraction, OAuth flow, PO tokens, HttpOnly cookie requirement.
- `/AI_RESEARCH/2026-03-05-youtube-music-nodejs-libraries.md` — library landscape comparison.

## Current Findings

---

### Question 1: Headless Browser Automation for Google Sign-In and Cookie Extraction

**Confidence: LOW** — community attempts exist but are largely blocked

**The fundamental problem:**
Google's sign-in flow actively detects and blocks headless browsers. The issue `"Couldn't sign you in"` on puppeteer/puppeteer#4871 documents this specifically for Google Cloud Functions. Google's account security checks flag:
- Missing browser fingerprint artifacts (WebGL, canvas, fonts)
- Missing human interaction heuristics
- IP reputation (datacenter IPs are blocked more aggressively than residential)

**`puppeteer-extra-plugin-stealth` status:** This plugin patched many fingerprinting signals but its maintenance stopped in March 2023. As of 2026, it is described as "stale" against modern Google security. Source: search results citing playwright-extra/puppeteer-extra maintenance status.

**Known Google-blocked signal — `"Couldn't sign you in"`:**
Google rejects sign-in from headless Chrome in cloud environments. This is not a Puppeteer/Playwright limitation — it is Google's server-side account security. The error is account-level, not browser-level.

**The one documented exception:** Running a **non-headless visible browser** on a desktop machine (with GUI) can complete Google sign-in. This is what the Firefox SQLite approach below leverages — sign in once manually, then extract via unencrypted database on disk.

**joedioufy/puppeteer-google:**
- URL: https://github.com/joedioufy/puppeteer-google
- Automates Google sign-in via Puppeteer, but is primarily demonstrated for non-headless desktop automation, not server-side continuous operation.
- No YouTube Music-specific cookie handling.

**Conclusion:** No working, maintained, headless-browser Google-sign-in automation project specifically for YouTube Music cookie extraction was found. The general consensus across yt-dlp issues (especially #11585) is: "There will never be a 'set it up once and be done with it forever' solution for YouTube; accept this." Source: https://github.com/yt-dlp/yt-dlp/issues/11585

---

### Question 2: How yt-dlp Handles Cookie Refresh — Does It Auto-Refresh?

**Confidence: HIGH** — documented in multiple official yt-dlp issues and wiki

**yt-dlp does NOT auto-refresh cookies.** This is an explicit design decision.

**The RotateCookies mechanism (technical root cause):**
yt-dlp maintainers identified that YouTube calls `https://accounts.youtube.com/RotateCookiesPage` in the browser, which executes JavaScript to transform a value, then calls `https://accounts.youtube.com/RotateCookies` to refresh cookies. Implementing this in yt-dlp was deemed "not really feasible or worthwhile to maintain."
Source: https://github.com/yt-dlp/yt-dlp/issues/8227

**Cookie rotation triggers:**
1. Opening YouTube in an active browser tab (rotation happens automatically via RotateCookiesPage JS)
2. Using the same session in the browser after exporting cookies to a file (invalidates the file)
3. Inactivity/time-based expiry (Google-controlled server-side)
4. Security events (password change, suspicious login)

**Actual cookie lifetimes from community reports:**
- **3-5 days** if cookies are from a session that remains active in a browser (Issue #13964)
- **1-2 hours** if the browser and exported cookie file share the same session simultaneously (Issue #12009)
- **Several weeks to months** if extracted from incognito, closed without signing out, and the session is never used again
- **Previously ~1 month** — Google tightened this in late 2024 with "anti-bot behaviour changes"
- **Up to 1-2 years** (claimed by ytmusicapi docs) if the browser session remains valid — but this is the theoretical maximum, not the server-side reality

Sources:
- https://github.com/yt-dlp/yt-dlp/issues/8227 (rotation mechanism)
- https://github.com/yt-dlp/yt-dlp/issues/13964 (3-5 day expiration)
- https://github.com/yt-dlp/yt-dlp/issues/12009 (1-2 hour expiration)
- https://github.com/yt-dlp/yt-dlp/wiki/extractors (recommended incognito procedure)

**yt-dlp's own recommended workaround for longevity:**
```
1. Open a new incognito/private browsing window
2. Log into YouTube
3. Navigate to https://www.youtube.com/robots.txt (only tab open)
4. Export cookies from that tab
5. Close the incognito window WITHOUT signing out
```
This prevents the browser from ever triggering RotateCookiesPage on the session, maximizing cookie lifetime.
Source: https://github.com/yt-dlp/yt-dlp/wiki/extractors

**Partially automated approach referenced in yt-dlp issues:**
- **yt-dlp-Cookie-Sync**: A community tool for automating cookie synchronization, mentioned in Issue #11773. No implementation details were available in the discussion.
- **Cronjob with `--cookies-from-browser`**: `yt-dlp --cookies-from-browser firefox --cookies /path/to/cookies.txt` can be cron-scheduled, but requires a running browser with an active session. This reads Firefox's live cookie store — not useful for headless servers.
Source: https://github.com/yt-dlp/yt-dlp/issues/11773

---

### Question 3: Google Programmatic Login or Service Accounts for YouTube Access

**Confidence: HIGH** — definitively not viable for YouTube Music

**Google Service Accounts:**
Service accounts work with Google APIs that support them (Drive, Sheets, GCS, etc.). YouTube Data API v3 does NOT support service accounts for YouTube Music access. Service accounts authenticate on behalf of a project, not a user — and YouTube Music Premium library/playback access is fundamentally user-scoped. There is no service account path to YouTube Music.

**YouTube Data API v3 (official):**
The official YouTube Data API supports OAuth 2.0 (Authorization Code flow for web apps, Device Code flow for TV apps). However, the API covers YouTube (videos, playlists, subscriptions) — NOT YouTube Music. YouTube Music's unofficial Innertube endpoints are not part of the official YouTube Data API. Using the official API for music search/playback is not viable.

**ytmusicapi OAuth TV Device Flow (closest thing to "programmatic"):**
As of November 2024, ytmusicapi requires a Google Cloud project with a `client_id` and `client_secret` for OAuth. The flow:
1. Create a Google Cloud project, enable YouTube Data API v3
2. Create OAuth credentials for "TVs and Limited Input devices"
3. Run `ytmusicapi oauth` once (user visits URL, enters device code — ONE-TIME human step)
4. Resulting `oauth.json` stores access_token + refresh_token
5. `RefreshingToken` class auto-refreshes the access_token when it expires (every ~60 minutes)

**The critical caveat for YouTube Music (from prior research):**
OAuth tokens issued for the TV device flow use the TVHTML5 client context. The `yt.music.*` endpoints in youtubei.js hardcode `client: 'YTMUSIC'` (WEB_REMIX). This mismatch produces 400 INVALID_ARGUMENT for all Music endpoints (library, liked songs, home feed). This is confirmed in `/AI_RESEARCH/2026-03-23-youtubei-js-oauth-ytmusic-client-mismatch.md`.

**Therefore:** The ytmusicapi OAuth approach works for the **Python ytmusicapi library** (which handles the WEB_REMIX client correctly despite OAuth), but NOT for the youtubei.js (Node.js) `yt.music.*` endpoints. The Python library is architecturally different.

**Google's TV OAuth refresh_token longevity:**
Google's documentation states: refresh tokens are "valid until the user revokes access or the refresh token expires." They can also be invalidated by:
- User revokes access in Google Account settings
- Account security event
- Time-based access grant (if applicable)
Under normal conditions, refresh tokens for TV device flow are indefinitely valid — they do not have a fixed expiry date.
Source: https://developers.google.com/youtube/v3/live/guides/auth/devices

---

### Question 4: Browser Extensions for Cookie Export in Server-Compatible Formats

**Confidence: HIGH** — tools exist but provide manual extraction only, no auto-refresh

**YouTube-Music-Cookie-Extractor:**
- URL: https://github.com/szemod/YouTube-Music-Cookie-Extractor
- Chrome/Edge extension (unpacked). Copies cookies to clipboard or downloads as `cookie.txt`.
- Auto-downloads cookies when user visits `https://music.youtube.com/`.
- Does NOT support automated refresh — it triggers on user browser visit, not server-side.
- Produces cookies.txt (Netscape format), compatible with yt-dlp and most server tools.
- No maintenance cadence visible; primarily client-side JavaScript.

**Cookies.txt browser extension (generic):**
- Standard browser extension that exports cookies in Netscape format.
- Used widely with yt-dlp for YouTube authentication.
- Requires manual trigger — not automated.

**Firefox SQLite approach (as of 2026, the only reliably working programmatic extraction):**
Source: https://dev.to/osovsky/6-ways-to-get-youtube-cookies-for-yt-dlp-in-2026-only-1-works-2cnb

This article (published early 2026) tested 6 approaches and found only one that bypasses Chrome's app-bound encryption (introduced in Chrome 127):

| Approach | Status |
|----------|--------|
| DPAPI decryption script | Blocked — Chrome 127+ app-bound encryption |
| rookiepy library | Blocked — same encryption even with admin |
| Chrome DevTools Protocol (port 9222) | Port binding issues |
| yt-dlp native OAuth2 | Deprecated by YouTube |
| Per-user bearer token | Incompatible with InnerTube API |
| **Firefox SQLite** | **Works** |

```python
import sqlite3, shutil, os

profile_dir = os.path.expandvars(r'%APPDATA%/Mozilla/Firefox/Profiles')
profile = next(d for d in os.listdir(profile_dir) if d.endswith('.default-release'))
cookie_db = os.path.join(profile_dir, profile, 'cookies.sqlite')

# Firefox locks the DB while running — copy first
shutil.copy2(cookie_db, '/tmp/cookies_copy.sqlite')
conn = sqlite3.connect('/tmp/cookies_copy.sqlite')
cursor = conn.execute("SELECT host, name, value, path, expiry, isSecure FROM moz_cookies WHERE host LIKE '%youtube.com%' OR host LIKE '%google.com%'")
```

Export as Netscape format for yt-dlp. Works because Firefox stores cookies in an unencrypted SQLite database.

**Caveat:** Requires Firefox running on a machine with GUI access and an active YouTube session. Not fully server-side. Cookies still expire every ~2 weeks requiring re-extraction (~60 second process).

**Chrome alternatives post-v127:**
Chrome 127 introduced app-bound encryption (AES-256 encryption of cookie values using DPAPI tied to the Chrome application identity). This broke all third-party cookie extraction tools that relied on DPAPI decryption. As of early 2026, no maintained workaround exists for Chrome's encrypted cookie store.

---

### Question 5: Innertube/youtubei.js Wrapper Projects with Cookie Lifecycle Management

**Confidence: MEDIUM** — several projects exist with partial automation

**youtubei.js (LuanRT/YouTube.js) — core library:**
- Cookie auth: static string, no refresh. Re-extract on expiry.
- OAuth: `update-credentials` event auto-refreshes access_token (but TVHTML5 only — not usable for `yt.music.*` methods).
- `UniversalCache`: caches InnerTube session state to disk (not account auth).
- No built-in cookie refresh mechanism.
Source: https://github.com/LuanRT/YouTube.js

**ytcog (gatecrasher777/ytcog):**
- URL: https://github.com/gatecrasher777/ytcog
- YouTube Innertube Node.js library with session, search, channels, playlists, videos.
- Handles sessions but no documented cookie auto-refresh.

**Volumio-YouTube.js (patrickkfkan):**
- URL: https://github.com/patrickkfkan/Volumio-YouTube.js/wiki/How-to-obtain-Cookie
- Music player plugin using youtubei.js. Manual cookie extraction from DevTools.
- "Valid until you sign out or YouTube expires it." No auto-refresh.

**ytmusicapi (Python, sigma67) — RefreshingToken (best-in-class for automation):**
- URL: https://github.com/sigma67/ytmusicapi
- The `RefreshingToken` class provides fully automatic access token refresh for OAuth sessions.
- Auto-refreshes when credential expiration <= 1 minute on access_token access.
- Writes updated tokens to `oauth.json` automatically.
- One-time human setup, then fully automated.
- **Critical limitation:** OAuth tokens with ytmusicapi work for Python's WEB_REMIX client handling. This does NOT translate to Node.js youtubei.js's `yt.music.*` endpoints (client mismatch documented separately).
Sources:
- https://ytmusicapi.readthedocs.io/en/stable/reference/api/ytmusicapi.auth.oauth.html
- https://ytmusicapi.readthedocs.io/en/stable/setup/oauth.html

**Innertube RotateCookies gist (szv99):**
- URL: https://gist.github.com/szv99/f78c032736443fab51075bc45f9faf09
- Python implementation that calls `accounts.google.com/RotateCookiesPage` and `accounts.google.com/RotateCookies`.
- Based on Google Bard (not YouTube Music) and reads/writes credentials from a local file.
- Demonstrates understanding of the rotation endpoint sequence but is not production-ready.
- The RotateCookies mechanism: (1) parse initial page for `og_pid`, `rot`, `exp_id`; (2) call RotateCookiesPage with these params to get `init_value`; (3) POST to RotateCookies with `[og_pid, init_value]`; (4) receive updated cookie values in response headers.
- Applicability to YouTube Music: uncertain — this is for google.com, not youtube.com/music.youtube.com.

**youtube-po-token-generator (iRajatDas):**
- URL: https://github.com/iRajatDas/po-token-generator
- npm package using Puppeteer + puppeteer-extra (stealth + adblocker plugins)
- Generates `poToken` and `visitorData` for unauthenticated YouTube access
- Does NOT require login — works for public YouTube data
- Supports headless mode (`headless: true`)
- Built-in caching to reduce redundant Puppeteer launches
- Addresses PO Token refresh (every ~12 hours), NOT cookie refresh

**bgutil-ytdlp-pot-provider (Brainicism):**
- URL: https://github.com/Brainicism/bgutil-ytdlp-pot-provider
- Docker image: `brainicism/bgutil-ytdlp-pot-provider`
- Generates PO Tokens via LuanRT/BgUtils — no browser, no login required
- Runs as persistent HTTP server on port 4416
- yt-dlp queries it automatically for fresh tokens
- Fully headless, server-side, no cookie dependency
- **This is the production-grade solution for PO Token automation** (not cookie automation)
- Source: https://pypi.org/project/bgutil-ytdlp-pot-provider/

---

### Question 6: Actual Cookie Rotation Schedule and Lifetime

**Confidence: MEDIUM** — community-reported, not officially documented by Google

Google does not publish cookie rotation schedules. The following is synthesized from multiple community sources:

**Cookie types and their roles in YouTube Music auth:**
| Cookie | HttpOnly | Role | Notes |
|--------|----------|------|-------|
| `__Secure-1PSID` | Yes | Primary session ID | Required, not visible in Network tab headers |
| `__Secure-1PSIDTS` | Yes | Session timestamp binding | Required, not visible in Network tab headers |
| `SID` | No | Legacy session cookie | Required |
| `HSID` | No | Security cookie | Required |
| `SSID` | No | Secure session | Required |
| `APISID` | No | API access | Required |
| `SAPISID` | No | Secure API | Used to compute SAPISIDHASH |
| `__Secure-3PAPISID` | No | Third-party API | Required |

**Lifetime estimates from community reports:**
| Scenario | Reported Lifetime | Source |
|----------|-------------------|--------|
| Same session active in browser simultaneously | 1-2 hours | yt-dlp #12009 |
| Normal browser session (not incognito) | 3-5 days | yt-dlp #13964 |
| Incognito extraction, window then closed | Weeks to several months | ytmusicapi docs, community |
| Dedicated account, incognito extraction, never used in browser again | Up to 1 year+ | Community reports |
| ytmusicapi docs (theoretical max, logged-in session) | ~2 years | https://ytmusicapi.readthedocs.io/en/stable/setup/browser.html |
| Music Assistant community reports (typical server use) | ~1 month | music-assistant discussion #606 |

**What triggers rotation / expiry:**
1. Browser opens the session again (RotateCookiesPage runs automatically via YouTube's JS)
2. Using the account for active YouTube Music playback on the web (triggers rotation)
3. Google security event (password change, suspicious login)
4. Google server-side session timeout (inactivity — undocumented threshold)
5. Chrome 127+ export tools breaking (can't re-extract without Firefox workaround)

**Why cookies expire faster now than historically:**
Google tightened anti-bot security in late 2024. Per yt-dlp Issue #13964: "youtube changed anti-bot behaviour and now cookie get banned more faster than previous." The previous ~1 month incognito lifetime may now be shorter for accounts that YouTube's systems flag as non-browser.

**IP address binding:**
Some reports suggest cookies may be partially IP-bound, causing faster expiry when used from datacenter IPs vs. the residential IP where they were extracted. This is not officially confirmed.

**PO Token lifetime (separate from cookies):**
- Possibly as short as 12 hours
- Some reports suggest several months for certain configurations
- Bound to Visitor ID (unauthenticated) or DataSync ID (authenticated)
- The bgutil-ytdlp-pot-provider generates fresh ones on demand
Source: https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide

---

## Key Takeaways

1. **No automated cookie refresh exists for YouTube Music server-side.** The RotateCookiesPage mechanism that maintains cookie validity requires running Google's JavaScript in a browser context — it cannot be trivially replicated server-side.

2. **The practical best approach for a Node.js server** (the harness context): extract cookies once from incognito using a dedicated Google account, store in environment variable/secrets manager, alert and manually re-extract when 401 errors appear. Expected lifetime: several weeks to ~3 months.

3. **ytmusicapi (Python) OAuth with RefreshingToken** is the only fully automated "set and forget" auth path, but it only works in Python (not Node.js), and even then the TV OAuth tokens are incompatible with Music endpoints in youtubei.js.

4. **Headless browser Google sign-in is blocked** in datacenter environments. No maintained solution exists as of 2026.

5. **Firefox SQLite extraction** is the only programmatic browser-side cookie extraction approach that still works (as of early 2026) after Chrome 127's app-bound encryption. Still requires a GUI Firefox session, not fully server-side.

6. **PO Tokens (for stream access) have a clean automated solution** that is completely separate from cookie auth: `bgutil-ytdlp-pot-provider` as a Docker sidecar. This is production-ready and solves the stream-403 problem without any cookies.

7. **The RotateCookies gist** shows the endpoint sequence for Google's cookie refresh mechanism, but it targets google.com/Bard, not youtube.com, and is not production-ready. Adapting it to YouTube Music is theoretically possible but unproven.

8. **Music Assistant's approach** (running a PO Token Generator addon separately from cookie auth) is the most production-deployed architecture for this problem. Cookies are manual, PO Tokens are automated. This is a reasonable model for harness.

---

## Recommendations for Next Steps

1. **Immediate harness action:** Use cookie auth with a dedicated Google account. Store in secrets. Accept manual re-extraction on expiry. Alert on 401 from the music plugin.

2. **PO Token automation:** Deploy `brainicism/bgutil-ytdlp-pot-provider` as a Docker sidecar if stream 403 errors appear. This is genuinely automated and production-proven.

3. **Monitor ytmusicapi's Python OAuth approach** for any Node.js equivalents — if someone ports the `RefreshingToken` pattern to the youtubei.js ecosystem, this changes the equation.

4. **Do not invest in headless Google sign-in automation** — Google actively blocks this and the ecosystem (puppeteer-extra-plugin-stealth) is unmaintained. The ROI is negative.

5. **Firefox SQLite as a fallback refresh mechanism:** If the harness server has a persistent Firefox session on a companion machine (desktop, Raspberry Pi, etc.), the SQLite cookie extraction could be automated as a cron job (`cp cookies.sqlite` + Python extraction every N days) and pushed to the server's environment. This is the lowest-friction "real" automation that exists.

---

## Gaps Identified

- **Whether the Google RotateCookiesPage mechanism works for youtube.com cookies specifically** (the szv99 gist targets google.com/Bard): UNKNOWN. Would require testing.
- **Exact IP-binding behavior** of YouTube session cookies: UNKNOWN. Community speculation, not confirmed.
- **Whether `generate_session_locally: true` in youtubei.js extends cookie lifetime** by reducing server-side session invalidation: UNKNOWN.
- **Any 2025-2026 maintained Playwright script for YouTube Music cookie extraction** post-Chrome-127: UNKNOWN — searches found nothing specific.

---

## Sources

| Source | URL | Confidence |
|--------|-----|------------|
| yt-dlp Issue #8227 — RotateCookies mechanism | https://github.com/yt-dlp/yt-dlp/issues/8227 | HIGH |
| yt-dlp Issue #13964 — 3-5 day cookie expiry | https://github.com/yt-dlp/yt-dlp/issues/13964 | HIGH |
| yt-dlp Issue #12009 — 1-2 hour expiry when browser active | https://github.com/yt-dlp/yt-dlp/issues/12009 | HIGH |
| yt-dlp Issue #11773 — automating cookie export | https://github.com/yt-dlp/yt-dlp/issues/11773 | HIGH |
| yt-dlp Issue #11585 — headless server cookie use | https://github.com/yt-dlp/yt-dlp/issues/11585 | HIGH |
| yt-dlp PO Token Guide | https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide | HIGH |
| yt-dlp Extractors wiki | https://github.com/yt-dlp/yt-dlp/wiki/extractors | HIGH |
| ytmusicapi Browser Auth docs | https://ytmusicapi.readthedocs.io/en/stable/setup/browser.html | HIGH |
| ytmusicapi OAuth docs | https://ytmusicapi.readthedocs.io/en/stable/setup/oauth.html | HIGH |
| ytmusicapi OAuth API reference (RefreshingToken) | https://ytmusicapi.readthedocs.io/en/stable/reference/api/ytmusicapi.auth.oauth.html | HIGH |
| LuanRT/BgUtils — PO Token generation | https://github.com/LuanRT/BgUtils | HIGH |
| bgutil-ytdlp-pot-provider | https://github.com/Brainicism/bgutil-ytdlp-pot-provider | HIGH |
| bgutil-ytdlp-pot-provider (PyPI) | https://pypi.org/project/bgutil-ytdlp-pot-provider/ | HIGH |
| po-token-generator (Puppeteer) | https://github.com/iRajatDas/po-token-generator | MEDIUM |
| YouTube-Music-Cookie-Extractor extension | https://github.com/szemod/YouTube-Music-Cookie-Extractor | MEDIUM |
| 6 ways to get YouTube cookies (2026 article) | https://dev.to/osovsky/6-ways-to-get-youtube-cookies-for-yt-dlp-in-2026-only-1-works-2cnb | MEDIUM |
| RotateCookies gist (Google/Bard) | https://gist.github.com/szv99/f78c032736443fab51075bc45f9faf09 | LOW |
| Music Assistant — YouTube Music auth | https://www.music-assistant.io/music-providers/youtube-music/ | MEDIUM |
| Music Assistant discussion #606 | https://github.com/orgs/music-assistant/discussions/606 | MEDIUM |
| Pinchflat — YouTube Cookies | https://github.com/kieraneglin/pinchflat/wiki/YouTube-Cookies | MEDIUM |
| Google TV OAuth 2.0 Device Flow | https://developers.google.com/youtube/v3/live/guides/auth/devices | HIGH |
| Puppeteer Issue #4871 — Google blocks headless sign-in | https://github.com/puppeteer/puppeteer/issues/4871 | HIGH |
| deepwiki — yt-dlp PO Token system | https://deepwiki.com/yt-dlp/yt-dlp/3.4.1-potoken-authentication-system | MEDIUM |
| Prior research: OAuth/WEB_REMIX mismatch | /AI_RESEARCH/2026-03-23-youtubei-js-oauth-ytmusic-client-mismatch.md | HIGH |
| Prior research: auth deep dive | /AI_RESEARCH/2026-03-12-youtubei-js-authentication-deep-dive.md | HIGH |
