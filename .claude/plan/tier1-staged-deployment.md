# Plan: Staged Deployment Flow

## What
Agent can build Harness on a staging server, validate it with Playwright, and promote to production. The key insight: SSH is the transport, not Portainer — because sometimes deployment looks different (Docker, PM2, systemd, etc.) and SSH gives maximum flexibility.

## Why
This is the capstone of Tier 1. Once this works, Harness can build itself: pick up a roadmap item → implement in worktree → deploy to staging → validate with Playwright → show proof to user → promote to production.

## Current State

### What exists
- `deploy/deploy.sh` — single-server deploy script (git pull → build → PM2 restart → health check)
- PM2 ecosystem config (`ecosystem.config.cjs`) for orchestrator + web
- Docker Compose for dev services (Postgres, Qdrant)
- Health check endpoint at `/health` (port 4002)
- No multi-server deployment
- No staging environment concept

### What Quinn runs
- Portainer environment managing Docker containers on homelab
- 3 servers + 2 desktops
- Wants SSH-based deployment (not Portainer API) for flexibility

## Design

### Environment Model
New Prisma model:
```prisma
enum DeploymentStatus { PENDING  BUILDING  TESTING  VALIDATED  PROMOTING  LIVE  FAILED }

model Environment {
  id          String   @id @default(cuid())
  name        String   @unique    // "staging", "production"
  sshHostId   String               // FK to SshHost
  sshHost     SshHost  @relation(fields: [sshHostId], references: [id])
  deployPath  String               // /opt/harness or wherever
  envFile     String?  @db.Text    // .env contents (encrypted)
  webPort     Int      @default(4000)
  orchPort    Int      @default(4001)
  healthPort  Int      @default(4002)
  webUrl      String               // https://staging.local:4000
  isProduction Boolean @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deployments Deployment[]
}

model Deployment {
  id            String           @id @default(cuid())
  environmentId String
  environment   Environment      @relation(fields: [environmentId], references: [id])
  branch        String           // git branch or commit SHA
  status        DeploymentStatus @default(PENDING)
  buildLog      String?          @db.Text
  testLog       String?          @db.Text
  validatedAt   DateTime?
  promotedFrom  String?          // deploymentId this was promoted from
  threadId      String?          // thread where this was initiated
  agentId       String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}
```

### Deployment Flow (agent-driven)

```
1. Agent calls ssh__deploy(host: 'staging', branch: 'feature-x')
   - SSH to staging server
   - cd /opt/harness && git fetch && git checkout feature-x && git pull
   - pnpm install --frozen-lockfile
   - pnpm db:generate && pnpm db:push
   - pnpm build
   - pm2 restart ecosystem.config.cjs
   - Wait for health check (curl localhost:4002/health)
   - Return: build log, success/failure, health status

2. Agent calls playwright__navigate(url: 'https://staging.local:4000')
   - Opens staging instance in headless browser
   - Takes screenshots of key pages
   - Runs through interaction flows (send message, check calendar, etc.)
   - Each screenshot → File attachment in thread

3. Agent presents results to user:
   - "Deployed feature-x to staging. Build succeeded. Here's what it looks like:"
   - [screenshot: home page] [screenshot: chat page] [screenshot: admin page]
   - "Everything loads, no console errors. Want me to promote to production?"

4. User approves → Agent calls ssh__deploy(host: 'production', branch: 'feature-x')
   - Same flow but on production server
   - Final health check
   - "Production updated. Health check passing."
```

### MCP Tools (extension of SSH plugin or new deployment plugin)

| Tool | Purpose |
|------|---------|
| `deploy__to_staging` | Build and deploy a branch to staging environment |
| `deploy__to_production` | Promote a validated staging deployment to production |
| `deploy__status` | Check deployment status (build log, health, current branch) |
| `deploy__rollback` | Revert to previous deployment on an environment |
| `deploy__list_environments` | List configured environments with current state |

### User Approval Gate
The delegation loop already supports multi-iteration validation. For deployment:
- Agent deploys to staging (automatic)
- Agent validates with Playwright (automatic)
- Agent posts results to thread with screenshots (automatic)
- Agent asks user "approve?" and waits for response (via normal chat flow)
- On approval, agent promotes to production

No new approval mechanism needed — regular conversation is the gate.

## Implementation Phases

### Phase 1: Environment Model + Basic Deploy
- Prisma schema: Environment + Deployment models
- Admin UI: `/admin/environments` — register staging/production servers (link to SshHost)
- `deploy__to_staging` tool: SSH → git pull → build → PM2 restart → health check
- `deploy__status` tool: check health endpoint + current git branch

### Phase 2: Playwright Validation Integration
- After successful staging deploy, agent can navigate Playwright to staging URL
- Screenshot key pages, attach to thread
- Agent summarizes what it sees

### Phase 3: Production Promotion + Rollback
- `deploy__to_production` tool
- `deploy__rollback` tool (git checkout previous commit, rebuild)
- Deployment history in DB for audit trail

### Phase 4: Admin UI for Deployments
- `/admin/deployments` — list all deployments with status, logs, timestamps
- Click through to see build/test logs
- Manual rollback button

## Dependencies
- SSH plugin (Tier 1 #1) — must exist first
- Playwright visual capture (Tier 1 #2) — for validation screenshots
- Health check endpoint (exists at port 4002)

## Risks
- **Build time:** `pnpm build` can take minutes. Agent needs to handle long-running SSH commands (5+ min timeout).
- **Database migrations:** `db:push` on staging could break if schema diverges. Need to think about migration strategy for staged environments sharing a DB vs separate DBs.
- **Shared vs separate databases:** Staging and production probably need separate Postgres instances. Environment model needs DB connection info.
- **Rollback complexity:** Rolling back code is easy (git checkout). Rolling back database schema is hard. May need migration files instead of `db:push` for production.

## Open Questions
- Should staging and production share a database? Probably not — staging needs its own Postgres instance.
- Should the deploy script be baked into the SSH plugin, or should there be a separate deployment plugin that uses SSH as a transport?
- How does Portainer fit in? If Harness runs as a Docker container in Portainer, the deploy flow changes (docker pull + restart vs git pull + build). SSH still works for this (docker commands over SSH), but it's a different script.
