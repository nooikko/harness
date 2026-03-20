# Research: ssh2 npm Package for Node.js SSH Plugin

Date: 2026-03-19

## Summary

The `ssh2` package (v1.17.0) by mscdex is the dominant SSH client/server library for Node.js. It has no bundled TypeScript types (`types` field absent from package.json) but `@types/ssh2` exists on DefinitelyTyped and covers the full API. The library supports key-based auth with multiple key formats, SFTP for file transfers, pseudo-TTY for interactive commands, and SSH-level keepalive. It does NOT have built-in connection pooling or command-level timeouts — both must be implemented by the consumer.

## Prior Research

None — first research on this topic.

## Current Findings

### 1. Connection API — Key-Based Auth

Current version: **1.17.0** (as of 2026-03-19).

`ConnectConfig` options (passed to `client.connect()`):

```typescript
client.connect({
  host: 'example.com',
  port: 22,
  username: 'user',
  privateKey: fs.readFileSync('/path/to/key'),  // Buffer or string
  passphrase: 'optional-passphrase',             // For encrypted keys
  readyTimeout: 20000,                           // Handshake timeout (ms), default 20000
  keepaliveInterval: 10000,                      // Send keepalive every N ms (0 = disabled)
  keepaliveCountMax: 3,                          // Max unanswered keepalives before disconnect
  algorithms: { ... },                           // Override cipher/key/hmac algorithms
  hostVerifier: (key) => boolean,                // Host key verification callback
  authHandler: [...],                            // Custom auth strategy chain
  agent: process.env.SSH_AUTH_SOCK,              // SSH agent socket path
  debug: (msg) => console.log(msg),             // Debug logging function
});
```

Connection lifecycle events:
```typescript
client
  .on('ready', () => { /* auth succeeded */ })
  .on('error', (err) => { /* connection/auth error */ })
  .on('end', () => { /* server sent EOF */ })
  .on('close', () => { /* socket closed */ })
  .connect({ ... });
```

### 2. exec() API

```typescript
// Method signature
conn.exec(command: string, callback: (err, stream) => void): void;
conn.exec(command: string, options: ExecOptions, callback: (err, stream) => void): void;
```

`ExecOptions`:
- `env`: `{ [key: string]: string }` — environment variables for the command
- `pty`: `boolean | PseudoTtyOptions` — allocate a pseudo-TTY (needed for sudo and interactive cmds)
- `x11`: `boolean | X11Options` — X11 forwarding

stdout/stderr handling:
```typescript
conn.exec('ls -la', (err, stream) => {
  if (err) throw err;

  let stdout = '';
  let stderr = '';

  stream
    .on('close', (code, signal) => {
      console.log('exit code:', code);
      conn.end();
    })
    .on('data', (data) => {
      stdout += data.toString();      // stdout is the stream itself
    });

  stream.stderr.on('data', (data) => {
    stderr += data.toString();        // stderr is stream.stderr
  });
});
```

Key insight: The stream IS stdout. `stream.stderr` is a separate sub-stream.

### 3. Output Handling — Streaming vs Buffered

**Streaming (real-time):** Use `data` events directly on the stream. Each `data` event fires as output arrives.

**Buffered (collect all then process):**
```typescript
const chunks: Buffer[] = [];
stream.on('data', (chunk) => chunks.push(chunk));
stream.on('close', (code) => {
  const output = Buffer.concat(chunks).toString();
  // all output available here
});
```

There is no built-in `output` property — you must accumulate manually.

### 4. Timeout Support

**What ssh2 provides:**
- `readyTimeout` (connect-level): How long to wait for the SSH handshake. Default: 20000ms.
- `keepaliveInterval` + `keepaliveCountMax` (connection-level): Detect dead connections.

**What ssh2 does NOT provide:**
- Command-level timeouts for `exec()`. No `timeout` option exists on `exec()`.

**Consumer must implement command-level timeouts:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  stream.signal('KILL');   // Send SIGKILL to remote process
  stream.close();
  controller.abort();
}, 30_000);

stream.on('close', () => clearTimeout(timeoutId));
```

Alternatively, wrap in a Promise with `Promise.race()` against a timeout promise.

### 5. SFTP API

Access via `conn.sftp()` callback — SFTP is its own subsystem:

```typescript
conn.sftp((err, sftp) => {
  // Upload (local → remote) — parallel writes, fast
  sftp.fastPut(localPath, remotePath, options?, callback);
  // options: { concurrency: 64, chunkSize: 32768, step: fn, mode: number }

  // Download (remote → local) — parallel reads, fast
  sftp.fastGet(remotePath, localPath, options?, callback);
  // options: { concurrency: 64, chunkSize: 32768, step: fn }

  // Streaming write (for Buffer/stream → remote)
  const writeStream = sftp.createWriteStream(remotePath, options?);
  // options: { flags: 'w', encoding: null, mode: 0o666, autoClose: true }

  // Streaming read (for remote → Buffer/stream)
  const readStream = sftp.createReadStream(remotePath, options?);
  // options: { flags: 'r', encoding: null, handle: null, mode: 0o666, autoClose: true, start?, end? }

  // Other operations
  sftp.readdir(path, callback);   // List directory
  sftp.mkdir(path, callback);
  sftp.rmdir(path, callback);
  sftp.stat(path, callback);      // File metadata
  sftp.chmod(path, mode, callback);
  sftp.rename(srcPath, dstPath, callback);
  sftp.unlink(path, callback);
});
```

**SFTP vs SCP:**
- Use **SFTP** — it is far more capable and the recommended approach. SCP is legacy and ssh2 does not expose a raw SCP API.
- `fastPut`/`fastGet` are the preferred methods for whole-file transfers (parallelized).
- `createWriteStream`/`createReadStream` are preferred when you have an in-memory buffer or Node.js stream.

### 6. Connection Pooling

ssh2 has **no built-in connection pooling**. Connections are managed entirely by the consumer.

For a plugin, you have three options:
1. **One connection per command (simplest):** Create, execute, destroy. High overhead.
2. **Persistent single connection:** Keep one `Client` alive, reuse across commands. Must handle reconnection on drop.
3. **Consumer-built pool:** Maintain a Map of `host → Client[]`, round-robin. Complex but performant.

For a plugin context, option 2 (persistent single connection with reconnect logic) is the typical approach. The keepalive options help detect dead connections before you try to use them.

### 7. Error Handling

The `error` event on the `Client` is the primary error surface:

```typescript
client.on('error', (err: Error & { level?: string; description?: string }) => {
  // err.level:
  //   'client-socket' — TCP-level error (ECONNREFUSED, ETIMEDOUT, etc.)
  //   'client-ssh'    — SSH protocol error (auth failure, handshake error)
  // err.message — human-readable message
  // err.description — additional SSH disconnect description (if level === 'client-ssh')
});
```

Common error scenarios:
| Error | `level` | `err.message` |
|-------|---------|---------------|
| Connection refused | `client-socket` | `ECONNREFUSED` |
| Host unreachable | `client-socket` | `EHOSTUNREACH` |
| Network timeout | `client-socket` | `ETIMEDOUT` |
| Auth failure | `client-ssh` | `All configured authentication methods failed` |
| Handshake timeout | `client-ssh` | `Timed out while waiting for handshake` |
| Bad host key | `client-ssh` | `Host key verification failed` |

Channel (exec stream) errors are separate:
```typescript
stream.on('error', (err) => { /* channel-level error */ });
```

### 8. Key Formats Supported

ssh2 supports a broad range of key formats:

**Container formats:**
- OpenSSH format (`-----BEGIN OPENSSH PRIVATE KEY-----`) <!-- gitleaks:allow -->
- PEM / PKCS#8 format (`-----BEGIN RSA PRIVATE KEY-----`, `-----BEGIN PRIVATE KEY-----`) <!-- gitleaks:allow -->
- RFC4716 format
- PPK (PuTTY Private Key) format

**Key types:**
- RSA (`ssh-rsa`, `rsa-sha2-256`, `rsa-sha2-512`)
- ECDSA (`ecdsa-sha2-nistp256`, `ecdsa-sha2-nistp384`, `ecdsa-sha2-nistp521`)
- Ed25519 (`ssh-ed25519`) — requires Node.js v12.0.0+
- DSA (`ssh-dss`) — legacy, not recommended

**Passphrase-protected keys:** Pass `passphrase` alongside `privateKey` in `ConnectConfig`.

`privateKey` accepts either a `Buffer` (raw file bytes) or a `string` (key content). Reading with `fs.readFileSync('/path/to/key')` works directly.

### 9. Interactive Commands

ssh2 supports interactive commands via two mechanisms:

**Option A — `pty: true` on exec (for single commands that need a TTY):**
```typescript
conn.exec('sudo apt-get install nginx', { pty: true }, (err, stream) => {
  stream.on('data', (data) => {
    if (data.toString().includes('[sudo] password')) {
      stream.write('mypassword\n');
    }
  });
});
```
This is fragile — parsing prompts from stdout is unreliable.

**Option B — `shell()` for interactive sessions:**
```typescript
conn.shell((err, stream) => {
  stream.write('sudo apt-get install nginx\n');
  stream.on('data', (data) => {
    if (data.toString().includes('password')) {
      stream.write('mypassword\n');
    }
  });
  stream.end('exit\n');
});
```

**Recommendation:** Avoid interactive commands in an automated plugin where possible. Prefer:
- `NOPASSWD` sudo rules for operations that need elevated privileges
- Key-based auth (no password prompts)
- Commands that don't require user interaction

If interactive commands are necessary, `shell()` with prompt detection is more reliable than `exec()` with `pty: true`.

### 10. Keep-Alive

ssh2 supports SSH-level keepalive natively:

```typescript
client.connect({
  keepaliveInterval: 10000,   // Send keepalive every 10 seconds (0 = disabled, default)
  keepaliveCountMax: 3,       // Disconnect after 3 unanswered keepalives (default: 3)
  // ...
});
```

When `keepaliveCountMax` is exceeded, the `error` event fires and the connection is terminated. You should handle reconnection in the `close` or `error` handlers.

### 11. TypeScript Support

**Status:** `@types/ssh2` exists on DefinitelyTyped and covers the full API.

The ssh2 package (v1.17.0) does **not** include bundled TypeScript types (`types` field absent from `package.json`, no `.d.ts` files in `lib/`). The community-maintained types are at DefinitelyTyped.

```bash
npm install ssh2
npm install --save-dev @types/ssh2
```

The `@types/ssh2` definitions include:
- `ConnectConfig` — full connect options interface
- `Client` class with all methods typed
- `ClientChannel` — exec stream type
- `SFTPWrapper` — full SFTP API typed
- `ClientErrorExtensions` — error level/description extensions
- `ExecOptions`, `ShellOptions`, `PseudoTtyOptions`
- `FileEntry`, `Stats`, `InputAttributes` for SFTP operations

---

## Secure SSH Private Key Storage in a Node.js Database

This is the more sensitive design question. The summary: **never store plaintext private keys**. Use envelope encryption.

### Recommended Pattern: AES-256-GCM Envelope Encryption

Store keys encrypted in the database, with the encryption key sourced from environment variables or a secrets manager.

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.SSH_KEY_ENCRYPTION_SECRET!, 'hex'); // 32-byte key

// Encrypt before storing
const encryptPrivateKey = (plaintext: string): string => {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store: iv + authTag + ciphertext, base64-encoded
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

// Decrypt when retrieving for use
const decryptPrivateKey = (stored: string): string => {
  const buf = Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, 16);
  const authTag = buf.subarray(16, 32);
  const ciphertext = buf.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};
```

### Database Schema Approach

```prisma
model SshCredential {
  id                String   @id @default(cuid())
  label             String   // "prod-server-1"
  host              String
  port              Int      @default(22)
  username          String
  encryptedKey      String   @db.Text  // AES-256-GCM encrypted, base64
  keyPassphrase     String?  @db.Text  // encrypted passphrase if key is password-protected
  fingerprint       String?            // SHA-256 of public key, for identification
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### Key Storage Hierarchy (best to worst)

1. **Cloud KMS / HashiCorp Vault** — KEK stored externally, DEK encrypted per-record. Best for production.
2. **Environment variable + AES-256-GCM** — Encryption key in env, ciphertext in DB. Practical for a self-hosted system like Harness.
3. **Filesystem with restricted permissions** — Keys on disk with `chmod 600`, never in DB. Simple but lacks DB-level management.
4. **Plaintext in DB** — Never do this.

### For the Harness Context

Given that Harness is a single-user self-hosted application, the **environment variable + AES-256-GCM** pattern is appropriate:
- `SSH_KEY_ENCRYPTION_SECRET` in `.env` — a 32-byte hex-encoded key (generate with `openssl rand -hex 32`)
- Keys encrypted before `prisma.sshCredential.create()`
- Keys decrypted at use time in the plugin's `connect()` call
- The decrypted key never persists beyond the duration of the connection

### Key Generation (for generating new key pairs)

ssh2 includes `utils.generateKeyPair()` for generating key pairs server-side:
```typescript
import { utils } from 'ssh2';

const { public: publicKey, private: privateKey } = utils.generateKeyPair('ed25519');
// Store privateKey encrypted; store publicKey for the user to add to ~/.ssh/authorized_keys
```

---

## Key Takeaways

1. **Use `@types/ssh2`** — no bundled types in the package itself.
2. **SFTP over SCP** — ssh2 has no raw SCP API; SFTP's `fastPut`/`fastGet` are the way.
3. **No built-in command timeouts** — implement with `stream.signal('KILL')` + `setTimeout`.
4. **No connection pooling** — implement a `Map<host, Client>` with reconnect logic.
5. **Keepalive is easy** — `keepaliveInterval: 10000` in connect config.
6. **All key formats supported** — RSA, Ed25519, ECDSA, PEM, OpenSSH, PPK.
7. **Interactive commands via `shell()`** — `exec()` with `pty: true` works but is fragile.
8. **stderr is `stream.stderr`** — separate sub-stream, not interleaved with stdout.
9. **Store keys encrypted** — AES-256-GCM with env-var KEK is the pragmatic pattern for Harness.
10. **Error level field** — `err.level` is `'client-socket'` (TCP) or `'client-ssh'` (protocol).

## Sources

- npm registry: `https://registry.npmjs.org/ssh2/latest` (v1.17.0 confirmed)
- GitHub README: `https://github.com/mscdex/ssh2` (API documentation)
- GitHub SFTP.md: `https://raw.githubusercontent.com/mscdex/ssh2/master/SFTP.md` (fastPut/fastGet/createReadStream/createWriteStream)
- DefinitelyTyped: `https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/ssh2/index.d.ts` (TypeScript definitions confirmed)
- OWASP Cryptographic Storage Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html`
- Node.js Crypto API: `https://nodejs.org/api/crypto.html`
