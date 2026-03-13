# Research: Cast Discovery Auth, Cast Device UX, Music App Account UX
Date: 2026-03-12

## Summary

Three topics researched: (1) whether Google Cast device discovery requires Google authentication, (2) UX patterns for displaying Cast devices in settings, and (3) UX patterns for music streaming account management. Key finding: Cast discovery and connection require zero Google account authentication — it is purely local-network mDNS + TLS device certificate challenge. Device info available from discovery is rich enough to populate a full settings UI (friendly name, model, manufacturer, IP, cast type). Account management UX across Spotify/Apple Music/YouTube Music follows a consistent "avatar + name + email at top, subscription badge, sign-out at bottom" pattern.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-05-google-cast-nodejs-youtube-music.md` — covers Cast protocol internals, Node.js library landscape, and YouTube Music casting approaches. Does NOT cover auth vs. no-auth distinction, settings UX patterns, or account management UX.

---

## Topic 1: Cast Device Discovery — Authentication Requirements

### mDNS Discovery (Zero Authentication Required)

Cast devices advertise themselves using mDNS/DNS-SD on the local network. No Google account is needed at any stage of discovery.

**Service type:** `_googlecast._tcp.local`
**Discovery protocol:** mDNS multicast UDP, port 5353 — no credentials, no tokens, no Google login
**Node.js libraries that do this:** `bonjour-service` (TypeScript, pure JS), `castv2-client` (uses native `mdns` package), `chromecast-api` (uses mdns+SSDP without native binaries)

**DNS-SD TXT record fields exposed per device during discovery** (no auth needed to read these):

| Field | Description |
|-------|-------------|
| `fn` | Friendly name — user-configurable (e.g., "Living Room TV") |
| `md` | Model description (e.g., "Chromecast", "Chromecast Audio", "Chromecast Ultra") |
| `id` | Device UUID without hyphens — unique, persistent device identifier |
| `ve` | Protocol version (typically "02") |
| `ic` | Icon path (e.g., "/setup/icon.png") served from device's local HTTP server |
| `ca` | Certificate authority identifier |
| `rs` | Current status/running application (what's currently playing on the device) |
| `st` | Status type |
| `bs` | Bootstrap / MAC address |
| `rm` | Remote management identifier |
| `cd` | Certificate/device identifier |

**SRV record** additionally provides: hostname, port (8009)
**A record** provides: IP address

Sources: [oakbits.com Cast Protocol](https://oakbits.com/google-cast-protocol-discovery-and-connection.html), [CR-Cast Wiki](https://github.com/jloutsenhizer/CR-Cast/wiki/Chromecast-Implementation-Documentation-WIP), Google Cast mDNS search results

### pychromecast CastInfo Object (What Libraries Surface from Discovery)

The Python `pychromecast` library (the most complete Cast implementation) exposes these attributes purely from mDNS discovery, with no Google auth:

| Attribute | Type | Description |
|-----------|------|-------------|
| `friendly_name` | str or None | User-readable device name (from `fn` TXT record) |
| `model_name` | str or None | Device model (from `md` TXT record) |
| `manufacturer` | str or None | e.g., "Google Inc." |
| `uuid` | UUID | Unique device identifier (from `id` TXT record) |
| `host` | str | IP address |
| `port` | int | Typically 8009 |
| `cast_type` | str or None | Category: "cast", "audio", "group" |
| `services` | set | MDNSServiceInfo objects |

Real example from pychromecast docs: `CastInfo(uuid=UUID('42feced1-d942-3823-2fba-92623e2682f3'), model_name='Chromecast Audio', friendly_name='Living room', cast_type='audio', manufacturer='Google Inc.')`

Source: [pychromecast documentation](https://tessl.io/registry/tessl/pypi-pychromecast/14.0.0/files/docs/device-discovery.md), [pychromecast GitHub](https://github.com/home-assistant-libs/pychromecast)

### Connecting to a Device (Device Certificate Auth — No Google Account)

After discovery, the sender connects over TLS on port 8009. This involves:

1. **TLS connection** — device uses a self-signed "Peer Certificate" regenerated every 24 hours
2. **Device certificate challenge** (optional from sender's perspective) — sender challenges device to sign a hash using embedded private key; device responds with Device Certificate + ICA Certificate + Root CA Certificate chain
3. This PKI challenge verifies the device is genuine (anti-spoofing) — it is NOT tied to any Google account

From castv2-client README: connection requires only the host IP address — `client.connect(host, callback)`. No Google credentials needed.

"Device authentication is purely optional from a sender's perspective, though official SDK libraries do it to prevent rogue Chromecast devices." — castv2 npm documentation

Source: [Tristan Penman — Chromecast Device Authentication (March 2025)](https://tristanpenman.com/blog/posts/2025/03/22/chromecast-device-authentication/), [castv2-client GitHub README](https://github.com/thibauts/node-castv2-client)

### What Google Account Authentication Adds (vs. Local-Only)

**Without Google account (local mDNS only):**
- Discover all Cast devices on the same L2 network segment
- Read device name, model, manufacturer, UUID, IP, port, cast type, current app
- Connect via TLS and send Cast protocol messages
- Load media into Default Media Receiver (any direct URL)
- Control playback: play, pause, stop, seek, volume
- Get current playback status

**With Google account:**
- Access devices across different networks (via Google's relay infrastructure)
- Cloud-based device management (rename devices, assign to rooms)
- Access Google-authenticated receiver apps (YouTube, YouTube Music's proprietary receiver)
- Guest Mode — cast without being on the same Wi-Fi
- Multi-room audio groups managed via Google Home
- Purchase/rental content playback through Google Play Movies

The local-only discovery path is sufficient for: displaying a device list, showing device status, and controlling media playback via the Default Media Receiver. Google account is only required for cross-network scenarios or proprietary app integration.

Sources: [Google Cast Discovery docs](https://developers.google.com/cast/docs/discovery), [Home Assistant Cast integration](https://www.home-assistant.io/integrations/cast/), [Chromecast local network support](https://support.google.com/chromecast/answer/10063094), [Cast protocol overview](https://oakbits.com/google-cast-protocol-discovery-and-connection.html)

### Confidence Level

**HIGH** — Multiple authoritative sources (Google's own Cast docs, pychromecast library docs, castv2 npm, Home Assistant integration) all confirm: discovery is mDNS, no Google auth. Connection is TLS with optional device certificate challenge, no Google account. This is consistent across Node.js, Python, and Go implementations.

---

## Topic 2: Cast Device Settings UX Patterns

### What Information Is Typically Shown Per Cast Device

Based on Google's official Cast UX guidelines and real-world implementations:

**Per device in a device list:**
- **Friendly name** (`fn` field) — this is the primary identifier users recognize, e.g., "Living Room TV", "Bedroom Speaker"
- **Model name** — e.g., "Chromecast Ultra", "Nest Audio", "Chromecast with Google TV"
- **Current casting status** — "Casting [App Name]" when active, idle otherwise
- **Connection state** — connected vs. available vs. offline
- **Device type/category** — inferred from `cast_type` (cast = video, audio = audio-only)

**Google's official Cast dialog requirements** (from Design Checklist):
- When not connected: title "Cast to" + list of available receivers
- Devices currently casting: display "Casting [app name]" below device name
- When connected: title shows receiver name + "STOP CASTING" button
- No requirement to show IP address, model, or manufacturer in the dialog itself

Source: [Google Cast Design Checklist — Cast Dialog](https://developers.google.com/cast/docs/design_checklist/cast-dialog)

### Spotify's Device List UX

Spotify's "Connect to a device" panel surfaces via the device icon in the player bar.

**Device object fields available in Spotify Web API** (GET `/v1/me/player/devices`):

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique device ID |
| `name` | string | Human-readable name (e.g., "Kitchen speaker") |
| `type` | string | "computer", "smartphone", "speaker" |
| `is_active` | boolean | Currently active playback device |
| `is_muted` | boolean | Volume is zero |
| `is_private_session` | boolean | Private listening mode |
| `is_restricted` | boolean | Cannot be controlled |
| `supports_volume` | boolean | Volume controllable |
| `volume_percent` | integer | 0–100 |

**UI behavior:**
- Device list appears in a bottom sheet/popover triggered by the speaker icon
- Device type determines the icon shown (laptop, phone, speaker icons)
- Active device is highlighted/checked
- "Local device visibility" toggle in Settings > Apps and devices controls whether only local network devices are shown
- Web player "can only use devices you've already logged into, or Google Cast devices on your current network (if using Chrome)"

Sources: [Spotify Connect developer docs](https://developer.spotify.com/documentation/web-playback-sdk/concepts/spotify-connect), [spotifywebapipython Device model](https://spotifywebapipython.readthedocs.io/en/latest/spotifywebapipython/models/device.html), [Spotify Connect support article](https://support.spotify.com/us/article/spotify-connect/)

### Google Home App Device Management UX

The Google Home app is the canonical reference for Cast device management UI. From support documentation and community discussion:

**Device list structure:**
- Tiles/cards per device on the Home tab
- Each card shows: device name (friendly name), device type icon, current state (playing, idle, offline)
- Tapping a device shows: detailed controls, settings gear icon
- Device settings include: name (editable), Wi-Fi info, group membership, equalizer settings

**Online/offline status:**
- Devices show "Offline" or "Not responding" states explicitly
- Developer SDK exposes `OnlineState` enum for automation

**Device attributes shown in the app (community-documented):**
- Friendly name (primary)
- Room/group assignment
- Current media (if playing)
- Volume slider
- Connection quality (for Nest devices)

Google requires authentication (Google account) to use the Google Home app at all — it manages devices across Google's cloud, not just local network. This is the difference vs. direct mDNS discovery.

Sources: [Google Home app Play Store listing](https://play.google.com/store/apps/details?id=com.google.android.apps.chromecast.app), [Home APIs OnlineState reference](https://developers.home.google.com/automations/schema/reference/entity/sht_device/online_state), [Manage people/permissions in Google Home](https://support.google.com/chromecast/answer/9155535)

### Common UX Pattern for "Devices on Your Network" Settings Pages

Synthesized from Google Cast guidelines, Spotify Connect, and Home Assistant Cast:

1. **Discovery is implicit** — app discovers devices in the background; no manual "scan" button needed
2. **Name is primary** — the friendly name is the main label; model appears as secondary/subtitle
3. **Device type icon** — speaker, TV, phone, laptop icons communicate category at a glance
4. **Current activity** — "Playing [track/app name]" or "Idle" / "Available" status
5. **Active indicator** — checkmark, green dot, or highlighted row for currently active device
6. **Connection action** — tap to connect; currently connected device shows disconnect or "Stop casting"
7. **Empty state** — "No devices found on your network" with troubleshooting hint (same Wi-Fi?)
8. **Loading state** — spinner during discovery, then list populates

**What is typically NOT shown in the device picker itself:**
- IP address (considered internal/technical)
- UUID
- MAC address
- Signal strength / RSSI
- Firmware version

These appear in dedicated device detail/settings views, not the primary device list.

### Confidence Level

**HIGH** for Google's official Cast dialog requirements (from official design checklist).
**MEDIUM** for Spotify's Connect UI details (from developer API docs, support articles — no direct screenshot analysis).
**MEDIUM** for Google Home UX patterns (from support docs and community; no formal UX spec published publicly).

---

## Topic 3: Music Streaming Account Management UX

### Standard "Account" Section Pattern in Music Apps

Across Spotify, Apple Music, and YouTube Music, a consistent pattern emerges for settings account sections:

**Top of settings screen (profile block):**
- Profile avatar / photo (circular, ~48–64px on mobile)
- Display name (prominent, e.g., "Quinn")
- Email address (secondary text, muted, smaller)
- Subscription badge or subtitle (e.g., "Premium", "Free", "Music Premium")

**Middle of settings:**
- Subscription management (view plan, change plan, cancel)
- Payment/billing information
- Privacy controls
- Device management (connected devices)

**Bottom of settings:**
- Sign out / Log out (destructive action, placed at bottom to prevent accidental taps)
- Sometimes: "Sign out everywhere" or "Remove account"

Sources: [Settings UX best practices — Toptal](https://www.toptal.com/designers/ux/settings-ux), [Designing profile/account/settings pages — Medium Bootcamp](https://medium.com/design-bootcamp/designing-profile-account-and-setting-pages-for-better-ux-345ef4ca1490), [Account Settings Design Examples — bricxlabs](https://bricxlabs.com/blogs/account-settings-design-examples)

### Spotify Account UX

**Account Overview page** (spotify.com/account/overview or in-app settings):
- Profile photo, display name, email address, username
- Subscription plan: Free / Premium / Duo / Family / Student
- Billing: price per cycle, next renewal date
- Connected devices list (with "remove access" per device)
- Listening history summary

**In-app settings (mobile):**
- Profile picture → tap to open settings
- "Settings and privacy" → Account section
- Subscription info under Account > Billing
- Privacy settings (private session toggle, listening activity visibility)
- Local device visibility toggle (shows/hides non-local Spotify Connect devices)
- "Log out" at the bottom of settings

**Sign-out pattern:**
- Mobile: Settings > scroll to bottom > "Log out"
- Web: "Sign out everywhere" option for bulk logout from all devices

Source: [Spotify Account Overview guide](https://blog.delivermytune.com/spotify-account-overview/), [Spotify log out support](https://support.spotify.com/us/article/how-to-log-out/), [Spotify Connect support article](https://support.spotify.com/us/article/spotify-connect/)

### Apple Music Account UX

**Account Settings (macOS Music app):**
- My Account button (profile photo or monogram initials) in bottom-left corner
- Clicking opens Account Settings with:
  - Apple Account email address
  - Password management
  - Family Sharing status
  - Payment methods + billing address
  - Country/region
  - Computer Authorizations
  - Device list
  - Subscription status
  - Purchase history (App Store + iTunes)
  - Hidden purchases

**iOS Music app:** Settings > [Apple ID banner at top] > Apple ID, iCloud, Media & Purchases

Apple Music integrates with Apple ID system-wide rather than having its own separate account settings — the logged-in state is determined by the signed-in Apple ID in iOS/macOS Settings.

Source: [Apple Support — Change Account Settings in Music on Mac](https://support.apple.com/guide/music/change-account-settings-musf5a6bf916/mac)

### YouTube Music Account UX

**Account access pattern:**
- Profile picture (top right on mobile, top right on desktop) — this IS the settings entry point
- Tapping profile picture shows: current account name + email, "Settings" option, "Get Music Premium" upsell (if on free tier)

**What the account section shows:**
- Google account profile photo (circular)
- Google account name (display name)
- Google account email address
- Current YouTube Premium / YouTube Music Premium status
- Multiple profiles: tap name to switch between channels under same Google account

**Profile switching (YouTube Premium):**
- Users can have up to 100 channels/profiles under one Google account
- Profile switcher accessible via profile picture > tap current profile name
- Each profile has separate recommendations and history but shares one Premium subscription

**Settings page sections:**
- Privacy and Data (playlist import/transfer, data download)
- Audio quality
- Playback and restrictions
- Notifications
- Paid memberships

**Subscription display:**
- Free tier: "Get Music Premium" button prominently shown
- Premium tier: subscription status shown; link to manage at youtube.com/paid_memberships
- Subscription tier visible in the account info card at top of account panel

Sources: [YouTube Music settings walkthrough — HowToGeek](https://www.howtogeek.com/youtube-music-change-these-settings/), [YouTube Premium profile switching — Android Authority](https://www.androidauthority.com/youtube-music-separate-profile-3603532/), [YouTube Music Premium signup — Google Support](https://support.google.com/youtubemusic/answer/6305537)

### Connect/Disconnect Flow Pattern

For third-party integrations (connecting a streaming service to another app), the standard pattern is:

1. **Disconnected state:**
   - Service logo/icon
   - Short description ("Connect your YouTube Music account")
   - "Connect" or "Sign in with [Service]" button (primary CTA)

2. **Authentication flow:**
   - Opens in-app browser or redirects to service OAuth
   - User logs in and approves permissions

3. **Connected state:**
   - Service logo
   - Account info: profile photo (if accessible via API) + email address or display name
   - Subscription tier badge (if accessible via API)
   - "Disconnect" or "Sign out" link (secondary, less prominent than Connect was)

4. **Re-authentication / expired token state:**
   - Warning indicator on the account row
   - "Reconnect" CTA replaces normal connected state

This pattern is used by: Spotify in third-party smart home apps, YouTube Music in music assistants like Music Assistant (home-assistant.io), and Last.fm in virtually every music app.

Sources: [Music Assistant YouTube Music provider](https://www.music-assistant.io/music-providers/youtube-music/), [Settings UX patterns — Toptal](https://www.toptal.com/designers/ux/settings-ux), general synthesis from research

### Confidence Level

**HIGH** for Spotify account UI (from official Spotify support + developer docs).
**HIGH** for Apple Music account UI (from official Apple support documentation).
**MEDIUM** for YouTube Music account UI (from HowToGeek walkthrough + Android Authority; no official UX spec).
**MEDIUM** for connect/disconnect flow pattern (synthesized from multiple real-world apps, not from a single authoritative spec).

---

## Key Takeaways

1. **Cast discovery is entirely local-network, zero Google auth.** `bonjour-service` or `castv2-client` can discover devices and populate a full device list with name, model, manufacturer, IP, and cast type without any credentials.

2. **Data available from discovery alone is sufficient for a settings UI.** `friendly_name`, `model_name`, `manufacturer`, `cast_type`, `host`, `port`, and `uuid` are all provided by mDNS TXT/SRV/A records.

3. **The `rs` field in TXT records indicates current activity** (what app is running on the device) — this enables showing "currently playing" status without connecting to the device.

4. **Google account adds cross-network, cloud management, and proprietary app access** but is not needed for local device listing or Default Media Receiver control.

5. **Spotify's device list API** (device `name`, `type`, `is_active`, `volume_percent`) is the canonical reference for what fields to expose in a device picker UI.

6. **Account settings top section pattern:** avatar + name + email + subscription tier. Sign-out always at bottom. This is consistent across Spotify, Apple Music, and YouTube Music.

7. **YouTube Music specifically shows:** Google profile photo, Google account name, email, and a Premium/Free tier indicator accessible from the profile picture tap.

8. **For a "connect account" flow**, the disconnected state shows a Connect CTA; connected state shows email + optional subscription tier + smaller Disconnect link.

---

## Gaps Identified

- No authoritative pixel-level screenshots of Spotify's current (2025) "Connect to a device" modal — design may have changed from older references
- Google Home app's exact device tile layout (spacing, typography, status badge placement) not found in public documentation — would require direct app inspection
- YouTube Music API does not expose subscription tier via OAuth — the email/name come from Google OAuth scopes but Premium status requires a separate entitlement check
- `rs` TXT record field semantics (running app name vs. status code) not fully documented in official Cast docs — requires empirical testing

---

## Sources

- [castv2 npm package](https://www.npmjs.com/package/castv2)
- [node-castv2-client GitHub](https://github.com/thibauts/node-castv2-client)
- [Tristan Penman — Chromecast Device Authentication (2025)](https://tristanpenman.com/blog/posts/2025/03/22/chromecast-device-authentication/)
- [oakbits.com — Google Cast Protocol: Discovery and Connection](https://oakbits.com/google-cast-protocol-discovery-and-connection.html)
- [CR-Cast Wiki — Chromecast Implementation Documentation](https://github.com/jloutsenhizer/CR-Cast/wiki/Chromecast-Implementation-Documentation-WIP)
- [pychromecast GitHub (home-assistant-libs)](https://github.com/home-assistant-libs/pychromecast)
- [pychromecast device-discovery.md](https://tessl.io/registry/tessl/pypi-pychromecast/14.0.0/files/docs/device-discovery.md)
- [Google Cast Discovery Troubleshooting](https://developers.google.com/cast/docs/discovery)
- [Google Cast UX Guidelines](https://developers.google.com/cast/docs/ux_guidelines)
- [Google Cast Design Checklist — Cast Dialog](https://developers.google.com/cast/docs/design_checklist/cast-dialog)
- [Home Assistant Google Cast integration](https://www.home-assistant.io/integrations/cast/)
- [Spotify Connect developer documentation](https://developer.spotify.com/documentation/web-playback-sdk/concepts/spotify-connect)
- [Spotify Web API — Get User's Available Devices](https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices)
- [spotifywebapipython Device model documentation](https://spotifywebapipython.readthedocs.io/en/latest/spotifywebapipython/models/device.html)
- [Spotify Connect support article](https://support.spotify.com/us/article/spotify-connect/)
- [Spotify Account Overview guide](https://blog.delivermytune.com/spotify-account-overview/)
- [Spotify — How to log out](https://support.spotify.com/us/article/how-to-log-out/)
- [Apple Support — Change Account Settings in Music on Mac](https://support.apple.com/guide/music/change-account-settings-musf5a6bf916/mac)
- [YouTube Music settings — HowToGeek](https://www.howtogeek.com/youtube-music-change-these-settings/)
- [YouTube Premium profile switching — Android Authority](https://www.androidauthority.com/youtube-music-separate-profile-3603532/)
- [YouTube Music Premium signup — Google Support](https://support.google.com/youtubemusic/answer/6305537)
- [Music Assistant — YouTube Music provider](https://www.music-assistant.io/music-providers/youtube-music/)
- [Settings UX best practices — Toptal](https://www.toptal.com/designers/ux/settings-ux)
- [Designing profile/account/settings pages — Medium Bootcamp](https://medium.com/design-bootcamp/designing-profile-account-and-setting-pages-for-better-ux-345ef4ca1490)
