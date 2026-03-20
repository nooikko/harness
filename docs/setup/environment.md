# Environment Setup

Everything you need to go from a fresh clone to a running development environment.

---

## Prerequisites

| Tool | Required version | Install |
|------|-----------------|---------|
| Node.js | >= 22 | [nodejs.org](https://nodejs.org) or via `fnm`/`nvm` |
| pnpm | 10.x (exact version pinned) | `corepack enable && corepack use pnpm@10` |
| PostgreSQL | 17 (via Docker, see below) | [docker.com](https://docker.com) |
| Docker | Any recent version | Required for PostgreSQL + Qdrant + Loki + integration tests |
| Python 3 | Any 3.x | Used by the pre-commit coverage gate script |

pnpm's exact version is pinned in `package.json` under `"packageManager"`. Running `corepack enable` will automatically install and use the correct version.

---

## First-Time Setup

### 1. Install dependencies

```bash
pnpm install
```

This installs all workspace packages and runs `husky` to wire up git hooks.

### 2. Copy environment files

```bash
cp .env.example .env
cp packages/database/.env.example packages/database/.env
```

Both files need a valid `DATABASE_URL`. The default value matches the Docker Compose configuration below — no changes needed if you use Docker.

### 3. Start Docker services

```bash
docker compose up -d
```

This starts the following containers:

| Container | Port | Purpose |
|-----------|------|---------|
| `harness-postgres` | 5432 | PostgreSQL 17 database (user: `user`, password: `password`, db: `harness`) |
| `harness-qdrant` | 6333, 6334 | Qdrant vector database for semantic search (optional — search degrades to FTS-only without it) |
| `harness-loki` | 3100 | Loki log aggregation (optional — used by the logs plugin) |
| `harness-grafana` | 3200 | Grafana dashboard for log visualization (optional — depends on Loki) |

Data is persisted in named Docker volumes (`harness-pgdata`, `harness-qdrant`, `harness-loki`, `harness-grafana`) so it survives container restarts.

### 4. Generate the Prisma client

```bash
pnpm db:generate
```

This generates the TypeScript client from `packages/database/prisma/schema.prisma`. Run this again any time the schema changes.

### 5. Push the schema to the database

```bash
pnpm db:push
```

Applies the Prisma schema to the running database. For local development this is sufficient — it does not create migration files.

To generate migration files (required before deploying schema changes to production):

```bash
pnpm --filter database db:migrate
```

### 6. Set the encryption key

The plugin settings system encrypts secrets at rest using AES-256-GCM. Generate a key and add it to `.env`:

```bash
openssl rand -hex 32
```

Set the output as `HARNESS_ENCRYPTION_KEY` in `.env`. Without this key the app will start but saving secret plugin settings will fail.

### 7. Start the development servers

```bash
pnpm dev
```

Starts all packages in watch mode via Turborepo:

| Service | URL |
|---------|-----|
| Web dashboard | http://localhost:4000 |
| Orchestrator HTTP | http://localhost:4001 |
| Orchestrator health | http://localhost:4002/health |
| Orchestrator WebSocket | ws://localhost:4001/ws |

---

## Environment Variables Reference

### Root `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/harness?schema=public` | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:4000` | Public URL for the web dashboard |
| `PORT` | `4001` | Orchestrator HTTP port |
| `HEALTH_PORT` | `4002` | Orchestrator health check port |
| `ORCHESTRATOR_URL` | `http://localhost:4001` | Dashboard → orchestrator HTTP URL (server-side) |
| `NEXT_PUBLIC_ORCHESTRATOR_WS_URL` | `ws://localhost:4001/ws` | Dashboard → orchestrator WebSocket URL (browser) |
| `HARNESS_ENCRYPTION_KEY` | *(empty)* | 64-char hex key for AES-256-GCM secret encryption |
| `CLAUDE_MODEL_DEFAULT` | `sonnet` | Default Claude model (`sonnet`, `opus`, `haiku`) |
| `LOG_LEVEL` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant vector database URL (optional — search degrades to FTS-only without it) |
| `UPLOAD_DIR` | `./uploads` | Directory for file upload storage |
| `MAX_FILE_SIZE_MB` | `10` | Maximum file upload size in megabytes |
| `LOG_FILE` | *(empty)* | Path for rotating file-based logs (pino-roll). Used by the logs plugin. |
| `LOKI_URL` | `http://localhost:3100` | Loki log aggregation URL (pino-loki). Used by the logs plugin. |
| `MICROSOFT_CLIENT_ID` | *(empty)* | Azure App Registration client ID (for Outlook + Calendar plugins) |
| `MICROSOFT_CLIENT_SECRET` | *(empty)* | Azure App Registration client secret |
| `MICROSOFT_TENANT_ID` | `consumers` | Azure tenant ID (`consumers` for personal accounts) |
| `MICROSOFT_REDIRECT_URI` | `http://localhost:4000/api/oauth/callback` | OAuth callback URL for Microsoft Graph |
| `OAUTH_ENCRYPTION_KEY` | *(empty)* | 64-char hex key for encrypting stored OAuth tokens |

### `packages/database/.env`

Only `DATABASE_URL` is needed. It must match the value in the root `.env`.

---

## Database Management

```bash
pnpm db:generate    # Re-generate Prisma client after schema changes
pnpm db:push        # Apply schema to local database (no migration files)
pnpm db:studio      # Open Prisma Studio GUI at http://localhost:5555
pnpm --filter database db:migrate  # Create migration files for schema changes
```

Schema lives at `packages/database/prisma/schema.prisma`.

### Resetting the local database

To wipe all data and start fresh:

```bash
# Option 1: Destroy and recreate the Docker volume
docker compose down -v && docker compose up -d
pnpm db:push

# Option 2: Truncate all tables (keeps the volume, faster)
# Connect via psql or Prisma Studio and run the truncate from
# tests/integration/setup/reset-db.ts
```

---

## Plugin Settings

Plugin settings that are marked as secrets in their schema are encrypted at rest. The `HARNESS_ENCRYPTION_KEY` in `.env` is required for this to work.

To configure plugin settings after startup:

1. Navigate to http://localhost:4000/admin/plugins
2. Click the plugin name
3. Fill in the settings form and save

Saved settings take effect after reloading the plugin via the admin UI or restarting the orchestrator.

---

## Production Deployment (PM2)

The project ships with a PM2 ecosystem config for running both services as managed processes.

### Setup

```bash
# Build all packages
pnpm build

# Install PM2 globally if not already installed
npm install -g pm2

# Start both services
pm2 start ecosystem.config.cjs

# Save process list for restart on reboot
pm2 save
pm2 startup
```

### Useful PM2 commands

```bash
pm2 status                    # List running processes
pm2 logs harness-orchestrator # Tail orchestrator logs
pm2 logs harness-dashboard    # Tail dashboard logs
pm2 restart harness-orchestrator
pm2 stop all
```

Logs are written to `logs/orchestrator-out.log`, `logs/orchestrator-error.log`, `logs/dashboard-out.log`, and `logs/dashboard-error.log`. Install `pm2-logrotate` to manage log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

---

## Common Issues

### `@prisma/client did not initialize yet`

Run `pnpm db:generate`. The Prisma client must be generated before any package that imports it can compile.

### `Cannot find module 'database'` or similar workspace import errors

Run `pnpm install` to ensure all workspace symlinks are in place.

### Pre-commit hook fails on first commit

The coverage gate requires Python 3. Check `python3 --version`. If Python 3 is missing, install it via your system package manager.

### `HARNESS_ENCRYPTION_KEY` missing warning

Generate a key with `openssl rand -hex 32` and set it in `.env`. The orchestrator will start without it but secret plugin settings will not save.

### Port already in use

The dev servers use ports 4000–4002. Check for conflicting processes:

```bash
lsof -i :4000
lsof -i :4001
```
