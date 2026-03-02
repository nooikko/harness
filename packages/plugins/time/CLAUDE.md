# Time Plugin — Developer Notes

## Overview

The time plugin has two entry points: an `onBeforeInvoke` hook that does prompt token replacement, and a `current_time` MCP tool that Claude can call during invocation. Both call `formatTime({ timezone: ctx.config.timezone })`. Read `src/index.ts` and `src/_helpers/format-time.ts` before editing.

---

## COMMAND_PATTERN regex has stateful `/g` flag

`COMMAND_PATTERN` is defined at module scope as `/\/current-time/g`. The `/g` flag makes the regex stateful — `RegExp.prototype.test()` and `exec()` advance `lastIndex` on each call, which causes alternating true/false results if the same regex instance is reused without resetting.

The plugin guards against this explicitly: `lastIndex` is reset to `0` immediately after every `.test()` call, whether the test passed or failed. See lines 18 and 21 in `src/index.ts`.

If you refactor the guard logic or add additional `.test()` / `.exec()` calls on `COMMAND_PATTERN`, you must reset `lastIndex` before each use. Failing to do so will cause the plugin to miss `/current-time` tokens on every other invocation — a flaky bug that is very hard to catch in tests unless you exercise the plugin on consecutive calls.

---

## Two replacement modes: standalone vs. inline

When `/current-time` is found in the prompt, the plugin checks whether it is the entire content of the `## User Message` section or just an embedded token.

**Standalone detection** (line 28):

```typescript
const userMessageContent = /## User Message\s*\n\n(.+)$/s.exec(prompt)?.[1]?.trim();
if (userMessageContent === '/current-time') { ... }
```

If the user sent exactly `/current-time` as their message and nothing else, the replacement rewrites the entire `## User Message` section to:

```
## User Message

The current time is [time]. Please tell me the current time.
```

This is necessary because a bare token replacement would leave the User Message section containing only a timestamp annotation with no instruction — Claude would have nothing to respond to.

**Inline replacement** (line 33): If `/current-time` appears within a larger message, it is replaced in-place with `[Current time: [time]]`, leaving the surrounding text intact.

---

## Standalone detection is coupled to `assemblePrompt()` output format

The regex `/## User Message\s*\n\n(.+)$/s` is tightly coupled to the markdown structure that `apps/orchestrator/src/orchestrator/index.ts` `assemblePrompt()` produces. Specifically, it expects:

- A `## User Message` heading
- Followed by exactly one blank line (`\n\n`)
- Followed by the message content as the last section

If `assemblePrompt()` ever changes its heading text, adds content after the user message section, or changes its whitespace conventions, this regex will fail to match and standalone `/current-time` messages will fall through to the inline replacement path instead. The result would be a prompt with `[Current time: ...]` as the sole content of the User Message section — not a crash, but a subtly wrong response from Claude.

There is no assertion or test that verifies the regex matches the actual `assemblePrompt()` output format. If you change the prompt assembly format, check this regex.

---

## Timezone validation in `start()` does not prevent startup

The `start()` lifecycle method validates the configured timezone against `Intl.supportedValuesOf("timeZone")`. If the timezone is invalid, it logs an error:

```
Time plugin: invalid timezone "Foo/Bar" — time reporting will fall back to UTC.
```

However, it does **not** throw. Startup continues normally. `formatTime` will then receive an invalid timezone string, and `Intl.DateTimeFormat` will throw or fall back to UTC depending on the runtime. In practice this means time output will be in UTC without any further warning at invocation time.

If you see UTC timestamps when a different timezone is configured, check the startup logs for this error.

---

## Time format

`formatTime` uses `Intl.DateTimeFormat` with `'en-US'` locale and these options:

```typescript
{
  timeZone: options.timezone,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
}
```

Example output: `"Saturday, March 1, 2026, 2:45:30 PM PST"`

The format is identical whether the timestamp came from prompt injection or the `current_time` tool. The `now` parameter on `FormatTimeOptions` exists for testability — production code always omits it and uses `new Date()`.

---

## Plugin runs after context plugin in `onBeforeInvoke` chain

Plugin registration order in `apps/orchestrator/src/plugin-registry/index.ts` is: `context`, then `time` (among others). The `onBeforeInvoke` hook is a chain hook — each plugin receives the previous plugin's output as its input prompt.

This means: by the time the time plugin sees the prompt, the context plugin has already injected conversation history and context files. Time replacement operates on the fully-assembled, history-injected prompt. This is correct behavior, but be aware that the standalone detection regex must match within that larger assembled string, not just the raw user message.

---

## No caching

Every call to `formatTime` creates a new `Date` object via `new Date()`. There is no memoization or caching across invocations. Each prompt injection and each tool call reflects the clock time at that exact moment.
