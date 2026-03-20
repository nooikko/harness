---
id: event-listener-callback-type-casting
trigger: when TypeScript reports untyped event emitter callbacks reject specific parameter signatures
confidence: 0.5
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Event Listener Callback Type Casting for Untyped Emitters

## Action
Cast typed event listener callbacks to `(...args: unknown[]) => void` when third-party event emitters (like innertube.session.on) have loose type signatures.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: innertube.session.on() expects `listener: (...args: unknown[]) => void`, but specific callback signatures cause TS2345 errors
- Occurrences:
  - youtube-music-auth.ts:72 - update-credentials callback with `{ credentials: updated }`
  - youtube-music-auth.ts:88 - auth-pending callback with `{ verification_url, user_code, interval?, expires_in? }`
  - youtube-music-auth.ts:101 - auth callback with `{ credentials }`
- Solution pattern: `innertube.session.on('event-name', ((args) => { ... }) as (...args: unknown[]) => void)`
- Last observed: 2026-03-16

## Context
When integrating with third-party libraries that use generic event emitters with untyped listeners, wrap the callback in extra parentheses and add the cast to satisfy TypeScript's type narrowing while preserving the callback's internal type safety.
