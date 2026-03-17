# Research: youtubei.js "Failed to extract signature decipher algorithm" Error
Date: 2026-03-16

## Summary

The "Failed to extract signature decipher algorithm" error in youtubei.js is a **recurring class of bug** triggered whenever YouTube rotates or restructures their player JS bundle in ways that break the library's sig/n-function extraction logic. It is NOT a single bug with a single fix — it has recurred across v12, v13, v15, and now v17. The most comprehensive structural fix was the AST-based rewrite in **v16.0.0** (PR #1052). A new variant of the same error emerged on 2026-03-16 (issue #1146), and the proper fix was merged as PR #1152 which shipped in **v17.0.0** (released 2026-03-16).

## Prior Research
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-05-youtubei-js-api-surface.md`
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-12-youtubei-js-authentication-deep-dive.md`

---

## Recurrence History

| Version affected | Issue # | Opened | Resolution | Fixed in |
|---|---|---|---|---|
| v12.1.0 | #841 | 2024-12-10 | player_id workaround / structural fix | v12.2.0 (2024-12-12) |
| v13.2.0–13.3.0 | #831, #952, #911 | 2025-03-12 | YouTube rotated player again | v13.4.0 (2025-04-23) |
| v15.1.1 | #1043, #1044 | 2025-10-11 | AST-based rewrite (PR #1052) | v16.0.0 (2025-10-12) |
| v16.0.x–v17.0.0 | #1146 | 2026-03-16 | Prototype alias + ES6 class support (PR #1152) | v17.0.0 (2026-03-16) |

---

## Root Cause

YouTube periodically restructures their player JS bundle. The library extracts the `sig` (signature decipher) and `n` (nsig throttling decipher) functions from the player JS at initialization time. When YouTube changes the structure — e.g., moving logic into helper functions, using prototype aliasing (`g.q = ij.prototype`), or adopting ES6 class syntax — the existing matchers and analyzers fail to locate the functions.

The error message `[YOUTUBEJS][Player]: Failed to extract signature decipher algorithm` is a warning emitted during `Player.create()`. The downstream failure is a **403 Forbidden** from YouTube's video CDN when the library tries to use an undeciphered URL.

---

## The v16.0.0 Structural Fix (PR #1052)

**Status:** MERGED, shipped in v16.0.0 (2025-10-12). (Confidence: HIGH — official release notes)

**What it did:** Replaced the previous regex/AST hybrid approach with a full dependency-aware AST analyzer (`JsAnalyzer`) and safe code emitter (`JsExtractor`). Instead of pattern-matching for specific function shapes, it now:
1. Traverses the AST and identifies variable dependency relationships within IIFEs
2. Emits a self-contained, side-effect-safe IIFE containing only the sig/n functions and their transitive dependencies
3. Evaluates only that extracted IIFE rather than the full player bundle

**BREAKING CHANGE introduced:** The `Platform.shim.eval` signature changed to receive a `BuildScriptResult` object (`data.output`) rather than raw function strings. Custom eval implementations need updating:

```typescript
// v16+ Platform.shim.eval (after PR #1152 simplification in v17):
Platform.shim.eval = async (data: Types.BuildScriptResult, env: Record<string, Types.VMPrimative>) => {
  return new Function(data.output)();
};

// v16.0.0 – v16.0.1 style (before PR #1152):
Platform.shim.eval = async (data, env) => {
  const properties = [];
  if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
  if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
  return new Function(code)();
};
```

**v16.0.1 (2025-10-16):** Hotfix — missing `await` for `format.decipher()` call in `FormatUtils#download`. This caused silent deciphering failures downstream from the v16.0.0 async/await refactor.

---

## The v17.0.0 Fix for Current Recurrence (PR #1152)

**Status:** MERGED, shipped in v17.0.0 (2026-03-16). (Confidence: HIGH — official release notes, same day)

**What it did:** Added support for the player JS variants that broke v16's AST analyzer:
- Updated `JsAnalyzer` to correctly attribute member assignments through **prototype aliases** (e.g., tracking `a.b.foo = ...` after `a.b = g.c.prototype`)
- Added support for **ES6 class expressions** as AST node types
- Corrected scope assignment for `var` declarations
- Fixed `for` statement block scope handling
- Updated the matcher to find the new sig/n function structures
- **Simplified `Platform.shim.eval`**: callers no longer need to manually call decipher functions — `return new Function(data.output)();` is now sufficient

Note: Community PR #1147 (by @chadacious) targeted the same prototype aliasing issue but was closed without merging on 2026-03-08. The official fix from LuanRT (PR #1152) is more comprehensive — it also updates the matchers and handles ES6 classes.

---

## Issue #1146 Status (Current, 2026-03-16)

Issue #1146 (`exportedVars.nFunction is not a function`) is the current recurrence as of today. It is distinct from but related to the signature decipher error:

1. The new player JS uses `.prototype` aliasing and ES6 class syntax
2. v16's `JsAnalyzer` fails to resolve the base constructor when it encounters `g.q = ij.prototype`
3. The sig/n functions are not exported properly, so `exportedVars.nFunction` is `undefined` at eval time
4. LuanRT confirmed: "Adding support for `.prototype` is only a part of the possible final solution. We still have to update the matchers."
5. **Fix:** PR #1152 merged, released as v17.0.0 today (2026-03-16)

As of writing, issue #1146 is still open. The fix is in v17.0.0 but the issue has not been closed yet.

---

## Configuration Options Relevant to This Error

### `retrieve_player` (default: true)
Controls whether the library fetches the player JS from YouTube. Setting to `false` skips player retrieval entirely — but this also means sig/n deciphering is skipped, which will cause 403s on most streams. Not a valid workaround unless you are using clients that return pre-signed URLs (e.g., `ANDROID` with valid cookies).

### `generate_session_locally` (default: false)
Generates a random visitor data token locally instead of fetching one from YouTube. **LuanRT confirmed (issue #922): YouTube no longer accepts randomly generated visitor tokens for video streams.** This option causes intermittent playback failures on stream URLs. The maintainer recommendation is to use a persistent cache instead so the real token from YouTube is reused.

**Quote from LuanRT on `generate_session_locally`:**
> "That option makes the library generate a random visitor data token. I believe YouTube no longer accepts these, hence why you get that error."
> — Issue #922

### `player_id` (workaround option)
Allows forcing a specific YouTube player version by its ID hash (e.g., `'0004de42'`). This works because older player JS builds still match the library's extraction patterns. **This is a temporary workaround only** — YouTube periodically retires old player versions from their CDN, after which forced IDs will also fail with 403s.

Player IDs can be obtained from:
1. Browser DevTools → Network tab → requests to `base.js` → the path segment after `/player/` is the ID
2. `https://www.youtube.com/iframe_api` → search for `/s/player/xxxxxxx/`
3. Community-maintained caches (e.g., `lovegaoshi/my-express-api` on GitHub)

As of 2026-03-16, community members report that most previously shared player IDs (including `0004de42`) have stopped working.

### `enable_session_cache` + `UniversalCache`
Recommended pattern for production: cache the full session (visitor data, player ID, etc.) to avoid re-fetching on every startup and to reuse a YouTube-issued visitor token rather than generating one locally.

---

## Authenticated Sessions vs. Anonymous Sessions

**Confidence: MEDIUM** (inferred from multiple issues, no single definitive statement)

The signature decipher error affects **both** authenticated and anonymous sessions because the issue is in player JS extraction, which happens before authentication context is applied to stream URLs. Authentication does not bypass the need for sig/n deciphering for most client types.

However:
- The `ANDROID` client with valid cookies sometimes returns pre-signed stream URLs that do not require sig deciphering. Some users in issue #1044 found `client: 'ANDROID'` partially worked, but reported "No valid URL to decipher" errors for some formats.
- YouTube Music Premium sessions are subject to the same sig/n requirements. There is no evidence in the issues that premium authentication bypasses player extraction.
- Issue #960 (still open) documents authenticated cookie sessions not working in React Native specifically, which is a separate platform issue.

The most reliable pattern for authenticated use is cookies + `UniversalCache` (persistent disk cache) without `generate_session_locally`.

---

## Workarounds If v17.0.0 Is Not Available

In order of reliability (as of 2026-03-16):

1. **Upgrade to v17.0.0** — Released today. This is the authoritative fix for the current recurrence. `pnpm add youtubei.js@17.0.0` or `npm install youtubei.js@17.0.1` (v17.0.1 was also released today, same fix).

2. **Force an older `player_id`** — Pass `player_id: '<hash>'` to `Innertube.create()`. Only works as long as YouTube keeps that player version alive on their CDN. Most known working IDs from September–October 2025 (`0004de42`, `b66835e2`) are now reported as failing.

3. **Provide a custom `Platform.shim.eval`** — If you control the JS eval environment (e.g., Node.js with `new Function`), you can override the eval shim to use the native JS engine rather than Jinter. This sidesteps the interpreter's limitations with newer JS syntax:
   ```typescript
   Platform.shim.eval = async (data, env) => {
     return new Function(data.output)();
   };
   ```
   This requires v16+ (AST output format). In v17+ this is the simplified form; in v16 you needed to manually reference `exportedVars.sigFunction` / `exportedVars.nFunction`.

4. **Recreate the Innertube instance on failure** — Some users (issue #922) found that recreating the client instance resolves intermittent failures. Not a fix for the structural extraction problem but useful as a retry mechanism.

5. **Use yt-dlp as fallback** — Suggested by multiple community members when the library is completely broken. Not a youtubei.js solution.

---

## Key Files in youtubei.js Source

| File | Role |
|---|---|
| `src/utils/javascript/JsAnalyzer.ts` | Dependency-aware AST traversal; identifies sig/n function dependencies |
| `src/utils/javascript/JsExtractor.ts` | Safe code emission; rebuilds IIFE from extracted dependencies |
| `src/core/Player.ts` | Orchestrates player JS fetching and decipher function extraction |
| `src/utils/FormatUtils.ts` | Applies deciphered URLs when building format streams |
| `src/platform/Platform.ts` | `Platform.shim.eval` — the JS eval interface (override point for custom engines) |

---

## Key Takeaways

1. **v17.0.1 is the current stable fix.** Released 2026-03-16. Upgrade immediately if hitting this error.
2. **This error will recur.** It is an arms race with YouTube's player JS structure. The library's approach (AST analysis) is more durable than regex matching, but still requires periodic updates when YouTube makes structural changes.
3. **`generate_session_locally: true` is broken for streams** and should not be used in production. Use persistent cache instead.
4. **`player_id` workaround has a limited shelf life.** Older player IDs are eventually retired from YouTube's CDN.
5. **Custom `Platform.shim.eval` is the most future-proof approach** for environments that support `new Function()` — it bypasses Jinter's interpreter gaps entirely.
6. **Authentication does not bypass sig/n deciphering** for standard client types. The error occurs for both anonymous and authenticated sessions.

---

## Sources

- GitHub Issues: #841, #831, #952, #911, #922, #1031, #1043, #1044, #1146 — https://github.com/LuanRT/YouTube.js/issues
- GitHub PRs: #1029 (v15.1.0 fix), #1047 (async evaluator), #1052 (AST rewrite → v16.0.0), #1073 (missing await → v16.0.1), #1147 (closed without merge), #1152 (prototype/ES6 fix → v17.0.0)
- Release notes: v12.2.0, v13.4.0, v15.1.0, v16.0.0, v16.0.1, v17.0.0, v17.0.1 — https://github.com/LuanRT/YouTube.js/releases
- All data sourced directly from GitHub via `gh` CLI on 2026-03-16
