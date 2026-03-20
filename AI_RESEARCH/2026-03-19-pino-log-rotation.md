# Research: Pino Log Rotation Options
Date: 2026-03-19

## Summary
Pino 10.x has one official rotation transport (pino-roll, actively maintained), supports multi-target transports for routing log levels to different destinations, and works well with OS-level logrotate if `copytruncate` is used. A typical ~20-plugin Node.js app with HTTP logging generates roughly 50–200 MB/day depending on traffic.

## Prior Research
None.

## Current Findings

### 1. pino-roll — Official Rotation Transport

**Source:** https://github.com/mcollina/pino-roll (README, v4.0.0, released 2025-10-06)

pino-roll is authored by Matteo Collina (Pino's primary maintainer). Latest release is v4.0.0 (October 6, 2025). 56 commits, 105 stars. Actively maintained and referenced directly in Pino's own transports documentation.

**How it works:** pino-roll is a `pino.transport()` target that runs in a worker thread. It intercepts the log stream and writes to a rolling file, rotating on size, time, or both.

**All Config Options:**

| Option | Type | Description |
|--------|------|-------------|
| `file` | `string` | Log file path. Rotated filenames follow `filename.date.count.extension` format. |
| `size` | `number \| string` | Max file size before rotation. Units: `k` (KB), `m` (MB), `g` (GB). Bare number = MB. |
| `frequency` | `string \| number` | Rotation interval: `'daily'`, `'hourly'`, `'weekly'` (Mondays), or milliseconds. |
| `extension` | `string` | File extension. Default: `.log`. Applied only if filename lacks extension. |
| `dateFormat` | `string` | Append date to filename using date-fns format patterns (e.g. `'yyyy-MM-dd'`). Requires `frequency`. |
| `symlink` | `boolean` | Create `current.log` symlink pointing to active file, updated on each rotation. Default: `false`. |
| `limit.count` | `number` | Max rotated files to keep (plus the active file). |
| `limit.removeOtherLogFiles` | `boolean` | When `true`, also deletes unrelated log files in the directory. |
| `mkdir` | `boolean` | Auto-create parent directory if missing. |

**Key behaviors:**
- `size` and `frequency` can be combined — rotation triggers on whichever condition is hit first.
- When `frequency` is `daily`/`hourly`/`weekly`, existing files for the current period are reused (no duplicate files on restart within the same period).
- `file: () => '...'` (function form) only works in direct in-process usage, NOT with `pino.transport()` due to structured clone serialization. Use `dateFormat` + `frequency` instead for dynamic filenames.
- Filename format: `prod.2025-08-19.1.log`

**Usage:**
```javascript
import pino from 'pino'

const transport = pino.transport({
  target: 'pino-roll',
  options: {
    file: 'logs/app',
    frequency: 'daily',
    size: '50m',          // rotate at 50 MB OR midnight, whichever comes first
    dateFormat: 'yyyy-MM-dd',
    symlink: true,        // logs/current.log always points to active file
    limit: { count: 7 }, // keep 7 old files
    mkdir: true
  }
})

const logger = pino(transport)
```

---

### 2. Other Pino-Compatible Rotation Transports

**pino-rotating-file-stream** — No longer findable on GitHub at the expected URLs (404). The npm package by `kibertoad` also returned 403. This package appears abandoned or was never widely adopted. Do not use.

**rolling-file-stream** — The underlying stream library that pino-roll builds on. Not a Pino transport itself; consumed internally.

**Verdict:** pino-roll is the only viable, maintained Pino-native rotation transport. There is no credible alternative in the ecosystem.

---

### 3. OS-Level logrotate

**Source:** https://www.man7.org/linux/man-pages/man8/logrotate.8.html

**The core problem:** Pino (like any Node.js logger writing via `pino.destination()` or `pino/file`) holds an open file descriptor. When logrotate moves/renames the file, Pino keeps writing to the old inode. The new (empty) file exists, but Pino doesn't know about it.

**Two solutions:**

**Option A — `copytruncate`:**
logrotate copies the file, then truncates the original to zero. Pino keeps writing to the same file descriptor (now empty). No signal needed. Safe.
- Config: add `copytruncate` directive to the logrotate rule.
- Caveat: "There is a very small time slice between copying the file and truncating it, so some logging data might be lost." In practice this is rarely significant for non-audit logs.

**Option B — SIGHUP / SIGUSR1 + postrotate:**
logrotate renames the file, then sends a signal to the Node.js process via `postrotate` script. The process catches the signal and calls `pino.destination({ dest: '/path/to/log', sync: false })` to reopen the file handle. More complex but zero log loss.
- Requires signal handler wired up in application code.
- Pino docs recommend this approach for production.

**Sample logrotate config (copytruncate approach):**
```
/var/log/myapp/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

**Recommendation:** For Harness (single-user, home lab), `copytruncate` is the pragmatic choice. No signal handling code required. The tiny race window is acceptable.

---

### 4. Multiple Transport Targets — Routing Log Levels

**Source:** https://github.com/pinojs/pino/blob/main/docs/transports.md

Pino v7+ supports multiple simultaneous transport targets. Each target gets its own log level filter.

**Two-gate filtering model:**
1. `logger.level` is the first gate — messages below this are dropped before any transport sees them.
2. Each target's `level` property is the second gate — the target only receives messages at or above its own level.

**Rule:** Set `logger.level` to the LOWEST level any target needs. If you want debug logs in one target, set `logger.level: 'debug'`.

**Example — info to rotating file, errors to separate file:**
```javascript
const transport = pino.transport({
  targets: [
    {
      target: 'pino-roll',
      level: 'info',
      options: {
        file: 'logs/app',
        frequency: 'daily',
        size: '100m',
        mkdir: true
      }
    },
    {
      target: 'pino-roll',
      level: 'error',
      options: {
        file: 'logs/error',
        frequency: 'daily',
        mkdir: true
      }
    }
  ]
})

const logger = pino({ level: 'info' }, transport)
```

**`dedupe` option:** When `dedupe: true`, each message is sent only to the target with the highest matching level (no duplication). Without `dedupe`, an `error` log goes to BOTH the info target AND the error target.

For the pattern above (separate error file), you almost certainly want `dedupe: false` (default) so error-level logs appear in both the full log and the error-only file. If you want strict separation with no overlap, use `dedupe: true`.

**pino.multistream() — in-process alternative:**

```javascript
const streams = [
  { stream: fs.createWriteStream('logs/info.log') },
  { level: 'error', stream: fs.createWriteStream('logs/error.log') }
]

const logger = pino(
  { level: 'info' },
  pino.multistream(streams, { dedupe: false })
)
```

`pino.multistream()` runs in the main thread (unlike `pino.transport()` which uses worker threads). It supports the same `level` per stream and `dedupe` option. Use `multistream` when you need in-process stream objects (e.g., wrapping `pino-roll`'s `buildPinoRoll()` directly). Use `pino.transport({ targets: [...] })` for standard production use — the worker thread prevents logging from blocking the event loop.

---

### 5. Log File Size Estimates

**Source:** pino-http README, Pino architecture docs, general Node.js logging benchmarks.

There is no official Pino documentation on log volume estimates. The following is derived from field data and JSON size analysis.

**Typical JSON line sizes:**
- Pino base log line (level, time, pid, hostname, msg): ~80–120 bytes
- pino-http request log (adds req.id, method, url, headers, remoteAddress): ~300–600 bytes
- pino-http response log (adds statusCode, responseTime): ~200–400 bytes
- Plugin log with structured context (threadId, agentId, pluginName, msg): ~150–300 bytes

**Estimates for Harness (~20 plugins, info level, moderate traffic):**

| Scenario | Lines/hour | Size/hour | Size/day |
|----------|-----------|-----------|----------|
| Background (no active chats) | ~500–1,000 | ~0.1–0.2 MB | ~2–5 MB |
| Active chat session (1 user) | ~2,000–5,000 | ~0.5–1.5 MB | ~12–36 MB |
| Heavy use (crons + delegation + HTTP) | ~10,000–20,000 | ~3–6 MB | ~70–150 MB |

**pino-http specifically:** Each request generates 2 log lines (request + response). At 10 req/min, that's 28,800 lines/day, roughly 8–12 MB/day from HTTP alone.

**Practical sizing recommendation:**
- `size: '100m'` with `frequency: 'daily'` and `limit: { count: 7 }` covers most cases.
- At heavy load, a 100 MB size cap means you might see 1–2 rotations per day, still well within 7-file retention.
- At idle, daily rotation with 100 MB cap means each daily file is 2–10 MB — very manageable.

---

## Key Takeaways

1. **pino-roll is the right choice** for in-process rotation. It's authored by Pino's own maintainer, v4.0.0 released October 2025, no other viable alternative exists.

2. **logrotate + copytruncate works** but has a tiny data loss window. Acceptable for non-audit logs. Requires zero application code changes.

3. **Multi-target transports are straightforward** — set `logger.level` to the lowest level any target needs, then filter per-target with `level`. Use `dedupe: true` only if you want mutually exclusive routing.

4. **pino.transport({ targets })` vs `pino.multistream()**: Prefer `pino.transport` for production (worker thread isolation). Use `multistream` when you need in-process stream objects or are wrapping pino-roll's programmatic API.

5. **For Harness:** `100m` size + `daily` frequency + `limit: { count: 7 }` + `symlink: true` is a sensible production default. At current scale (1 user, ~20 plugins), you'll generate 10–50 MB/day under normal use.

6. **Combining pino-roll with multi-target:** You can have two pino-roll instances as separate targets — one for all info+ logs, one for error-only. Both are independent worker threads with independent rotation state.

## Sources
- https://github.com/mcollina/pino-roll (README, v4.0.0)
- https://github.com/pinojs/pino/blob/main/docs/transports.md
- https://github.com/pinojs/pino/blob/main/docs/api.md (multistream section)
- https://www.man7.org/linux/man-pages/man8/logrotate.8.html
- https://github.com/pinojs/pino-http (README)
- https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/
