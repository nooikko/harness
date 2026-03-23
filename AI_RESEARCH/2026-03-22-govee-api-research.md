# Research: Govee Smart Light API

Date: 2026-03-22

## Summary

Govee offers two distinct control APIs: a cloud REST API (v2, via `openapi.api.govee.com`) and a local LAN API (UDP-based). The cloud API is the primary supported path, with an API key obtained through the mobile app. The LAN API is a newer addition that provides low-latency local control on supported devices. No rooms/zones concept exists in either API. Color is RGB (sent as 24-bit integer in v2, or separate r/g/b in the LAN API). The ecosystem is functional but rate-limited (10 req/min, 10,000/day on cloud), and many npm packages are unmaintained.

## Prior Research

None — first Govee research in this project.

## Current Findings

---

### 1. Govee Cloud API (v2)

**Base URL:** `https://openapi.api.govee.com`

**Authentication:** API key in HTTP header `Govee-API-Key: <your_key>`

**How to get an API key:**
1. Open Govee Home App → Profile → Settings → "Apply for API Key"
2. Fill in name + reason (e.g., "home automation")
3. Email with key arrives within minutes to a few hours
4. Approval is at Govee's discretion

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/router/api/v1/user/devices` | List all devices on account |
| POST | `/router/api/v1/device/state` | Get device state |
| POST | `/router/api/v1/device/control` | Send control command |
| GET | `/router/api/v1/device/scenes` | Get available light scenes |

**List devices response** (`GET /router/api/v1/user/devices`):
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "sku": "H6008",
      "device": "AA:BB:CC:DD:EE:FF:GG:HH",
      "deviceName": "My Light Strip",
      "capabilities": [
        {
          "type": "devices.capabilities.on_off",
          "instance": "powerSwitch",
          "parameters": { ... }
        }
      ]
    }
  ]
}
```

**Device state request** (`POST /router/api/v1/device/state`):
```json
{
  "requestId": "uuid-v4",
  "payload": {
    "sku": "H6008",
    "device": "AA:BB:CC:DD:EE:FF:GG:HH"
  }
}
```

State response includes capabilities with current `state.value` for: `online`, `powerSwitch`, `brightness`, `colorRgb`, `colorTemperatureK`, `workMode`.

**Control command request** (`POST /router/api/v1/device/control`):
```json
{
  "requestId": "uuid-v4",
  "payload": {
    "sku": "H6008",
    "device": "AA:BB:CC:DD:EE:FF:GG:HH",
    "capability": {
      "type": "devices.capabilities.on_off",
      "instance": "powerSwitch",
      "value": 1
    }
  }
}
```

**Supported capability types and values:**

| Capability Type | Instance | Value |
|----------------|----------|-------|
| `devices.capabilities.on_off` | `powerSwitch` | `0` (off) or `1` (on) |
| `devices.capabilities.range` | `brightness` | Integer 1–100 |
| `devices.capabilities.color_setting` | `colorRgb` | Integer 0–16,777,215 (24-bit RGB packed) |
| `devices.capabilities.color_setting` | `colorTemperatureK` | Integer 2000–9000 (Kelvin) |
| `devices.capabilities.mode` | `lightScene` | Enum (device-specific) |
| `devices.capabilities.mode` | `diyScene` | Enum (device-specific) |
| `devices.capabilities.segment_color_setting` | `segmentedColorRgb` | Struct (multi-zone LED strips) |

**Color model:** 24-bit integer (not CIE xy). To send RGB (255, 128, 0):
`value = (255 << 16) | (128 << 8) | 0 = 16744448`

**Rate limits:**
- 10 requests per minute per device (enforced per-device, not global)
- 10,000 requests per account per day
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- HTTP 429 returned when exceeded

**Error codes:**
- 200: Success
- 400: Bad request
- 401: Unauthorized (invalid API key)
- 404: Device not found
- 429: Rate limited

**Scenes/Modes:** Available via `devices.capabilities.mode` with instances `lightScene` and `diyScene`. The enum of available scenes is device-specific and returned in the `capabilities` array of the list devices response. Retrieving the *active* scene via state query has known issues — `diyScene` instance returns empty string even when a scene is active. This is a documented community complaint.

**No rooms or groups concept.** Govee's API is purely device-level. No Hue-style groups, rooms, zones, or entertainment areas exist in the v2 API.

---

### 2. Govee LAN API (Local Control)

**Status:** Real and documented, but device support is limited. Must be explicitly enabled per device in the Govee Home App.

**Protocol:** UDP (not HTTP). JSON message format.

**Ports:**
| Port | Direction | Purpose |
|------|-----------|---------|
| 4001 (UDP) | Device listens | Discovery requests, control commands (via multicast) |
| 4002 (UDP) | Client listens | Device responses |
| 4003 (UDP) | Device listens | Direct control commands (unicast after discovery) |

**Discovery:**
- Devices join multicast group `239.255.255.250`
- Client sends scan packet to `239.255.255.250:4001`
- Devices respond to client on port 4002 with IP address and metadata

**Message format:** JSON with `msg` wrapper:
```json
{
  "msg": {
    "cmd": "scan",
    "data": { "account_topic": "reserve" }
  }
}
```

**LAN control commands:**

| `cmd` | Purpose | `data` |
|-------|---------|--------|
| `scan` | Discovery | `{ "account_topic": "reserve" }` |
| `devStatus` | Query state | `{}` |
| `turn` | Power | `{ "value": 0 }` or `{ "value": 1 }` |
| `brightness` | Brightness | `{ "value": 1–100 }` |
| `colorwc` | Color + color temp | `{ "color": {"r":255,"g":128,"b":0}, "colorTemInKelvin": 4000 }` |
| `ptReal` | Scene/mode | `{ "command": ["<base64_encoded_bytes>"] }` |

**State response fields:** online, powerSwitch (0/1), brightness (0–100), color {r,g,b}, colorTemInKelvin.

**Color model (LAN):** Separate r/g/b fields (0–255 each) plus Kelvin for color temp. More explicit than the cloud API's packed 24-bit integer.

**Scenes via LAN:** Supported through the `ptReal` command using base64-encoded BLE command sequences. This is complex — it requires encoding device-specific scene IDs into the Govee BLE command format, then base64-encoding them. Community reverse-engineering exists (govee2mqtt docs) but it is not officially documented in a clean way.

**Discovery caveats:**
- Multicast UDP is not well supported on many WiFi routers/access points
- Fallback options: broadcast to 255.255.255.255, broadcast to all interface addresses, or unicast to known IPs
- Docker requires explicit UDP port mappings for ports 4001–4003

**Enabling LAN mode:** Go to Govee Home App → device → Settings → LAN Control toggle. If toggle doesn't appear after 30 minutes, device likely doesn't support LAN API.

**Compatible device types:** WiFi-enabled light strips, bulbs, panels. NOT: Bluetooth-only devices, appliances (humidifiers, kettles, heaters), sensors.

---

### 3. npm Packages

| Package | Target API | TypeScript | Last Active | Status |
|---------|-----------|-----------|-------------|--------|
| `govee-lan-control` | LAN UDP | Yes | Recent | Active, recommended for LAN |
| `@felixgeelhaar/govee-api-client` | Cloud v2 | Yes | Unknown | Claims enterprise-grade |
| `govee-ts` | Cloud v1.1 | Yes | Feb 2021 | Abandoned |
| `node-govee-led` | Cloud v1.1 | No | Oct 2020 | Abandoned |

**`govee-lan-control`** (npm install name: `govee-lan-control`):
- Written in TypeScript, compiles via tsup
- Main class: `Govee.default()`
- Events: `"ready"`, `"deviceAdded"`
- Device API: `device.actions.setColor(hslOrHex)`, `device.actions.fadeColor(color, duration)`
- Uses all three UDP ports (4001, 4002, 4003)
- GitHub: https://github.com/Joery-M/Govee-LAN-Control

**`@felixgeelhaar/govee-api-client`** (npm: `@felixgeelhaar/govee-api-client`):
- Claims DDD architecture, retry/rate-limit handling
- Targets cloud v2 API
- 403 on npm page at time of research — verify independently

**Strongly consider wrapping the API directly** rather than using community libraries, given the rate of abandonment. The cloud API is simple enough (4 endpoints) that a thin wrapper is low effort.

---

### 4. Key Differences from Philips Hue

| Dimension | Philips Hue | Govee |
|-----------|-------------|-------|
| **Auth** | Link button on bridge (local), OAuth (cloud) | API key from mobile app (email, minutes–hours) |
| **Discovery** | mDNS (`_hue._tcp`) for bridge on LAN | UDP multicast `239.255.255.250:4001` per device |
| **Local API** | Full REST HTTP on bridge (local network) | UDP JSON messages per device (no bridge) |
| **Cloud API** | Hue Remote API (OAuth) | `openapi.api.govee.com` (API key header) |
| **Rate limits** | 10 req/sec, no hard daily limit | 10 req/min, 10,000/day |
| **Color model** | CIE xy + brightness (XY color space) | 24-bit RGB integer (cloud) / r,g,b struct (LAN) |
| **Color temp** | Mirek (153–500) | Kelvin (2000–9000) |
| **Groups/Rooms** | Full rooms, zones, entertainment areas | None — device-level only |
| **Scenes** | Bridge-stored, retrievable, named | Device enum (cloud) / base64 BLE encoding (LAN) |
| **Bridge required** | Yes (Hue Bridge) | No (direct to device) |
| **Device identity** | Device ID + light ID separate | MAC address = device ID (`sku` = model) |
| **Segment control** | Via entertainment API | `segmentedColorRgb` capability (LAN strips) |
| **SDK quality** | Official SDKs, mature ecosystem | Community packages, mostly abandoned |

**Architecture transfer from Hue plugin:**
- The plugin contract structure (tools, settingsSchema, start/stop lifecycle) transfers 100%
- `ctx.getSettings` / `ctx.notifySettingsChange` pattern transfers 100%
- Device listing and state query patterns are similar (different shape)
- **Group/room abstraction will not transfer** — Govee has no native concept. You'd need to implement virtual groups in the plugin layer (store group→device mappings in PluginConfig or a DB table)
- **Color conversion layer needed:** Hue uses CIE xy; Govee uses packed RGB integer. Any cross-system color logic needs conversion.
- **Rate limiting is more aggressive** on Govee (10/min vs Hue's 10/sec) — requires queueing/throttling in the plugin

---

## Key Takeaways

1. **Cloud API is straightforward.** Four endpoints, API key auth, stable base URL at `openapi.api.govee.com`. Getting a key takes minutes via the mobile app. This is the reliable path.

2. **LAN API exists and works** on supported devices, but has real operational complexity: must enable per device in app, multicast UDP discovery is unreliable on many routers, scenes require reverse-engineered BLE encoding. The LAN API is best for latency-sensitive local control after cloud-based discovery.

3. **No rooms or groups.** This is the biggest architectural gap vs Hue. Any group-control feature must be implemented at the plugin layer.

4. **RGB color model, not CIE xy.** Govee is simpler in this dimension — no gamut conversion, just pack r/g/b into a 24-bit int for the cloud API or send as separate fields for LAN.

5. **Rate limits are a real constraint.** 10 req/min per device means polling for state is not feasible at any meaningful frequency. LAN API has no documented rate limit, making it better for real-time control loops.

6. **npm ecosystem is largely abandoned.** `govee-lan-control` is the only actively maintained package. For the cloud API, writing a thin wrapper is more reliable than depending on community packages.

7. **Scenes are opaque.** Available scene IDs come from the device capabilities response, but they're enums without human-readable names in the API response itself. DIY scenes are effectively not retrievable via the state API (known bug).

## Sources

- https://developer.govee.com/docs/getting-started
- https://developer.govee.com/reference/get-you-devices
- https://developer.govee.com/reference/control-you-devices
- https://developer.govee.com/reference/get-devices-status
- https://developer.govee.com/reference/get-light-scene
- https://app-h5.govee.com/user-manual/wlan-guide
- https://deepwiki.com/wez/govee2mqtt/3.1-lan-api
- https://github.com/wez/govee2mqtt/blob/main/docs/LAN.md
- https://github.com/Joery-M/Govee-LAN-Control
- https://www.npmjs.com/package/govee-lan-control
- https://github.com/koennjb/govee-ts
- https://github.com/mynameismax/node-govee-led
- https://learn.microsoft.com/en-us/connectors/govee/
- https://govee-public.s3.amazonaws.com/developer-docs/GoveeDeveloperAPIReference.pdf
- https://govee.readme.io/reference/rate-limiting
- https://community.govee.com/posts/mastering-the-lan-api-series-lan-api-101/136755
