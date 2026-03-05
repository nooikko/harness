# Research: YouTube Music Node.js/TypeScript Libraries

Date: 2026-03-05

## Summary

YouTube Music has no official public API. All Node.js libraries are unofficial, reverse-engineered wrappers around YouTube Music's internal "InnerTube" API. No library provides native playback control — stream URL extraction requires a separate tool (yt-dlp or a ytdl fork). The most viable server-side options are `ytmusic-api` (metadata/search) and `youtubei.js` (full InnerTube client including streaming data).

---

## Official API Status

**YouTube Music has no official public API.** (Confidence: HIGH)

Google's YouTube Data API v3 covers public YouTube content (videos, channels, playlists) but does NOT cover YouTube Music-specific endpoints such as music search filters, artist pages, album metadata, lyrics, user library/playlists on Music, or music-specific browse. The YouTube Data API is a separate product from the YouTube Music client API.

Source: [Musicfetch — Does YouTube Music have an API?](https://musicfetch.io/services/youtube-music/api)

Google's Developer Policies explicitly prohibit:
- Scraping YouTube Applications
- Obtaining scraped YouTube data without authorization

Source: [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

**Practical reality:** The entire ecosystem of unofficial libraries emulates browser-level web requests to the internal `music.youtube.com` API (InnerTube). These libraries are not endorsed by Google, may break when Google changes internal APIs, and their use for commercial purposes is legally ambiguous.

---

## Library Landscape

### Tier 1 — Viable for Server-Side Use (2025)

#### 1. `ytmusic-api` (npm: `ytmusic-api`)

- **GitHub:** [zS1L3NT/ts-npm-ytmusic-api](https://github.com/zS1L3NT/ts-npm-ytmusic-api)
- **Stars:** ~669
- **npm version:** 5.3.0
- **Last published:** ~10 months ago (approx. May 2025)
- **Weekly downloads:** ~334
- **TypeScript:** Native — written in TypeScript, return types are strongly typed and tested
- **License:** GPL-3.0

**What it does:**
- Scrapes YouTube Music's internal API for metadata
- `search(query, { filter?, max? })` — returns songs, albums, playlists, videos, artists
- `searchSongs(query)`, `searchAlbums(query)`, `searchArtists(query)`, `searchPlaylists(query)`, `searchVideos(query)` — typed convenience methods
- `getSongInfo(videoId)` — song metadata
- `getPlaylist(playlistId)` — playlist with tracks
- `getArtist(artistId)` — artist page
- `initialize(cookies?)` — can run unauthenticated (read-only public content) or with browser cookies

**What it does NOT do:**
- No stream/playback URLs returned
- No playback control
- No library management (add/remove playlists, liked songs)

**Authentication:** Optional. Pass browser cookies for authenticated requests (user library, personalized results). Can be initialized with no cookies for public search.

**Note:** The npm package `ytmusic-api` is maintained by `zS1L3NT` (repo: `ts-npm-ytmusic-api`), not by `vladdenisov` (whose older `ytmusic` package has 43 stars and appears abandoned).

---

#### 2. `youtubei.js` (npm: `youtubei.js`)

- **GitHub:** [LuanRT/YouTube.js](https://github.com/LuanRT/YouTube.js)
- **Stars:** ~4,400–4,600
- **npm version:** 14.0.0 (as of early 2026)
- **Last publish:** Active — releases in 2025
- **TypeScript:** Native — full TypeScript with exported type definitions
- **License:** MIT

**What it does:**
- Full InnerTube client for YouTube AND YouTube Music
- `innertube.music` property — returns a `Music` interface
- `Music.search(query)` — YouTube Music search with filter support
- `Music.getInfo(videoId)` — track metadata, starts a radio from a list item
- `Music.getAlbum(browseId)` — album with track listing
- `Music.getArtist(browseId)` — artist page
- `Music.getHomeFeed()` — personalized music homepage
- `Music.getExplore()` — explore/charts
- `innertube.getStreamingData(videoId)` — **deciphered streaming data including audio format URLs**
- `innertube.download(videoId, options)` — direct video/audio download stream
- MPEG-DASH manifest generation from streaming data
- Runs in Node.js, Deno, and browser

**Authentication:** Optional OAuth or cookie-based. Unauthenticated access works for public content and streaming data. Session caching supported via `UniversalCache`.

**Key advantage over ytmusic-api:** `getStreamingData()` returns deciphered streaming URLs, enabling actual audio playback without a separate tool.

**Note:** `@distube/ytdl-core` (a maintained fork of ytdl-core) now depends on youtubei.js internally, cementing its status as the most robust low-level YouTube client in the JS ecosystem.

---

### Tier 2 — Functional but Less Active

#### 3. `youtube-music-ts-api` (npm: `youtube-music-ts-api`)

- **GitHub:** [nickp10/youtube-music-ts-api](https://github.com/nickp10/youtube-music-ts-api)
- **Stars:** ~22
- **Last commit:** ~4 months ago
- **TypeScript:** Native
- **Authentication:** Requires cookies (logged-in user) — not optional, mandatory for most features

**What it does:**
- Library management: `getLibraryPlaylists()`, `getPlaylist(id)`
- Playlist CRUD: create playlists, add tracks
- Limited search

**What it does NOT do:** No stream URLs, minimal search functionality, primarily focused on authenticated library operations.

**Verdict:** Too narrow in scope; low star count suggests minimal community validation.

---

#### 4. `node-youtube-music` (npm: `node-youtube-music`)

- **GitHub:** [baptisteArno/node-youtube-music](https://github.com/baptisteArno/node-youtube-music)
- **Stars:** Unknown (low)
- **npm version:** 0.10.3
- **Last published:** 3 years ago
- **TypeScript:** Yes (based on package structure)

**What it does:**
- `searchMusics()`, `searchAlbums()`, `searchPlaylists()`
- `getSuggestions()`

**Verdict:** Abandoned. 3-year-old last publish date is disqualifying for production use.

---

### Tier 3 — Archived / Abandoned

#### 5. `@codyduong/ytmusicapi` (npm: `@codyduong/ytmusicapi`)

- **GitHub:** [codyduong/ytmusicapiJS](https://github.com/codyduong/ytmusicapiJS) — **ARCHIVED**
- **Status:** Repository archived by maintainer. Maintainer explicitly recommends not using it.
- **What it was:** TypeScript port of the Python `ytmusicapi` library, using browser cookies for auth, supporting search.
- **Verdict:** Do not use. Archived and unsupported.

#### 6. `youtube-music-api` (npm: `youtube-music-api`)

- **GitHub:** [emresenyuva/youtube-music-api](https://github.com/emresenyuva/youtube-music-api)
- **npm version:** 1.0.6
- **Last published:** 5 years ago
- **Verdict:** Abandoned. Do not use.

#### 7. `ytmusic` (npm: `ytmusic`, vladdenisov)

- **GitHub:** [vladdenisov/ytmusic-api](https://github.com/vladdenisov/ytmusic-api)
- **Stars:** 43
- **Status:** Appears unmaintained
- **Verdict:** Superseded by `ytmusic-api` (zS1L3NT's refactor). Do not use.

---

### Reference — Python Original (not Node.js)

#### `ytmusicapi` (Python, PyPI)

- **GitHub:** [sigma67/ytmusicapi](https://github.com/sigma67/ytmusicapi)
- **Stars:** ~2,300
- **Last version:** 1.11.5 (January 31, 2025)
- **Language:** Python only — no Node.js port
- **Authentication:** Browser cookies or OAuth
- **Features:** Search (songs, albums, artists, playlists, videos), Browse (artists, albums, songs), Library management, Playlists (create/edit), Uploads, Podcasts, Watch (radio/next-up)
- **Playback URLs:** Out of scope — maintainer closed the issue directing users to `yt-dlp`

This is the gold standard for the concept, but not usable in Node.js directly. All the Node.js libraries above are inspired by or ported from it.

---

## Playback / Stream URL Strategy

No YouTube Music metadata library returns stream URLs. They return video IDs. Stream URLs require a separate layer.

### Architecture Pattern (Confidence: HIGH)

```
Step 1: ytmusic-api or youtubei.js.music
        → search(query) → get videoId

Step 2: youtubei.js innertube.getStreamingData(videoId)
         OR yt-dlp / @distube/ytdl-core
        → get deciphered audio format URLs

Step 3: Pipe audio stream to client
```

### Stream URL Options

| Tool | Type | Status | Notes |
|------|------|--------|-------|
| `youtubei.js` `getStreamingData()` | Pure JS | Active (2025) | Best option — no binary dependency, TypeScript-native, deciphers URLs |
| `ytdlp-nodejs` | yt-dlp wrapper | Active (2025, v2 in beta) | Requires yt-dlp binary on server; strong TypeScript support; works for any video site |
| `@distube/ytdl-core` | Pure JS | Transitioning to youtubei.js internally | Actively maintained fork of abandoned ytdl-core; now depends on youtubei.js |
| `ytdl-core` (original) | Pure JS | **Abandoned** (July 2023) | Do not use |
| `play-dl` | Pure JS | Last publish 2 years ago | Targets Discord bots; not recommended for general use |

**Key finding:** `youtubei.js` `getStreamingData()` covers both metadata (via `.music` client) and stream URL extraction in a single library. This makes it the most cohesive server-side solution.

---

## Authentication Requirements Summary

| Library | No Auth | Cookies | OAuth |
|---------|---------|---------|-------|
| `ytmusic-api` | Yes (public search/browse) | Yes (user library) | No |
| `youtubei.js` | Yes (public content + streaming) | Yes | Yes |
| `youtube-music-ts-api` | No | Yes (required) | No |
| `ytmusicapi` (Python) | Yes (limited) | Yes | Yes |

**Cookie extraction:** All cookie-based libraries require the user to manually copy request headers from a browser developer tools session on `music.youtube.com`. This is a manual step — there is no programmatic login flow.

**OAuth:** `youtubei.js` and `ytmusicapi` (Python) support OAuth. The Node.js OAuth flow in `youtubei.js` uses Google's standard OAuth2, but the library does not bundle a consent flow — the caller must handle token acquisition.

---

## Comparison Table

| Library | npm Package | Stars | Last Active | TypeScript | Search | Stream URL | Auth Required | Server-Side |
|---------|-------------|-------|-------------|------------|--------|------------|---------------|-------------|
| `ytmusic-api` | `ytmusic-api` | ~669 | May 2025 | Native | Yes | No | Optional | Yes |
| `youtubei.js` | `youtubei.js` | ~4,500 | Active 2025 | Native | Yes (via `.music`) | Yes (getStreamingData) | Optional | Yes |
| `youtube-music-ts-api` | `youtube-music-ts-api` | ~22 | 4 mo ago | Native | Limited | No | Required | Yes |
| `node-youtube-music` | `node-youtube-music` | Low | 3 years ago | Yes | Yes | No | No | Yes |
| `@codyduong/ytmusicapi` | `@codyduong/ytmusicapi` | N/A | **Archived** | Native | Yes | No | Cookies | N/A |
| `youtube-music-api` | `youtube-music-api` | Low | 5 years ago | No | Yes | No | No | Yes |
| `ytdlp-nodejs` | `ytdlp-nodejs` | Low | Active 2025 | Yes | No | Yes | No | Yes (needs binary) |

---

## Key Takeaways

1. **No official API exists.** All libraries scrape InnerTube. Breakage can occur without warning when Google updates internal API responses.

2. **For metadata + search only:** Use `ytmusic-api` (`ytmusic-api` npm). 669 stars, native TypeScript, works unauthenticated, actively tested. Limitation: GPL-3.0 license.

3. **For metadata + stream URLs in one library:** Use `youtubei.js`. ~4,500 stars, MIT license, native TypeScript, handles both YouTube Music search/browse via `.music` client AND stream URL deciphering via `getStreamingData()`. This is the highest-quality option and covers the full use case.

4. **Stream URLs are not metadata.** The two concerns are separate: search/browse returns video IDs; stream extraction converts a video ID into a time-limited audio format URL. Only `youtubei.js` handles both natively.

5. **Avoid binary dependencies if possible.** `ytdlp-nodejs` requires a yt-dlp binary on the server. `youtubei.js` is pure JavaScript.

6. **Cookie-based auth is manual.** No library provides a headless login flow. Authenticated features require a one-time manual cookie extraction from a browser.

7. **Legal caution.** These libraries violate YouTube's Terms of Service in letter (scraping without authorization). Personal/non-commercial use is tolerated in practice, but commercial use of music streams carries additional copyright risk on top of ToS risk.

---

## Recommendation for a Server-Side Plugin

For a Node.js plugin that needs to search YouTube Music and optionally stream audio:

- **Primary library:** `youtubei.js` (`npm: youtubei.js`)
  - Covers search, browse, and stream URL extraction in one MIT-licensed package
  - 4,500+ stars — largest and most active JS YouTube client
  - Native TypeScript
  - `innertube.music.search(query)` for music-specific search results
  - `innertube.getStreamingData(videoId)` for deciphered audio URLs
  - No binary dependencies

- **Supplementary (metadata-only path):** `ytmusic-api` (`npm: ytmusic-api`)
  - Simpler API surface for search-only use cases
  - Note GPL-3.0 license — may conflict with proprietary plugin use

- **Avoid:** All archived/abandoned libraries listed in Tier 3 above.

---

## Sources

- [ytmusic-api on npm](https://www.npmjs.com/package/ytmusic-api)
- [zS1L3NT/ts-npm-ytmusic-api on GitHub](https://github.com/zS1L3NT/ts-npm-ytmusic-api)
- [vladdenisov/ytmusic-api on GitHub](https://github.com/vladdenisov/ytmusic-api)
- [LuanRT/YouTube.js on GitHub](https://github.com/LuanRT/YouTube.js)
- [youtubei.js on npm](https://www.npmjs.com/package/youtubei.js)
- [YouTube.js Getting Started docs](https://ytjs.dev/guide/getting-started)
- [YouTube.js Innertube class API](https://www.ytjs.dev/api/classes/Innertube)
- [codyduong/ytmusicapiJS (archived)](https://github.com/codyduong/ytmusicapiJS)
- [@codyduong/ytmusicapi on npm](https://www.npmjs.com/package/@codyduong/ytmusicapi)
- [nickp10/youtube-music-ts-api on GitHub](https://github.com/nickp10/youtube-music-ts-api)
- [baptisteArno/node-youtube-music on GitHub](https://github.com/baptisteArno/node-youtube-music)
- [sigma67/ytmusicapi on GitHub](https://github.com/sigma67/ytmusicapi)
- [ytmusicapi documentation](https://ytmusicapi.readthedocs.io/)
- [ytmusicapi issue #13 — stream URLs out of scope](https://github.com/sigma67/ytmusicapi/issues/13)
- [iqbal-rashed/ytdlp-nodejs on GitHub](https://github.com/iqbal-rashed/ytdlp-nodejs)
- [ytdlp-nodejs on npm](https://www.npmjs.com/package/ytdlp-nodejs)
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [Musicfetch — Does YouTube Music have an API?](https://musicfetch.io/services/youtube-music/api)
- [GitHub topics: youtube-music-api](https://github.com/topics/youtube-music-api)
