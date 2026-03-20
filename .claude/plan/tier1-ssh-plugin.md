# Plan: SSH / Remote Execution Plugin

## What
Plugin at `packages/plugins/ssh/` that lets agents run commands on registered homelab hosts via SSH.

## Why First
Everything in the self-managing loop depends on agents reaching remote servers. Without SSH, no staged deployment, no service management, no infrastructure control.

## Current State
Nothing exists. Clean slate.

---

## Architectural Decisions (resolved by adversarial review)

### AD-1: Connection Pool Model
**Decision:** Per-host connection pool. One persistent connection per SshHost, reused across threads.

- `Map<hostId, { client: ssh2.Client, lastUsed: Date }>` managed by `connection-pool.ts` helper
- Lazy initialization: connection created on first tool call, not on plugin start
- TTL: 5 minutes of inactivity → graceful close
- Sweep: every 60 seconds (same pattern as Playwright's page sweep)
- Max connections: one per host (ssh2 multiplexes channels over a single connection)
- Concurrent commands: ssh2 supports multiple concurrent `exec()` channels on one connection
- `start()`: no-op (lazy connections)
- `stop()`: close all connections, clear map
- On `client.on('error')` or `client.on('close')`: evict from pool, reconnect on next use
- Keep-alive: `keepaliveInterval: 10_000, keepaliveCountMax: 3` in connect config

### AD-2: Timeout Enforcement
**Decision:** `setTimeout` + `stream.signal('KILL')` + `stream.close()` for per-command timeout.

```typescript
const timer = setTimeout(() => {
  stream.signal('KILL');  // SIGKILL remote process
  stream.close();         // close SSH channel
}, timeoutMs);
stream.on('close', () => clearTimeout(timer));
```

- Default: 30 seconds (plugin setting)
- Per-tool-call override via `timeout` parameter
- Max: 300 seconds (5 min, matches Claude SDK timeout)
- On timeout: return `"Command timed out after ${timeout}s. Partial output:\n${stdout}"` — include whatever output was captured
- `readyTimeout: 10_000` on connection (10s handshake timeout, separate from command timeout)

### AD-3: Host Key Verification
**Decision:** Optional for Phase 1 — auto-discover fingerprint, store for future verification.

- On first connection to a new host: accept the host key, store fingerprint in `SshHost.fingerprint`
- On subsequent connections: if `fingerprint` field is set, verify via `hostVerifier` callback
- If mismatch: reject connection, return error "Host key changed — possible MITM. Update fingerprint in admin UI to accept new key."
- Trust-on-first-use (TOFU) model — acceptable for single-operator homelab

### AD-4: Output Encoding
**Decision:** All output is UTF-8 sanitized before returning to Claude.

- `Buffer.toString('utf8')` handles most cases
- Replace remaining non-UTF-8 bytes with U+FFFD
- Truncate to `maxOutputLength` (default 50KB) setting
- On truncation: append `"\n\n[Output truncated at ${maxOutputLength} bytes. Full output logged.]"`

### AD-5: Interactive Commands
**Decision:** Not supported. Documented limitation.

- All commands run non-interactively (no PTY allocation by default)
- Commands that expect stdin input will hang until timeout, then get killed
- Tool description includes: "Commands must be non-interactive. Use `sudo -n` for passwordless sudo."
- Consider `{ pty: true }` option in Phase 3 for specific use cases (e.g., sudo with NOPASSWD still needs TTY sometimes)

### AD-6: Encryption Key Validation
**Decision:** Check `HARNESS_ENCRYPTION_KEY` in `register()`, report degraded status if missing.

- `register()`: check if key exists. If not, `ctx.reportStatus('degraded', 'HARNESS_ENCRYPTION_KEY not set — cannot store SSH keys securely')`
- Plugin still starts (list_hosts works, but connections requiring stored keys will fail)
- Admin UI: show warning banner if encryption key not configured

---

## Design

### Host Registry (not hardcoded)
New Prisma model:
```prisma
model SshHost {
  id          String   @id @default(cuid())
  name        String   @unique    // "media-server-1", "desktop-quinn"
  hostname    String              // IP or FQDN
  port        Int      @default(22)
  username    String
  authMethod  String   @default("key") // "key" or "password"
  privateKey  String?  @db.Text   // PEM-encoded, encrypted at rest via HARNESS_ENCRYPTION_KEY
  fingerprint String?             // Host key fingerprint (TOFU — set on first connection)
  tags        String[]            // ["media", "docker", "portainer"] for grouping
  enabled     Boolean  @default(true)
  lastSeenAt  DateTime?           // Updated on successful connection
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  commandLogs SshCommandLog[]
}

model SshCommandLog {
  id        String   @id @default(cuid())
  hostId    String
  host      SshHost  @relation(fields: [hostId], references: [id], onDelete: Cascade)
  command   String   @db.Text
  exitCode  Int?
  stdout    String?  @db.Text   // first 500 chars
  stderr    String?  @db.Text   // first 500 chars
  duration  Int?                // milliseconds
  threadId  String?
  agentId   String?
  createdAt DateTime @default(now())

  @@index([hostId, createdAt])
  @@index([threadId])
}
```

### Admin UI
Route: `/admin/ssh-hosts` — follows the same pattern as `/admin/cron-jobs`.

**List page:**
- Table of registered hosts with name, hostname, port, username, status (last seen), enabled toggle
- "Add Host" button opens modal form
- Edit/delete actions per row

**Host form (modal):**
- Name (required, unique)
- Hostname (required — IP or FQDN, validated: no spaces, no scheme prefix)
- Port (required, default 22, validated: 1-65535)
- Username (required)
- Auth method: radio (Key / Password)
- If Key: textarea for private key PEM, or "Generate Key Pair" button
  - Generate: server action creates ed25519 key pair, stores private key, displays public key for user to copy
- If Password: password input (stored encrypted)
- Tags (comma-separated input → String[])
- Enabled toggle

**Test Connection button:**
- Calls `POST /api/plugins/ssh/test-connection` with `{ hostId }`
- Plugin attempts SSH handshake (10s timeout)
- Returns: `{ success: boolean, fingerprint?: string, error?: string }`
- On success: updates `lastSeenAt` and auto-stores fingerprint (TOFU)
- On failure: shows error message with guidance (auth failure, network error, etc.)

**MCP tools for agent self-management:**
- `ssh__add_host` — create a host record (agent can register new hosts)
- `ssh__remove_host` — delete a host record
- `ssh__test_connection` — test connectivity to a host

### MCP Tools (exposed to agents)
| Tool | Phase | Purpose |
|------|-------|---------|
| `ssh__exec` | 1 | Run a command on a named host. Returns stdout/stderr + exit code. Timeout enforced. |
| `ssh__list_hosts` | 1 | List registered hosts with status, tags, last seen. |
| `ssh__add_host` | 1 | Register a new SSH host (agent self-management). |
| `ssh__remove_host` | 1 | Remove an SSH host. |
| `ssh__test_connection` | 1 | Test connectivity to a host. Returns success/error + fingerprint. |
| `ssh__upload_file` | 3 | SFTP upload to a remote host (ssh2 SFTP, not SCP). |
| `ssh__download_file` | 3 | SFTP download from a remote host. |
| `ssh__service_status` | 3 | Run `systemctl status <service>` (convenience wrapper). |
| `ssh__deploy` | 3 | Higher-level: git pull + build + restart (for Harness self-deploy). |

### Safety Model
- **Audit logging:** All `ssh__exec` calls logged to `SshCommandLog` (host, command, output snippet, exit code, duration, thread, agent)
- **Timeout enforcement:** Per-command timeout with SIGKILL on expiry (AD-2)
- **No command blocking:** Single-user homelab — audit trail over allowlists. Revisit when agent isolation is implemented.
- **No interactive commands:** Documented limitation (AD-5)
- **Output sanitization:** UTF-8 only, truncated (AD-4)

### Library
`ssh2` v1.17.0 + `@types/ssh2` for TypeScript.

Key facts from research:
- No built-in connection pooling (we implement our own)
- No built-in command timeout (we implement with setTimeout + stream.signal)
- `exec()` returns separate stdout/stderr streams
- SFTP subsystem for file transfers (not SCP — ssh2 has no SCP API)
- Supports all key formats: OpenSSH, PEM/PKCS#8, ed25519, RSA, ECDSA
- Keep-alive via `keepaliveInterval` + `keepaliveCountMax` in connect config
- Key pair generation via `ssh2.utils.generateKeyPair('ed25519')`

### Plugin Settings
```
defaultTimeout: number (30)          // command timeout in seconds
maxOutputLength: number (50000)      // truncate output at this many bytes
logCommands: boolean (true)          // write to SshCommandLog
```

---

## File Structure

```
packages/plugins/ssh/
  package.json                         @harness/plugin-ssh
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                           PluginDefinition + tool definitions
    _helpers/
      connection-pool.ts               Per-host connection management (Map, TTL, sweep, reconnect)
      execute-command.ts               ssh2 exec wrapper (timeout, output capture, UTF-8 sanitize)
      resolve-host.ts                  Look up SshHost by name or ID, decrypt key
      encrypt-key.ts                   AES-256-GCM encrypt/decrypt for private keys
      test-connection.ts               SSH handshake test + fingerprint capture
      generate-key-pair.ts             ed25519 key pair generation via ssh2.utils
      settings-schema.ts               Plugin settings definition
      __tests__/
        connection-pool.test.ts
        execute-command.test.ts
        resolve-host.test.ts
        encrypt-key.test.ts
        test-connection.test.ts
        generate-key-pair.test.ts
    __tests__/
      index.test.ts                    Plugin registration + tool handler tests

apps/web/src/app/admin/ssh-hosts/
  page.tsx                             List page (server component)
  _actions/
    create-ssh-host.ts
    update-ssh-host.ts
    delete-ssh-host.ts
    list-ssh-hosts.ts
    test-ssh-connection.ts
    generate-ssh-key.ts
  _components/
    ssh-host-form.tsx                  Create/edit modal form
    ssh-host-table.tsx                 List table with actions
    test-connection-button.tsx         Async test with loading state
```

---

## Implementation Phases

### Phase 1: Core Plugin + Tools + Admin UI
Everything needed for agents to run commands on registered hosts.

1. **Schema:** Add `SshHost` + `SshCommandLog` models to Prisma schema
2. **Plugin scaffold:** `packages/plugins/ssh/` with package.json, tsconfig, vitest config
3. **Helpers:**
   - `connection-pool.ts` — Map<hostId, Client>, TTL sweep, keep-alive, reconnect
   - `execute-command.ts` — ssh2 exec with timeout, output capture, UTF-8 sanitize, truncation
   - `resolve-host.ts` — DB lookup + key decryption
   - `encrypt-key.ts` — AES-256-GCM using HARNESS_ENCRYPTION_KEY
   - `test-connection.ts` — handshake test + fingerprint TOFU
   - `generate-key-pair.ts` — ed25519 via ssh2.utils
   - `settings-schema.ts` — defaultTimeout, maxOutputLength, logCommands
4. **Tools:** `ssh__exec`, `ssh__list_hosts`, `ssh__add_host`, `ssh__remove_host`, `ssh__test_connection`
5. **Register plugin** in `apps/orchestrator/src/plugin-registry/index.ts`
6. **Admin UI:** `/admin/ssh-hosts` with CRUD + test connection + key generation
7. **Tests:** ~60-80 tests covering tools, helpers, connection pool, encryption

### Phase 2: Polish + Observability
- Command log viewer in admin UI (`/admin/ssh-hosts/{id}/logs`)
- Host status dashboard (uptime, last command, error rate)
- Improve error messages for common failures (auth, network, firewall)

### Phase 3: Higher-level tools
- `ssh__upload_file`, `ssh__download_file` (SFTP via ssh2, not SCP)
- `ssh__service_status` (systemctl wrapper)
- `ssh__deploy` (Harness-specific: git pull → install → build → PM2 restart → health check)
- **tmux session persistence for deploy:** Long-running deploy commands (build can take minutes) are vulnerable to SSH connection drops. Wrap deploy sequences in `tmux new-session -d -s harness-deploy '...'`, then poll for completion via `tmux has-session` + `tmux capture-pane` to read output. If the SSH connection drops mid-deploy, reconnect and check tmux session status instead of losing track of server state. Adds `tmux` as a remote host prerequisite for deploy operations.

---

## Dependencies
- `ssh2` + `@types/ssh2` npm packages
- Prisma schema changes (SshHost, SshCommandLog models)
- Plugin registry update
- `HARNESS_ENCRYPTION_KEY` env var (existing, used by plugin settings)

## Risks (post-review)

| Risk | Severity | Mitigation |
|------|----------|------------|
| SSH connection hangs (network partition) | High | TCP keepalive (10s interval, 3 max) + command timeout + SIGKILL |
| Interactive command hangs | Medium | No PTY, documented limitation, timeout kills after 30s |
| Binary output corrupts tool response | Medium | UTF-8 sanitization + truncation |
| HARNESS_ENCRYPTION_KEY not set | Low | Degraded status report, admin UI warning |
| Host key MITM on first connection | Low | TOFU model — acceptable for homelab, warn on key change |
| ssh2 connection drops silently | Medium | Evict from pool on error/close, reconnect on next use |
| Large output exceeds MCP response limits | Medium | Truncate at 50KB, log full output to SshCommandLog |

## Known Limitations (Phase 1)
- No interactive command support (no PTY) — use `sudo -n`, `NOPASSWD`, or pre-configured automation users
- No SSH agent forwarding
- No SSH tunneling / port forwarding
- No SCP/SFTP file transfer (Phase 3)
- No per-host command allowlists (defer to agent isolation hardening)
- TOFU host key verification (not strict verification)
