# Research: SurfSense — Technical Evaluation Report
Date: 2026-03-01

## Summary

SurfSense is an open-source, self-hostable AI knowledge management and research platform (Apache 2.0) positioned as an alternative to NotebookLM, Perplexity, and Glean. It connects LLMs to 25+ external data sources, implements a hybrid semantic + full-text RAG pipeline on PostgreSQL + pgvector, and exposes a FastAPI REST interface with streaming chat. As of March 2026, the project has 13.1k GitHub stars, 1.2k forks, and releases every 2–4 weeks.

## Prior Research

No prior SurfSense research found in AI_RESEARCH/.

## Current Findings

---

### 1. Executive Summary

SurfSense is a FastAPI + Next.js 16 monorepo providing a full RAG-as-a-Service platform: connect external data sources via OAuth or API key, process documents through pluggable ETL (Docling/Unstructured/LlamaCloud), store chunks in PostgreSQL + pgvector, and query via hybrid search with LangGraph-powered agents. It is self-hostable via a single Docker command and supports 100+ LLMs through a LiteLLM gateway. The project is beta (latest: beta-v0.0.13, Feb 2025), explicitly not production-ready per its own README, but is actively developed with high community velocity.

For Harness, SurfSense represents a potential **external knowledge sidecar** — a separately-deployed service exposing a REST API that a Harness plugin could query to inject relevant context into Claude invocations via the `onBeforeInvoke` hook.

---

### 2. Core Architecture

**Three-tier design:**

```
Client Layer       → Next.js 16 web app (TypeScript) + Plasmo browser extension
Application Layer  → FastAPI backend (Python 3.12+) + LangGraph AI agents + Celery workers
Data Layer         → PostgreSQL 16 + pgvector extension + Redis (task queue)
```

**Key subsystems:**
- `surfsense_backend/app/routes/` — REST API handlers (auth, chat, documents, connectors, search)
- `surfsense_backend/app/agents/new_chat/` — LangGraph stateful agent with tool registry
- `surfsense_backend/app/services/connector_service.py` — 28 connector types, OAuth + API key auth
- `surfsense_backend/app/tasks/` — Celery background jobs (indexing, sync, podcast generation)
- `surfsense_backend/app/utils/` — ETL pipeline (upload → markdown → chunk → embed → store)

**LLM flexibility:** LiteLLM gateway abstracts 100+ models (OpenAI, Anthropic, Google, Azure, Groq, Ollama, vLLM, llama.cpp, LM Studio). Embedding models: 6000+ via sentence-transformers and OpenAI-compatible APIs.

**Real-time sync:** Electric-SQL on port 5133 for real-time frontend synchronization. WebSocket streaming for chat.

---

### 3. Supported Integrations

**Total: 28 connector types across 3 authentication patterns**

| Source | Category | Data Synced | Auth Method |
|--------|----------|-------------|-------------|
| Google Drive | Cloud Storage | Files (read-only), email | OAuth 2.0 (Google Cloud Console) |
| Gmail | Email | Messages, threads | OAuth 2.0 (Google) |
| Google Calendar | Productivity | Events, attendees | OAuth 2.0 (Google) |
| Notion | Knowledge Base | Pages, databases (excl. AI/transcription blocks) | OAuth 2.0 (Notion public integration) |
| Slack | Communication | Public channels, private channels, DMs, group DMs, user info | OAuth 2.0 (Slack app, 7 scopes) |
| Microsoft Teams | Communication | Channels, messages | OAuth 2.0 (Azure AD) |
| Discord | Communication | Server messages | OAuth 2.0 |
| GitHub | Development | Code files (Python/JS/TS/Go/Rust/Java/etc.), README, config files; excludes binary + >5MB files | PAT (Personal Access Token) or unauthenticated |
| Linear | Project Mgmt | Issues, projects | OAuth 2.0 |
| Jira | Project Mgmt | Issues, search results, worklogs, attachments, user profiles | Atlassian OAuth 2.0 (3LO, rotating refresh) |
| ClickUp | Project Mgmt | Tasks, spaces | OAuth 2.0 |
| Confluence | Documentation | Pages, spaces | Atlassian OAuth 2.0 |
| BookStack | Documentation | Books, pages | API key |
| Airtable | Database | Tables, records | OAuth 2.0 |
| Obsidian | Knowledge Base | Markdown notes | Local vault sync |
| Elasticsearch | Search/Data | Documents from specified indices (wildcard support, 1-10k docs) | API key OR username/password |
| Tavily | Web Search | Live search results (AI-optimized) | API key |
| SearxNG | Web Search | Federated search results | URL endpoint (self-hosted) |
| LinkUp | Web Search | Web search results | API key |
| Baidu Search | Web Search | Baidu search results | API key |
| YouTube | Media | Video transcripts | API (youtube-transcript-api) |
| Firecrawl | Web Crawler | Full page content (JavaScript-enabled) | API key |
| Circleback | Meetings | Meeting notes, transcripts | OAuth 2.0 |
| Luma | Events | Event data | OAuth 2.0 |
| MCP Servers | Extensibility | Custom tool data | API key / config |

**GitHub-specific notes:** Uses `gitingest` library. Periodic sync detects changed files. Public repos require no auth; private repos require PAT with `repo` scope. Rate limit: 60 req/hr unauthenticated, 5,000/hr with PAT.

**Elasticsearch-specific notes:** Supports cloud (`https://cluster.es.region.aws.com:443`) and self-hosted (`https://elasticsearch.example.com:9200`). Index selection via wildcards (`logs-*`) or comma-separated names.

---

### 4. Search & Retrieval Capabilities

**RAG Pipeline — Indexing Phase:**
1. Document ingestion via upload API or connector fetch
2. ETL: content extracted to normalized markdown (Docling local / Unstructured cloud / LlamaCloud cloud)
3. Intelligent chunking via Chonkie library (semantic boundary-aware)
4. Embedding generation (configurable model, default: sentence-transformers)
5. Dual storage: vector embedding (pgvector) + full-text index (PostgreSQL tsvector)
6. Two-tier: chunk-level embeddings + document-level summary embeddings

**RAG Pipeline — Retrieval Phase:**
1. Query embedding generated with same model as index
2. Parallel execution: vector similarity search (cosine/L2 via pgvector) + full-text search (tsquery/tsvector)
3. Reciprocal Rank Fusion (RRF) merges both result sets with configurable weights
4. Optional reranking: Flashrank (local), Pinecone, Cohere
5. Top-K chunks assembled with citation markers `[[citation:chunk_id]]`
6. Optional date-range and connector-specific filtering

**Agent layer:** LangGraph stateful agents with tool-calling. Built-in tools in registry:
- `search_knowledge_base` — hybrid search with optional date/connector filters
- `search_surfsense_docs` — documentation search
- `scrape_webpage` — live web scraping (Firecrawl or Chromium/Trafilatura)
- `generate_podcast` — TTS conversion (Kokoro/OpenAI/Azure/Google Vertex AI)
- `generate_report` — PDF/DOCX export
- `generate_image` — image generation
- `link_preview` — Open Graph metadata
- `display_image` — image embedding
- `save_memory` / `recall_memory` — personal and team memory
- `linear_*` / `notion_*` / `google_drive_*` — action tools (create/update/delete)

---

### 5. Connection API

**No dedicated public SDK exists.** Integration is via the FastAPI REST API, auto-documented at `http://localhost:8000/docs` (Swagger UI).

**Key REST Endpoints:**

```
# Authentication
POST /auth/register          → Create user account
POST /auth/login             → Email/password or OAuth → returns JWT
POST /auth/refresh           → Refresh JWT token

# Search Spaces (workspace containers)
GET  /search-spaces          → List workspaces
POST /search-spaces          → Create workspace

# Documents
POST /documents/upload       → Upload file (50+ formats)
GET  /documents              → List documents in SearchSpace
DELETE /documents/{id}       → Remove document
GET  /documents/{id}/chunks  → Retrieve chunks

# Connectors
GET  /connectors             → List available connector types
POST /connectors             → Create connector instance
GET  /connectors/{id}/sync   → Trigger manual reindex
DELETE /connectors/{id}      → Remove connector

# Search (direct query, bypasses agent)
POST /search                 → Hybrid search query
                               Body: { query, search_space_id, max_results? }
GET  /search/suggestions     → Autocomplete

# Chat (LangGraph agent)
POST /chat/messages          → Submit message (streaming SSE)
GET  /chat/threads           → List conversations
POST /chat/threads           → Create thread
GET  /chat/threads/{id}/messages → Message history

# LLM Configuration
GET  /llm-configs            → List workspace LLM configurations
POST /llm-configs            → Create/update config
GET  /llm-configs/{role}     → Get role-specific config (agent/summarize)
```

**Authentication for API calls:** JWT Bearer token in `Authorization` header. Tokens obtained via POST /auth/login.

**Streaming:** Chat endpoint uses Server-Sent Events (SSE). Response includes `[[citation:chunk_id]]` markers for source attribution.

**Tool registry extension pattern:**

```python
# surfsense_backend/app/agents/new_chat/tools/registry.py

@dataclass
class ToolDefinition:
    name: str
    description: str
    factory: Callable[[dict[str, Any]], BaseTool]
    requires: list[str] = field(default_factory=list)
    enabled_by_default: bool = True

# To add a custom tool:
# 1. Create surfsense_backend/app/agents/new_chat/tools/my_tool.py
# 2. Implement a factory function with @tool decorator
# 3. Register in BUILTIN_TOOLS list:
BUILTIN_TOOLS = [
    ToolDefinition(
        name="my_custom_tool",
        description="What this tool does",
        factory=my_tool_factory,
        requires=["db", "search_service"],
    ),
    # ... existing tools
]
```

**Connector extension pattern:**

```python
# surfsense_backend/app/services/connector_service.py
# Each connector implements:
# 1. Authentication handler (OAuth token refresh or API key)
# 2. fetch() — retrieves new/updated content from source
# 3. sync() — incremental update with hash-based deduplication
# 4. Celery Beat integration for scheduled re-indexing
```

---

### 6. Self-Hosting Setup

**Option 1: All-in-One Docker (quickest, for evaluation)**

```bash
docker run -d \
  -p 3000:3000 \
  -p 8000:8000 \
  -p 5133:5133 \
  -v surfsense-data:/data \
  --name surfsense \
  --restart unless-stopped \
  ghcr.io/modsetter/surfsense:latest
```

Bundles: PostgreSQL 16 + pgvector, Redis, FastAPI backend, Next.js frontend, Celery worker + beat, Electric-SQL.
Access: Frontend http://localhost:3000, API http://localhost:8000, API docs http://localhost:8000/docs.

**Option 2: Docker Compose (production)**

```bash
git clone https://github.com/MODSetter/SurfSense
cd SurfSense
# Configure three .env files (root, surfsense_backend/.env, surfsense_web/.env)
docker compose up -d
```

Services: frontend, backend, db, redis, celery_worker, celery_beat, pgadmin (5050), flower (5555).

**Option 3: Manual Installation**

Prerequisites: Python 3.12+, Node.js 20+, PostgreSQL 14+ with pgvector, Redis.

```bash
# Backend
cd surfsense_backend
uv sync
uv run main.py

# Frontend (separate terminal)
cd surfsense_web
pnpm install && pnpm run dev

# Celery (separate terminals)
uv run celery -A celery_worker.celery_app worker --pool=solo
uv run celery -A celery_worker.celery_app beat
```

**Critical environment variables:**

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL asyncpg URL | `postgresql+asyncpg://postgres:pass@db:5432/surfsense` |
| `SECRET_KEY` | JWT signing secret | auto-generated if unset |
| `EMBEDDING_MODEL` | Vector embedding model | `sentence-transformers/all-MiniLM-L6-v2` |
| `ETL_SERVICE` | Document parser | `DOCLING` (local) / `UNSTRUCTURED` / `LLAMACLOUD` |
| `AUTH_TYPE` | User auth strategy | `LOCAL` or `GOOGLE` |
| `CELERY_BROKER_URL` | Redis for tasks | `redis://redis:6379/0` |
| `NEXT_PUBLIC_FASTAPI_BACKEND_URL` | Frontend API URL | `http://localhost:8000` |
| `SCHEDULE_CHECKER_INTERVAL` | Connector sync frequency | e.g., `300` (seconds) |

**ETL choice for privacy:** Docling runs fully locally — no data leaves the host. No API key required.

---

### 7. Plugin/Extension Points

SurfSense has **three defined extension mechanisms** but no formal plugin contract or registry:

**A. Agent Tool System (most mature)**
- Location: `surfsense_backend/app/agents/new_chat/tools/`
- Pattern: Create module, implement LangChain `@tool` factory, register `ToolDefinition` in `registry.py`
- Runtime: `build_tools_async()` loads dynamic MCP tools from database alongside built-in tools
- Dependency injection via `requires` list (db, search_service, etc.)
- 20+ built-in tools; no documented limit on custom additions

**B. Connector System (partially extensible)**
- Location: `surfsense_backend/app/services/connector_service.py`
- Pattern: Extend base connector class, implement fetch/sync, add to connector type enum, wire into Celery Beat
- No hot-reload — requires code changes + restart + database migration for new connector type enum values
- No documented public API for third-party connector plugins

**C. MCP Server Support (roadmap + partial)**
- Roadmap item: "Deep Agents, Real-Time Collaboration & MCP Servers"
- `build_tools_async()` already loads "dynamic MCP tools from database" — partial implementation exists
- SurfSense is listed as an integration on docs.linkup.so — it consumes MCP tools, not yet a full MCP server itself
- No published MCP server endpoint as of the latest release (beta-v0.0.13)

**D. ETL Pipeline (swappable)**
- Three ETL backends via single env var: `ETL_SERVICE=DOCLING|UNSTRUCTURED|LLAMACLOUD`
- No custom ETL plugin mechanism documented

**E. Embedding Models (configurable)**
- Any sentence-transformers model or OpenAI-compatible embedding endpoint via `EMBEDDING_MODEL`
- Affects both indexing and retrieval — must be consistent

---

### 8. Authentication Model

**User authentication:**
- `LOCAL`: Email/password with Argon2 hashing via argon2-cffi; JWT sessions via FastAPI Users
- `GOOGLE`: Google OAuth for user login (required for Gmail/Google Calendar connectors)
- JWT stored in HTTP-only cookies; automatic refresh before expiration
- `SECRET_KEY` env var for token signing

**Connector authentication (per-source):**

| Pattern | Sources |
|---------|---------|
| OAuth 2.0 (provider-specific) | Google Drive, Gmail, Google Calendar, Slack, Notion, GitHub (optional), Discord, Teams, Jira, ClickUp, Confluence, Linear, Airtable, Google Calendar, Luma, Circleback |
| Personal Access Token | GitHub (private repos), BookStack |
| API Key (stored encrypted) | Tavily, SearxNG (URL), Linkup, Baidu Search, Elasticsearch, Firecrawl |
| No auth | GitHub public repos, YouTube (transcripts) |

OAuth setup requires: creating a developer app at each provider, configuring redirect URI to `http://localhost:8000/api/v1/auth/{provider}/connector/callback`, storing Client ID and Client Secret as environment variables.

Connector credentials are **encrypted at rest** in the `SearchSourceConnector` table. OAuth tokens use rotating refresh tokens (Jira uses Atlassian's 3LO pattern explicitly).

**RBAC:** Four default roles — Owner, Admin, Editor, Viewer — scoped per SearchSpace workspace. Granular permission arrays cover Documents (CRUD), Connectors (create/index), Members, Roles, Chats, LLM configs. Custom roles are supported.

---

### 9. Repository Activity (as of March 2026)

| Metric | Value |
|--------|-------|
| GitHub Stars | 13,100+ |
| GitHub Forks | 1,200+ |
| Total Commits | 3,404 |
| Contributors (12 months) | 18 |
| Contributors (last 30 days) | 9 |
| Latest Release | beta-v0.0.13 (Feb 11, 2025) |
| Release Cadence | Every 2–4 weeks |
| License | Apache 2.0 |
| Project Status (self-stated) | Beta, not production-ready |
| Open Issues | Active (Feb 2026 issues visible) |
| Language Split | TypeScript 63%, Python 36% |

**Release history showing acceleration:**
- v0.0.7: May 2024
- v0.0.8: Oct 2024
- v0.0.9: Dec 2024
- v0.0.10: Jan 2025
- v0.0.11: Jan 2025
- v0.0.12: Jan 2025
- v0.0.13: Feb 2025 (50+ merged PRs)

---

### 10. Fit Assessment for Harness Plugin

**Integration pattern:** SurfSense would function as a **separately deployed service** queried by a Harness plugin — not embedded. The plugin calls SurfSense's REST API to retrieve relevant context, then injects it into Claude's prompt.

**Harness plugin hook:** `onBeforeInvoke` (chain hook — can transform prompt)

**PluginContext methods used:**
- `ctx.invoker` — not directly needed
- `ctx.sendToThread` — not needed
- `ctx.db` — potentially to read thread metadata (topic, connected SearchSpace ID)
- `ctx.config` — to read SurfSense base URL and API credentials
- `ctx.logger` — for debugging retrieval calls

**Conceptual plugin sketch:**

```typescript
// packages/plugins/surfsense/src/index.ts
const register = async (ctx: PluginContext): Promise<PluginHooks> => {
  const surfsenseUrl = ctx.config.surfsenseUrl;       // custom config extension needed
  const surfsenseToken = ctx.config.surfsenseToken;   // JWT or API key
  const searchSpaceId = ctx.config.surfsenseSpaceId;

  return {
    onBeforeInvoke: async (threadId, prompt) => {
      // POST /search with the current prompt as query
      const response = await fetch(`${surfsenseUrl}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${surfsenseToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: prompt,
          search_space_id: searchSpaceId,
          max_results: 5,
        }),
      });
      const { chunks } = await response.json();
      const contextBlock = formatChunksAsContext(chunks);
      return `${contextBlock}\n\n---\n\n${prompt}`;
    },
  };
};
```

**OrchestratorConfig extension needed:** SurfSense connection details (`surfsenseUrl`, `surfsenseToken`, `surfsenseSpaceId`) would need to be added to the config shape — or read from environment variables directly in the plugin.

**What Harness plugin cannot do without changes:**
- Trigger SurfSense connector syncs (would need `ctx.sendToThread`-style capability or a separate cron job)
- Register new connectors in SurfSense (requires SurfSense OAuth app setup outside Harness)
- Expose SurfSense as a tool to Claude (would need MCP tool registration via delegation plugin pattern)

---

### 11. Gaps & Risks

**Technical gaps:**
- **No public SDK or typed client library** — must handroll HTTP calls. No npm package.
- **No dedicated "query" endpoint documentation** — `/search` behavior inferred from codebase analysis, not official docs
- **Beta stability** — self-stated "not production-ready"; frequent breaking changes across releases
- **Connector OAuth setup complexity** — each of the 16 OAuth connectors requires creating a developer app at the provider. For a Harness integration, this is manual one-time setup per source
- **MCP server not yet available** — roadmap item, not implemented. Cannot be consumed as MCP tool by Harness yet
- **No streaming search** — `/search` returns synchronously; only `/chat/messages` streams via SSE
- **Celery Beat required for sync** — without the beat scheduler running, connector sync schedules don't execute; adds operational complexity

**Operational risks:**
- **Separate deployment dependency** — adds infrastructure to manage (PostgreSQL + pgvector, Redis, Celery worker + beat, Electric-SQL)
- **Version drift** — beta release cycle may introduce breaking API changes between Harness deployments
- **Resource consumption** — embedding generation and full reindexing are CPU/GPU intensive; requires appropriate hardware
- **Data egress risk** — connector credentials stored in SurfSense DB; if using cloud ETL (Unstructured/LlamaCloud), documents leave the host

**Ecosystem risks:**
- Single maintainer (MODSetter) drives most commits; 18 contributors is a small team for the scope
- "Very low source code comments" noted by OpenHub — harder to navigate for custom development
- No enterprise support tier currently offered

---

### 12. Recommendation

**For Harness as a data platform option:** SurfSense is the **most feature-complete self-hostable RAG platform** found for this use case. Its connector breadth (28 sources), hybrid search quality, and Docker deployment make it a strong candidate as an external knowledge sidecar.

**Recommended integration path:**
1. Deploy SurfSense alongside Harness via Docker Compose with Docling (local ETL, no data egress)
2. Build a `surfsense` Harness plugin implementing `onBeforeInvoke` to query `/search`
3. Start with a single SearchSpace containing high-value static sources (GitHub repo, Notion docs)
4. Add OAuth connectors incrementally as needed

**Do not use SurfSense if:**
- Production SLA is required today (beta, not production-ready)
- MCP tool exposure to Claude is the primary goal (not yet implemented)
- Infrastructure complexity budget is zero (requires 5+ services)
- Data must never leave the process boundary (Celery worker and ETL run separately)

**Watch for:** MCP server support on the roadmap — once available, SurfSense could be wired into Harness via the delegation plugin's MCP tool mechanism rather than a custom plugin, which would be significantly simpler.

---

## Key Takeaways

1. SurfSense is a full RAG-as-a-Service platform, not a library — integration is via REST API
2. 28 connectors cover the major enterprise knowledge sources; OAuth setup is per-connector
3. Hybrid search (pgvector + PostgreSQL FTS + RRF) is production-quality, backed by well-understood technology
4. Docker all-in-one deployment is ~5 minutes; production Docker Compose is ~30 minutes
5. The `onBeforeInvoke` hook in Harness is the natural integration point
6. No SDK — must handroll REST calls with JWT auth
7. Beta status and single-maintainer risk are the primary concerns for production use
8. MCP server support (roadmap) would unlock a simpler integration path via Harness's existing delegation plugin

---

## Sources

- GitHub repo (primary): https://github.com/MODSetter/SurfSense
- Official docs: https://www.surfsense.com/docs
- Docker installation docs: https://www.surfsense.com/docs/docker-installation
- GitHub connector docs: https://www.surfsense.com/docs/connectors/github
- Notion connector docs: https://www.surfsense.com/docs/connectors/notion
- Slack connector docs: https://www.surfsense.com/docs/connectors/slack
- Google Drive connector docs: https://www.surfsense.com/docs/connectors/google-drive
- Jira connector docs: https://www.surfsense.com/docs/connectors/jira
- Elasticsearch connector docs: https://www.surfsense.com/docs/connectors/elasticsearch
- DeepWiki architecture analysis: https://deepwiki.com/MODSetter/SurfSense
- DeepWiki installation options: https://deepwiki.com/MODSetter/SurfSense/2.1-installation-options
- zread.ai connector analysis: https://zread.ai/MODSetter/SurfSense/23-third-party-service-integration
- zread.ai search spaces API: https://zread.ai/MODSetter/SurfSense/28-search-spaces-api
- zread.ai communication connectors: https://zread.ai/MODSetter/SurfSense/25-communication-platform-connectors
- Releases page: https://github.com/MODSetter/SurfSense/releases
- OpenHub metrics: https://openhub.net/p/SurfSense
- Linkup integration docs: https://docs.linkup.so/pages/integrations/surfsense/surfsense
- OSRepos summary: https://osrepos.com/repo/modsetter-surfsense
