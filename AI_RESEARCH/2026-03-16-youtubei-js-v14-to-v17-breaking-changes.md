# Research: youtubei.js Breaking Changes v14.0.0 → v17.0.1

Date: 2026-03-16

## Summary

There are **7 official breaking changes** across 4 major versions (v14.0.0 through v17.0.0) in the range v14.0.0–v17.0.1. The most impactful are: (1) the async/await refactor of `decipher()` in v16.0.0 which requires `await` in all call sites, (2) the CJS removal in v15.0.0, (3) the `getInfo()`/`getBasicInfo()` parameter shape change in v15.0.0, and (4) the AST-based player extraction rewrite in v16.0.0 which changes the `Platform.shim.eval` contract. Auth/OAuth APIs and `UniversalCache` are UNCHANGED across this range.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-05-youtubei-js-api-surface.md` — full API surface for Music namespace (written against v13.x)
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-12-youtubei-js-authentication-deep-dive.md` — OAuth deep dive
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-16-youtubei-js-signature-decipher-error.md` — signature decipher error history and fixes

---

## All Official Breaking Changes (Chronological)

### v14.0.0 — 2025-06-08

**1 breaking change.**

#### [BC-1] `toDash()` manifest options — `is_sabr` parameter added

- **What changed:** `MediaInfo#toDash()` and `getStreamingInfo()` now accept a `StreamingInfoOptions` object with an `is_sabr` field. The function signature changed.
- **Upstream PR:** #974

**Before (v13.x):**
```typescript
// toDash() did not accept is_sabr; StreamingInfoOptions had no is_sabr field
const manifest = await info.toDash();
```

**After (v14+):**
```typescript
// is_sabr is now an optional field in StreamingInfoOptions
const manifest = await info.toDash({
  manifest_options: {
    is_sabr: true   // NEW optional field; generates sabr:// URLs for SABR protocol
  }
});
```

The `is_sabr` field is optional — omitting it preserves the old behavior. The breaking aspect is the changed function signature; if you were passing positional arguments, you may need to update call sites. **Confidence: HIGH** (official release notes, PR #974 body confirmed).

Current `StreamingInfoOptions` type (v17.0.1):
```typescript
interface StreamingInfoOptions {
  captions_format?: 'vtt' | 'ttml';
  label_original?: string;
  label_drc?: string;
  label_drc_multiple?: (audio_track_display_name: string) => string;
  label_vb?: string;
  label_vb_multiple?: (audio_track_display_name: string) => string;
  is_sabr?: boolean;
}
```

---

### v15.0.0 — 2025-07-18

**2 breaking changes.**

#### [BC-2] CommonJS support dropped — ES modules only

- **What changed:** The `bundle/node.cjs` file was removed. In v14.0.0 the package.json still included `"require": "./bundle/node.cjs"` in the node export map. In v15.0.0 that entry was deleted.
- **Upstream commit:** d134fd2e9e1b27aebd1095562cd5c5da32cbf6d8

**Before (v14.x):**
```javascript
// This worked in v14 and earlier (CommonJS require):
const { Innertube } = require('youtubei.js');
```

**After (v15+):**
```javascript
// Only ESM imports work:
import { Innertube, UniversalCache } from 'youtubei.js';
// Or with a specific platform entry point:
import { Innertube } from 'youtubei.js/web';
import { Innertube } from 'youtubei.js/node';
```

If your project uses `require()` or is configured for CJS (`"type": "commonjs"` in package.json), you MUST either:
- Migrate to ESM (`"type": "module"`)
- Use a dynamic `import()` inside an async context
- Use a CJS-compatible bundler that handles ESM dependencies

**Confidence: HIGH** (official release notes, package.json diff confirmed via gh API).

---

#### [BC-3] `getInfo()` and `getBasicInfo()` second parameter changed to object

- **What changed:** The second parameter of `Innertube.getInfo()`, `Innertube.getBasicInfo()`, `Music.getInfo()`, and `Kids.getInfo()` changed from a plain `InnerTubeClient` string to a `GetVideoInfoOptions` object.
- **Upstream PR:** #994

**Before (v14.x):**
```typescript
// Second param was a raw client string:
const info = await innertube.getInfo('jNQXAC9IVRw', 'MWEB');
const info = await innertube.getBasicInfo('jNQXAC9IVRw', 'ANDROID');
const info = await innertube.music.getInfo('dQw4w9WgXcQ', 'YTMUSIC');
```

**After (v15+):**
```typescript
// Second param is now an options object:
const info = await innertube.getInfo('jNQXAC9IVRw', { client: 'MWEB' });
const info = await innertube.getBasicInfo('jNQXAC9IVRw', { client: 'ANDROID' });
const info = await innertube.music.getInfo('dQw4w9WgXcQ', { client: 'YTMUSIC' });

// The options object also accepts a content-bound po_token (new in v15):
const info = await innertube.getInfo('jNQXAC9IVRw', {
  client: 'MWEB',
  po_token: 'content-bound-po-token-here'  // NEW: per-video PoToken
});
```

The `GetVideoInfoOptions` type:
```typescript
interface GetVideoInfoOptions {
  client?: InnerTubeClient;
  po_token?: string;  // content-bound PoToken (new in v15)
}
```

This affects `Music.getInfo()` directly. Note: `music.getInfo()` already had a wider first-parameter type (`string | MusicTwoRowItem | MusicResponsiveListItem | NavigationEndpoint`) — that did NOT change. Only the second parameter type changed.

**Confidence: HIGH** (official release notes, PR #994 body, source code confirmed).

---

### v16.0.0 — 2025-10-12

**2 breaking changes.**

#### [BC-4] `decipher()`, `Format#decipher()`, `VideoInfo#getStreamingInfo()` are now async

- **What changed:** The JavaScript evaluator was refactored to support async eval functions. As a result, `Player#decipher`, `Format#decipher`, and `VideoInfo#getStreamingInfo` all became `async` and now return `Promise`.
- **Upstream PR:** #1047

**Before (v15.x):**
```typescript
// decipher was synchronous:
const url = someFormat.decipher(innertube.session.player);
// url was a string immediately
```

**After (v16+):**
```typescript
// decipher is now async — must await:
const url = await someFormat.decipher(innertube.session.player);
// url is now a Promise<string> resolved to string

// FormatUtils.download() also needed an await fix (v16.0.1 hotfix):
// This was a bug introduced by the v16.0.0 async refactor — fixed in v16.0.1
```

If you were calling `format.decipher()` directly (rather than using `format.url` which is pre-deciphered), you must add `await`. In practice, most downstream code uses `format.url` (which is deciphered during `getStreamingInfo` / `getInfo`) and is not affected — but any code that calls `decipher()` directly must add `await`.

**Note (v16.0.1 hotfix, 2025-10-16):** The `FormatUtils#download` function was missing an `await` for its internal `format.decipher()` call. This was a regression introduced by v16.0.0. Fix: `ca05eab`. If you were using `innertube.download()` in v16.0.0 specifically, it was silently broken; v16.0.1 fixed it.

**Confidence: HIGH** (official PR #1047 body: "BREAKING_CHANGE: `Player#decipher`, `Format#decipher` and `VideoInfo#getStreamingInfo` are now asynchronous").

---

#### [BC-5] `Platform.shim.eval` contract changed — now receives `BuildScriptResult`

- **What changed:** The AST-based player extraction rewrite changed the interface between player extraction and the JS evaluator shim. Custom `Platform.shim.eval` implementations (used in non-Node environments like React Native, Cloudflare Workers, or online JS sandboxes) must be updated.
- **Upstream PR:** #1052

This is only a breaking change if you were providing a **custom `Platform.shim.eval`**. The default Node.js and browser platforms are unaffected.

**Before (v15.x) — pre-AST extraction:**
```typescript
// eval received raw JS strings for sig/nsig functions
Platform.shim.eval = (js_code: string, return_value: string) => {
  return new Function(`${js_code};return ${return_value}`)();
};
```

**After v16.0.0 (AST output format, initial):**
```typescript
// eval now receives a BuildScriptResult (data.output is a full self-contained IIFE)
// and an env object with the values to decipher
Platform.shim.eval = async (
  data: Types.BuildScriptResult,
  env: Record<string, Types.VMPrimative>
) => {
  // In v16.0.0 you had to manually call the exported functions:
  const properties = [];
  if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
  if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
  return new Function(code)();
};
```

**After v17.0.0 (simplified — PR #1152):**
```typescript
// v17 simplification: the output already includes the return statement
Platform.shim.eval = async (
  data: Types.BuildScriptResult,
  env: Record<string, Types.VMPrimative>
) => {
  return new Function(data.output)();
};
```

The `BuildScriptResult` type:
```typescript
// From JsExtractor.ts:
interface BuildScriptResult {
  output: string;    // self-contained IIFE string ready for eval
  exported: string[];  // names of exported functions
  exportedRawValues?: Record<string, string>;  // e.g. signatureTimestamp
}
```

The `eval` function is also now declared as `async`-compatible in `PlatformShim`:
```typescript
eval(data: BuildScriptResult, env: Record<string, VMPrimative>): Promise<EvalResult> | EvalResult;
```

**Confidence: HIGH** (official PR #1047 and #1052, PlatformShim type confirmed via gh API).

---

### v17.0.0 — 2026-03-16

**2 breaking changes.**

#### [BC-6] Search filters updated — `SearchFilters` type changed

- **What changed:** `SearchFilters` type properties changed to align with YouTube's updated filter structure. This affects `innertube.search()` (not `music.search()` — `MusicSearchFilters` is unchanged).
- **Upstream PR:** #1136

**Before (v16.x) `SearchFilters`:**
```typescript
type UploadDate = 'all' | 'hour' | 'today' | 'week' | 'month' | 'year';
type SearchType = 'all' | 'video' | 'channel' | 'playlist' | 'movie';
type Duration = 'all' | 'short' | 'medium' | 'long';
type SortBy = 'relevance' | 'rating' | 'upload_date' | 'view_count';

type SearchFilters = {
  upload_date?: UploadDate;    // included 'hour'
  type?: SearchType;           // did NOT include 'shorts'
  duration?: Duration;         // used 'short' | 'medium' | 'long'
  sort_by?: SortBy;            // used 'relevance' | 'rating' | 'upload_date' | 'view_count'
  features?: Feature[];
};
```

**After (v17.0.0) `SearchFilters`:**
```typescript
type UploadDate = 'all' | 'today' | 'week' | 'month' | 'year';  // 'hour' REMOVED
type SearchType = 'all' | 'video' | 'shorts' | 'channel' | 'playlist' | 'movie';  // 'shorts' ADDED
type Duration = 'all' | 'over_twenty_mins' | 'under_three_mins' | 'three_to_twenty_mins';  // renamed values
type Prioritize = 'relevance' | 'popularity';  // SortBy REPLACED by Prioritize

type SearchFilters = {
  upload_date?: UploadDate;
  type?: SearchType;
  duration?: Duration;
  prioritize?: Prioritize;   // replaces sort_by
  features?: Feature[];
};
```

Key changes:
- `UploadDate`: `'hour'` was removed (YouTube removed the "Past hour" filter)
- `SearchType`: `'shorts'` was added
- `Duration` values were renamed: `'short'` → `'under_three_mins'`, `'medium'` → `'three_to_twenty_mins'`, `'long'` → `'over_twenty_mins'`
- `sort_by` field was renamed to `prioritize`, and its type was simplified from 4 values to 2 (`'relevance' | 'popularity'`)

**`MusicSearchFilters` is NOT changed** — it still uses `{ type?: 'all' | 'song' | 'video' | 'album' | 'playlist' | 'artist' }`.

**Confidence: HIGH** (CHANGELOG, type source confirmed via gh API on both v16.0.1 and v17.0.0 SHA).

---

#### [BC-7] `getTrending()` removed from `Innertube`

- **What changed:** `innertube.getTrending()` was removed because YouTube removed their trending feed endpoint.
- **Upstream PR:** #1114

**Before (v16.x):**
```typescript
const trending = await innertube.getTrending();
```

**After (v17+):**
```typescript
// This method no longer exists. Calling it will throw a TypeError.
```

**Confidence: HIGH** (official release notes, PR #1114).

---

## APIs That Did NOT Change (v14 → v17)

### `Innertube.create()` — options are additive only, no removals

The `SessionOptions` / `InnerTubeConfig` type gained new fields across versions but no existing fields were removed or renamed:

| Field | Since | Status in v17 |
|---|---|---|
| `cache` | pre-v14 | unchanged |
| `cookie` | pre-v14 | unchanged |
| `fetch` | pre-v14 | unchanged |
| `generate_session_locally` | pre-v14 | unchanged (see warning below) |
| `retrieve_player` | pre-v14 | unchanged |
| `enable_safety_mode` | pre-v14 | unchanged |
| `lang` | pre-v14 | unchanged |
| `location` | pre-v14 | unchanged |
| `po_token` | pre-v14 | unchanged |
| `retrieve_innertube_config` | v13.4.0 | unchanged |
| `player_id` | v13.4.0 | unchanged |
| `enable_session_cache` | pre-v14 | unchanged |
| `fail_fast` | v16.0.0 (new) | new option |
| `visitor_data` | pre-v14 | unchanged |
| `client_type` | pre-v14 | unchanged |
| `timezone` | pre-v14 | unchanged |
| `user_agent` | pre-v14 | unchanged |

**Warning on `generate_session_locally`:** LuanRT confirmed in issue #922 that YouTube no longer accepts randomly generated visitor tokens for video streams. This option is functionally broken for stream access. Use `enable_session_cache: true` with `UniversalCache` instead.

Current `SessionOptions` shape (v17.0.1):
```typescript
type SessionOptions = {
  lang?: string;
  location?: string;
  user_agent?: string;
  account_index?: number;
  on_behalf_of_user?: string;
  retrieve_player?: boolean;
  enable_safety_mode?: boolean;
  retrieve_innertube_config?: boolean;
  generate_session_locally?: boolean;
  fail_fast?: boolean;            // new in v16.0.0
  enable_session_cache?: boolean;
  device_category?: DeviceCategory;
  client_type?: ClientType;
  timezone?: string;
  cache?: ICache;
  cookie?: string;
  visitor_data?: string;
  fetch?: FetchFunction;
  po_token?: string;
  player_id?: string;
}
```

---

### `innertube.music.search()` — unchanged

```typescript
// Signature in v14 through v17 (no changes):
search(query: string, filters: MusicSearchFilters = {}): Promise<Search>

// MusicSearchFilters also unchanged:
type MusicSearchFilters = { type?: 'all' | 'song' | 'video' | 'album' | 'playlist' | 'artist' }
```

The `Search` result object structure, shelf accessors (`.songs`, `.videos`, `.albums`, etc.), and `MusicShelf`/`MusicResponsiveListItem` types are unchanged. **Confidence: HIGH.**

---

### `innertube.music.getInfo()` — second parameter changed in v15 (see BC-3)

```typescript
// v14 and earlier:
getInfo(target: string | MusicTwoRowItem | MusicResponsiveListItem | NavigationEndpoint, client?: string): Promise<TrackInfo>

// v15+ (current):
getInfo(target: string | MusicTwoRowItem | MusicResponsiveListItem | NavigationEndpoint, options?: GetVideoInfoOptions): Promise<TrackInfo>
// GetVideoInfoOptions = { client?: InnerTubeClient; po_token?: string }
```

The `TrackInfo` return type, `streaming_data` structure, and `adaptive_formats` array are unchanged.

---

### `streaming_data` / `adaptive_formats` — structure unchanged

The `MediaInfo.streaming_data` property and its `formats`/`adaptive_formats` arrays are unchanged across v14–v17. The `Format` class fields are also unchanged.

```typescript
// This access pattern works in v14 through v17:
info.streaming_data?.adaptive_formats
info.streaming_data?.formats

// The format.url property:
// In v15 and earlier: url may be pre-deciphered or may require calling format.decipher()
// In v16+: decipher() is async (BC-4) — but format.url is still pre-deciphered by getInfo()
// So if you access format.url directly (not calling decipher yourself), nothing changes.
```

**Confidence: HIGH** (source code inspection of VideoInfo.ts and Format.ts confirmed).

---

### OAuth / Auth — unchanged across v14–v17

The OAuth2 module was rewritten prior to v14 (around v13.x, PR #661). The API in v14 is the same API in v17. No breaking changes to auth in this range.

Current auth API (unchanged v14–v17):
```typescript
// Session events:
session.on('auth', ({ credentials }) => { /* OAuth2Tokens */ });
session.on('auth-pending', (data) => { /* DeviceAndUserCode — show data.verification_url to user */ });
session.on('auth-error', (err) => { /* OAuth2Error */ });
session.on('update-credentials', ({ credentials }) => { /* refreshed OAuth2Tokens */ });

// Sign in:
await session.signIn();                     // device-flow (shows verification URL)
await session.signIn(existingTokens);       // resume with cached OAuth2Tokens

// Sign out:
await session.signOut();

// Credential types:
interface OAuth2Tokens {
  access_token: string;
  expiry_date: string;
  expires_in?: number;
  refresh_token: string;
  scope?: string;
  token_type?: string;
  client?: OAuth2ClientID;  // { client_id: string; client_secret: string }
}

interface DeviceAndUserCode {
  device_code: string;
  expires_in: number;
  interval: number;
  user_code: string;
  verification_url: string;  // show this to the user
  error_code?: string;
}
```

**Confidence: HIGH** (Session.ts source confirmed via gh API, no breaking changes in release notes).

---

### `UniversalCache` — unchanged across v14–v17

```typescript
// Constructor unchanged:
new UniversalCache(persistent: boolean, persistent_directory?: string)

// Methods unchanged:
cache.get(key: string)
cache.set(key: string, value: ArrayBuffer)
cache.remove(key: string)
cache.cache_dir  // getter

// Usage pattern unchanged:
const yt = await Innertube.create({
  cache: new UniversalCache(true),  // persistent disk cache
  enable_session_cache: true,       // enables caching the session via the cache
});
```

**Confidence: HIGH** (Cache.ts source confirmed, no mention in release notes).

---

## Signature Decipher Algorithm — Fix History

The "Failed to extract signature decipher algorithm" error is NOT a single fix — it's a recurring class of problem. Within the v14–v17 range:

| Version | What changed |
|---|---|
| v13.4.0 | Bug fix: use global variable to find signature algorithm (#953) — this was the baseline entering v14 |
| v15.1.0 | Bug fix: fixed global variable extraction in deciphering code (#1029) |
| v16.0.0 | **Major structural fix:** AST-based JS extraction (PR #1052). Replaced regex/simple-AST approach with `JsAnalyzer` + `JsExtractor`. This is the most durable fix architecturally. |
| v16.0.1 | Bug fix: missing `await` for `format.decipher()` in download function |
| v15.1.1 | Bug fix: player cache now stores full library version (prevents stale cache issues) |
| v17.0.0 | Bug fix: added prototype alias support and ES6 class support to `JsAnalyzer` (PR #1152), fixing the latest YouTube player JS changes |

**The v16.0.0 AST rewrite (PR #1052) is the authoritative structural fix** for "Failed to extract signature decipher algorithm." It introduced `JsAnalyzer` (dependency-aware AST traversal) and `JsExtractor` (safe IIFE emission), replacing the regex-based approach that broke whenever YouTube restructured their player bundle.

**The v17.0.0 fix (PR #1152)** addressed a new variant of the same issue caused by YouTube's use of prototype aliasing (`g.q = ij.prototype`) and ES6 class syntax that the v16 AST analyzer couldn't handle.

**Confidence: HIGH** (release notes, PR bodies, issue tracker all confirmed via gh API).

---

## Migration Guide Summary

### Upgrading from v14.x to v15.x

1. **Switch to ESM.** Remove any `require('youtubei.js')` calls. Use `import`.
2. **Update `getInfo()` / `getBasicInfo()` call sites.** Change `getInfo(id, 'CLIENT')` to `getInfo(id, { client: 'CLIENT' })`. Applies to `Innertube`, `Music`, and `Kids` clients.
3. `toDash()` signature change from v14 should already be handled — `is_sabr` is optional.

### Upgrading from v15.x to v16.x

4. **Audit `format.decipher()` call sites.** If you call `decipher()` directly (not via `format.url`), add `await`.
5. **Update custom `Platform.shim.eval`** if you have one. The function signature changed from raw JS strings to `(data: BuildScriptResult, env: Record<string, VMPrimative>) => Promise<EvalResult>`.
6. **`format.decipher()` and `getStreamingInfo()` are now async** — use `await` everywhere.

### Upgrading from v16.x to v17.x

7. **Update `SearchFilters` usage** (for `innertube.search()` only, not `music.search()`):
   - Remove `'hour'` from `upload_date` values
   - Add `'shorts'` as a valid `type` value if needed
   - Rename `duration` values: `'short'` → `'under_three_mins'`, `'medium'` → `'three_to_twenty_mins'`, `'long'` → `'over_twenty_mins'`
   - Rename `sort_by` field to `prioritize`; change values `'rating'`/`'upload_date'`/`'view_count'` → only `'relevance'` or `'popularity'` remain
8. **Remove `innertube.getTrending()` calls.** No replacement exists.
9. **Simplify `Platform.shim.eval`** if needed: `return new Function(data.output)()` is now sufficient (no need to manually call `exportedVars.nFunction`/`exportedVars.sigFunction`).

---

## Key Takeaways

1. **`music.search()` and `MusicSearchFilters` are unchanged across v14–v17.** No migration needed for music search.
2. **`music.getInfo()` has one change (v15):** second param is now `{ client?: ..., po_token?: ... }` instead of a bare string client name.
3. **`streaming_data.adaptive_formats` access pattern is unchanged.** The structure of `Format` objects did not change.
4. **`format.url` still works the same way** — it's pre-deciphered by `getInfo()`. Only code that calls `format.decipher()` directly needs the `await`.
5. **Auth (OAuth2) and `UniversalCache` APIs are completely stable** — no changes in this range.
6. **The biggest migration risk is ESM-only (v15) and async decipher (v16)** — both are hard breaks that need code changes.
7. **v17.0.1 (2026-03-16) is the current stable release** and includes the latest signature decipher fix.

---

## Sources

All data sourced directly from the official repository on 2026-03-16:

- GitHub Releases v14.0.0–v17.0.1: `gh api repos/LuanRT/YouTube.js/releases`
- CHANGELOG.md: `gh api repos/LuanRT/YouTube.js/contents/CHANGELOG.md`
- PR #974 (is_sabr): `gh api repos/LuanRT/YouTube.js/pulls/974`
- PR #994 (GetVideoInfoOptions): `gh api repos/LuanRT/YouTube.js/pulls/994`
- PR #1047 (async/await evaluator): `gh api repos/LuanRT/YouTube.js/pulls/1047`
- PR #1052 (AST extraction): `gh api repos/LuanRT/YouTube.js/pulls/1052`
- PR #1136 (search filters): `gh api repos/LuanRT/YouTube.js/pulls/1136`
- PR #1114 (remove getTrending): release notes
- Source: `src/types/Misc.ts` (SearchFilters, MusicSearchFilters)
- Source: `src/types/GetVideoInfoOptions.ts`
- Source: `src/types/StreamingInfoOptions.ts`
- Source: `src/types/FormatUtils.ts`
- Source: `src/core/Session.ts` (SessionOptions, signIn, events)
- Source: `src/core/Player.ts` (decipher, BuildScriptResult)
- Source: `src/utils/Cache.ts` (UniversalCache)
- Source: `src/types/PlatformShim.ts` (eval signature)
- Source: `src/core/clients/Music.ts` (music.search, music.getInfo signatures)
- v16.0.1 SHA: `src/types/Misc.ts` at `6ce981ced9ffbd9911899bc36a1561bd41677a78`
