# Research: Google Cast Control from Node.js/TypeScript with YouTube Music Focus
Date: 2026-03-05

## Summary

Google Cast devices (Chromecast, Google Home, Nest speakers) can be controlled from Node.js via the CASTV2 protocol. The Node.js library ecosystem is largely unmaintained (2014-era), but functional. Casting YouTube Music specifically requires either: (A) acting as a Cast receiver that the YouTube Music app connects to (receiver mode), or (B) using the Default Media Receiver with direct stream URLs extracted via yt-dlp (sender mode). There is no documented, official way to send YouTube Music tracks to an existing Chromecast as a programmatic sender using YouTube's native app protocol from Node.js.

## Prior Research

None — first research on this topic.

## Current Findings

---

### 1. The Cast Protocol (Technical Foundation)

**Discovery:**
- Chromecasts advertise via mDNS/DNS-SD on the local network
- Service type: `_googlecast._tcp.local`
- Query sent to multicast address `224.0.0.251` on UDP port 5353
- TXT records contain: friendly name (fn), model (md), protocol version (ve), device ID
- mDNS is link-local only — does not cross router boundaries (same L2 segment required)
- Legacy DIAL/SSDP protocol also supported (for YouTube TV app interactions)

**Connection:**
- Once discovered, sender opens a TLS connection to the device on TCP port 8009
- Messages are length-prefixed Protocol Buffer (protobuf) encoded binary
- Message fields: protocol version, source ID, destination ID, namespace, payload type, UTF-8 or binary payload

**Core Namespaces:**
- `urn:x-cast:com.google.cast.tp.connection` — virtual connection setup
- `urn:x-cast:com.google.cast.tp.heartbeat` — keep-alive pings
- `urn:x-cast:com.google.cast.tp.deviceauth` — device authentication
- `urn:x-cast:com.google.cast.receiver` — app launch/stop/status (platform receiver-0)
- `urn:x-cast:com.google.cast.media` — media playback control (load, play, pause, seek, stop, volume)

**App Launch:**
- Receiver apps are identified by an opaque 8-character hex app ID
- `CC1AD845` — Default Media Receiver (pre-built, no registration required)
- `YouTube` — string used to launch the YouTube app (not hex format)
- YouTube Music has its own receiver app ID (not publicly documented)
- Custom receivers require registration with Google and have their own app IDs

**Media Control Messages (sender → receiver):**
- LOAD: loads content with contentId (URL), streamType (BUFFERED/LIVE), contentType (MIME), metadata, autoplay
- PLAY, PAUSE, STOP, SEEK (to position in seconds)
- GET_STATUS, SETVOL (stream volume for fade effects)
- Max message size: 64 KB

Source: [Google Cast Media Messages](https://developers.google.com/cast/docs/media/messages), [oakbits.com protocol breakdown](https://oakbits.com/google-cast-protocol-discovery-and-connection.html)

---

### 2. Node.js Library Landscape

#### castv2 (Protocol Implementation)
- **npm package:** `castv2`
- **GitHub:** [thibauts/node-castv2](https://github.com/thibauts/node-castv2)
- **Stars:** 792 | **Forks:** 103 | **Open Issues:** 8
- **Language:** JavaScript 100%
- **Status:** Inactive — minimal commits since 2014 creation, ~92 total commits
- **Role:** Low-level CASTV2 protocol over TLS. The foundation all other libraries build on.
- **TypeScript:** Community types available via `@types/castv2` on DefinitelyTyped (last updated Nov 2024)

#### castv2-client (Sender Implementation)
- **npm package:** `castv2-client`
- **GitHub:** [thibauts/node-castv2-client](https://github.com/thibauts/node-castv2-client)
- **Stars:** 657 | **Forks:** 92 | **Open Issues:** 28
- **Language:** JavaScript 100%
- **Status:** Inactive — 57 total commits, no releases published, last meaningful work ~2014
- **Provides:** DefaultMediaReceiver app, Application base class, basic protocol controllers
- **Supports:** Video (MP4, WebM), Audio (MP3), Images (JPG) via Default Media Receiver
- **TypeScript:** No built-in types; community `@types/castv2-client` exists (quality unknown)
- **mDNS discovery:** Uses `mdns` package (requires native binaries — build pain on some platforms)

#### chromecast-api
- **npm package:** `chromecast-api`
- **GitHub:** [alxhotel/chromecast-api](https://github.com/alxhotel/chromecast-api) (also [chromecast-sponsorblock fork](https://github.com/chromecast-sponsorblock/chromecast-api))
- **Stars:** 157 | **Forks:** 48 | **Open Issues:** 25
- **Language:** JavaScript 100%
- **Last commit:** June 26, 2023
- **Status:** Low activity, not actively maintained
- **Provides:** Higher-level wrapper over castv2. Includes mDNS+SSDP discovery (avoids native mdns dependency), play/pause/stop/seek/volume controls
- **TypeScript:** None

#### cast-web/client (TypeScript fork of castv2-client)
- **GitHub:** [cast-web/client](https://github.com/cast-web/client)
- **Stars:** 2
- **Last commit:** March 3, 2021
- **Language:** TypeScript 98.6%
- **Status:** Abandoned — only 2 stars, last updated 2021, promise API and tests listed as "in progress"
- **Provides:** ES6 + TypeScript rewrite of castv2-client. Not production-ready.

#### node-red-contrib-cast
- **Node-RED flow node:** [node-red-contrib-cast](https://flows.nodered.org/node/node-red-contrib-cast)
- **Stars:** 71 (as of recent GitHub topics listing)
- **Last update:** Feb 14, 2026
- **Status:** Actively maintained (most recently updated cast library found)
- **Provides:** Node-RED integration for Google Cast devices. Supports Chromecast and Google Home. Built on castv2 protocol.
- **Note:** This is Node-RED specific (visual flow programming), not a general Node.js library

#### yt-cast-receiver (RECEIVER mode — not sender)
- **npm package:** `yt-cast-receiver`
- **GitHub:** [patrickkfkan/yt-cast-receiver](https://github.com/patrickkfkan/yt-cast-receiver)
- **Stars:** 44 | **Open Issues:** 2
- **Last version:** 2.1.0 (published ~8 days ago as of research date, May 2025 update)
- **Language:** TypeScript (fully typed, ESM+CJS hybrid)
- **Status:** Actively maintained — most relevant recently-updated library found
- **Role:** Makes your Node.js app act as a YouTube Cast RECEIVER (not a sender)
- **YouTube Music:** Yes, explicitly supported. Distinguishes sender via `Constants.CLIENTS.YTMUSIC`
- **Protocol:** Implements DIAL server for device discovery + YouTube Lounge API for session management
- **Key limitation:** Does NOT include a media player — you must implement `Player` abstract class yourself with your own audio/video playback mechanism
- **Real-world usage:** Used by [volumio-ytcr](https://github.com/patrickkfkan/volumio-ytcr) plugin to turn Volumio music player into a YouTube Cast target

---

### 3. Library Comparison Table

| Library | Stars | Last Update | TypeScript | mDNS Discovery | Sender/Receiver | YT Music | Maintenance |
|---------|-------|-------------|------------|----------------|-----------------|----------|-------------|
| `castv2` | 792 | 2014-era | Via `@types/castv2` | No (protocol only) | Protocol only | No | Dead |
| `castv2-client` | 657 | 2014-era | No (community types) | Yes (native mdns) | Sender | No | Dead |
| `chromecast-api` | 157 | Jun 2023 | No | Yes (mdns+SSDP) | Sender | No | Low |
| `cast-web/client` | 2 | Mar 2021 | Yes (98%) | Yes | Sender | No | Dead |
| `node-red-contrib-cast` | 71 | Feb 2026 | N/A | Yes | Sender | No | Active |
| `yt-cast-receiver` | 44 | ~May 2025 | Yes (full) | Yes (DIAL) | Receiver only | Yes | Active |

---

### 4. The YouTube Music Casting Problem

**How the YouTube Music app casts (official flow):**
1. YouTube Music app (iOS/Android/web) discovers Cast devices via mDNS
2. Sender launches the YouTube receiver app on the Chromecast using its proprietary app ID
3. Sender obtains a `screenId` from the running YouTube TV app via DIAL
4. Sender authenticates with YouTube's Lounge API to get a `loungeIdToken`
5. Sender uses Lounge API endpoints (`/api/lounge/bc/bind`) to send playback commands
6. The Chromecast streams YouTube content directly from YouTube's CDN

**Why this is hard to replicate programmatically:**
- YouTube's receiver app ID for YouTube Music is not publicly documented
- The YouTube Lounge API is undocumented and reverse-engineered only
- Google has actively closed off programmatic access over time (castnow dropped YouTube support due to API changes)
- YouTube Music's Lounge API tokens require an authenticated session
- YouTube's streaming URLs are obfuscated/signed and change frequently

**What YouTube Music IDs look like:**
- YouTube Music tracks use the same video ID format as regular YouTube (`watch?v=VIDEO_ID`)
- `music.youtube.com/watch?v=VIDEO_ID` uses the same 11-character video ID as `youtube.com/watch?v=VIDEO_ID`
- This means a YouTube Music track can also be played as a YouTube video
- The content is the same — YouTube Music is effectively a filtered/curated view of YouTube content

**Approach A — Receiver Mode (Most Feasible for YouTube Music):**
Use `yt-cast-receiver` to make your Node.js server appear as a Cast-capable device. The actual YouTube Music app (on a phone/web) then casts to YOUR server. Your server receives the video ID and playback commands, then you fetch the audio stream yourself (via yt-dlp wrapper) and route it to the speaker hardware.

- Pros: Works with actual YouTube Music app, handles queue/playlist natively, TypeScript, actively maintained
- Cons: You must implement audio playback yourself; requires running yt-dlp or similar to get stream URL; the YouTube Music app must initiate the cast (not your server)

**Approach B — Default Media Receiver with yt-dlp (Sender Mode):**
Use `castv2-client` or `chromecast-api` to send a media LOAD command to a Chromecast's Default Media Receiver. The `contentId` in the LOAD message must be a direct, publicly accessible audio/video URL. Use yt-dlp (via `youtube-dl-exec` npm wrapper) to extract the direct stream URL from a YouTube Music video ID, then load that URL into the Default Media Receiver.

- Pros: Works as a programmatic sender, simpler architecture, no need for a phone
- Cons: yt-dlp streams are time-limited signed URLs; yt-dlp can break when YouTube changes its API; Default Media Receiver cannot control YouTube-specific features (queue, autoplay, recommendations); library maintenance is poor

**Approach C — YouTube Lounge API (Reverse-Engineered Sender):**
Reverse-engineer the YouTube Lounge API to send commands directly to an already-running YouTube app on a Chromecast, similar to how `ytcast` (Go) and `casttube` (Python) work. This requires obtaining a `screenId` from the device, getting a `loungeIdToken` from YouTube, then sending commands via the bind endpoint.

- Pros: Cleanest user experience — uses the actual YouTube receiver with all features
- Cons: API is undocumented and brittle; requires authenticated YouTube session; no maintained Node.js implementation exists; Google has broken previous implementations; `casttube` (Python, 60 stars) is the closest reference but is stale (2020)

---

### 5. CATT (Cast All The Things) Analysis

- **GitHub:** [skorokithakis/catt](https://github.com/skorokithakis/catt)
- **Stars:** 3.6k | **Language:** Python
- **Last release:** v0.13.0, August 19, 2025 — actively maintained
- **Dependencies:** `pychromecast` (Cast protocol), `yt-dlp` (stream extraction), `casttube` (YouTube Lounge API)
- **Approach:** Hybrid — for YouTube content, uses `casttube` to communicate via Lounge API to the running YouTube receiver; for other content, extracts streams via yt-dlp and loads them into Default Media Receiver
- **YouTube Music:** Not explicitly mentioned; supports "any service yt-dlp supports"
- **Node.js port:** None found. The Python `pychromecast` library (the closest Python equivalent to `castv2-client`) has no Node.js port

**Insights from CATT's architecture:**
CATT's use of `casttube` is the key to YouTube-specific casting. The equivalent for Node.js would require implementing the YouTube Lounge API calls from scratch. `ytcast` (Go, 795 stars, actively maintained as of March 2026) demonstrates this is feasible but requires significant reverse-engineering work.

---

### 6. Stream Extraction for Sender Mode

If taking Approach B (Default Media Receiver with direct URLs):

- **`youtube-dl-exec`** ([npm](https://www.npmjs.com/package/youtube-dl-exec)): Simple Node.js wrapper for yt-dlp. Spawns the yt-dlp process. Maintained.
- **`ytdlp-nodejs`** ([GitHub](https://github.com/iqbal-rashed/ytdlp-nodejs)): TypeScript-typed wrapper for yt-dlp with strong type support. More recent.
- **`node-ytdl-core`** ([GitHub](https://github.com/fent/node-ytdl-core)): 4.7k stars but explicitly paused since July 2023. Community recommends `@distube/ytdl-core` fork.
- **`@distube/ytdl-core`**: Active fork of node-ytdl-core maintained by the DistTube team.

**Critical caveat:** YouTube signed URLs extracted by yt-dlp expire in seconds-to-minutes. The URL must be fetched immediately before sending the LOAD command to the Chromecast, and cannot be cached. Also, yt-dlp itself occasionally breaks when YouTube updates its obfuscation — requires keeping yt-dlp binary updated.

---

## Key Takeaways

1. **No well-maintained Node.js sender library exists for Google Cast.** The ecosystem is 2014-era JavaScript with minimal TypeScript support. The most recent sender-mode library with any activity is `chromecast-api` (June 2023) or `node-red-contrib-cast` (Feb 2026, Node-RED specific).

2. **The most actively maintained relevant library is `yt-cast-receiver` (TypeScript, May 2025).** But it implements receiver mode, not sender mode. You write the server, users cast from their phone.

3. **YouTube Music casting cannot be done cleanly as a programmatic sender.** The YouTube Lounge API (required to interact with YouTube's receiver app) is undocumented, reverse-engineered, and Google breaks it periodically. No maintained Node.js implementation exists.

4. **Viable path #1 (receiver mode):** `yt-cast-receiver` + implement `Player` abstract class + yt-dlp to fetch audio stream URLs + direct audio playback to speaker. This turns your server into a Cast target for the actual YouTube Music app. Most reliable approach.

5. **Viable path #2 (sender mode, limited):** `castv2-client` or `chromecast-api` + yt-dlp to extract stream URL + LOAD command to Default Media Receiver. No YouTube-specific features (queue, autoplay). Works for one-off track casting.

6. **YouTube Music video IDs are identical to YouTube video IDs.** `music.youtube.com/watch?v=VIDEO_ID` and `youtube.com/watch?v=VIDEO_ID` use the same 11-character ID. This simplifies stream extraction.

7. **`castv2-client` has `@types/castv2` on DefinitelyTyped (updated Nov 2024)** — TypeScript projects can consume the protocol library with types.

8. **`node-red-contrib-cast` is the only actively maintained sender library**, but it's tied to Node-RED's visual programming environment, not importable as a general Node.js module.

---

## Gaps Identified

- YouTube Music's Cast receiver app ID is not publicly documented (Confidence: LOW on existence of workaround)
- No authoritative source on whether `catt` explicitly supports `music.youtube.com` URLs
- The `casttube` Python library mechanism for obtaining `screenId` via DIAL was not fully documented in search results
- `@types/castv2-client` quality and completeness not verified
- Whether `yt-cast-receiver` handles YouTube Music playlist/radio queue correctly at depth was not verified

---

## Sources

- [node-castv2 GitHub](https://github.com/thibauts/node-castv2) — CASTV2 protocol implementation
- [node-castv2-client GitHub](https://github.com/thibauts/node-castv2-client) — Sender client
- [chromecast-api GitHub](https://github.com/alxhotel/chromecast-api) — Higher-level sender
- [cast-web/client GitHub](https://github.com/cast-web/client) — TypeScript fork (dead)
- [yt-cast-receiver GitHub](https://github.com/patrickkfkan/yt-cast-receiver) — YouTube receiver (active)
- [volumio-ytcr GitHub](https://github.com/patrickkfkan/volumio-ytcr) — Real-world yt-cast-receiver usage
- [catt GitHub](https://github.com/skorokithakis/catt) — Python Cast tool with yt-dlp
- [ytcast GitHub](https://github.com/MarcoLucidi01/ytcast) — Go Lounge API implementation (795 stars)
- [casttube GitHub](https://github.com/ur1katz/casttube) — Python YouTube Lounge API client
- [youtube-dl-exec npm](https://www.npmjs.com/package/youtube-dl-exec) — Node.js yt-dlp wrapper
- [node-ytdl-core GitHub](https://github.com/fent/node-ytdl-core) — Paused YouTube stream library
- [Google Cast Media Messages](https://developers.google.com/cast/docs/media/messages) — Official protocol docs
- [Google Cast Overview](https://developers.google.com/cast/docs/overview) — Official SDK overview
- [oakbits.com Cast Protocol](https://oakbits.com/google-cast-protocol-discovery-and-connection.html) — Protocol deep-dive
- [@types/castv2 npm](https://www.npmjs.com/package/@types/castv2) — TypeScript definitions
- [GitHub JS Chromecast topics](https://github.com/topics/chromecast?l=javascript&o=desc&s=updated) — Library landscape
