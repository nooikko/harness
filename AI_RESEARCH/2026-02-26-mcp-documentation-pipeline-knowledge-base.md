# Research: MCP Servers and Documentation Pipeline Tools for AI Coding Assistants
Date: 2026-02-26

## Summary

Research into MCP servers and tooling that enable a queryable, auto-updating architecture knowledge base for AI coding assistants — specifically for the use case of replacing or extending an oversized CLAUDE.md with something Claude can actively query rather than passively read.

## Prior Research
- `/mnt/ramdisk/harness/AI_RESEARCH/2026-02-22-claude-code-ecosystem-state.md` — consulted for existing MCP server context

---

## Current Findings

### 1. What Claude Code Already Supports Natively

Before reaching for external tools, Claude Code has several native mechanisms for modular documentation.

**The `.claude/rules/` directory** (Confidence: HIGH — from official docs at code.claude.ai/docs/en/memory)

All `.md` files in `.claude/rules/` are automatically loaded as project memory. Files can be scoped to specific file globs using YAML frontmatter:

```markdown
---
paths:
  - "packages/plugins/**/*.ts"
---
# Plugin Development Rules
- All plugins implement PluginContract interface
```

Files without `paths` frontmatter are unconditionally loaded. Subdirectories work recursively. This is the fastest short-term solution for a bloated CLAUDE.md.

**CLAUDE.md `@import` syntax** (Confidence: HIGH)

Any CLAUDE.md file can import other files with `@path/to/file.md`. Supports recursive imports up to 5 hops deep. Both relative and absolute paths work.

**Auto Memory** (Confidence: HIGH)

Claude automatically writes notes to `~/.claude/projects/<project>/memory/MEMORY.md` (first 200 lines loaded each session). Topic files like `api-conventions.md` are created on demand and read when needed. This is Claude's own working notes — it naturally captures architectural relationships as it discovers them.

**The key limitation:** All these approaches still load text into the context window. None are actively queryable as a database. Claude must read the entire document even if only 5% is relevant to the current task.

---

### 2. MCP Servers: Code Dependency and Architecture Graph

#### Depwire (BEST FIT for dependency graph)
- **GitHub:** `glama.ai/mcp/servers/@depwire/depwire` (no direct GitHub link found — discovery via Glama)
- **What it does:** Builds a deterministic, tree-sitter-parsed dependency graph of a codebase. AI calls 10 MCP tools autonomously.
- **Key tools:**
  - `connect_repo` — connects to a local project
  - `get_architecture_summary` — language breakdown, module structure, most-connected files (architectural hubs), entry points
  - `impact_analysis` — what breaks when you change a symbol
  - `get_file_context` — imports, exports, dependents for a file
  - `get_dependencies` / `get_dependents` — trace symbol relationships
  - `search_symbols` — find symbols by name
  - `visualize_graph` — generates interactive arc diagrams
- **Languages:** TypeScript, JavaScript, Python, Go
- **Auto-update:** "Live graph, always current" — edits trigger real-time updates without re-indexing
- **Monorepo support:** Not explicitly documented
- **Confidence:** MEDIUM — tool is real and listed on Glama, no independent GitHub star count available

#### dependency-mcp (mkearl)
- **GitHub:** `github.com/mkearl/dependency-mcp`
- **What it does:** Analyzes codebases to generate dependency graphs and architectural insights
- **Key tools:**
  - `analyze_dependencies` — generates dependency graphs
  - `get_dependency_graph` — exports JSON or DOT format
  - `get_file_metadata` — imports, exports, metadata for individual files
  - `get_architectural_score` — evaluates codebase against architectural rules; detects layers and validates boundaries
- **Languages:** TypeScript, JavaScript, C#, Python
- **Notable:** The architectural layer inference and boundary validation are unique — this is the only tool found that can assert "this file violates the plugin→orchestrator dependency rule"
- **Confidence:** MEDIUM — GitHub repo exists and is well-described, maturity unclear

#### CodeSeeker (jghiringhelli)
- **GitHub:** `github.com/jghiringhelli/codeseeker`
- **What it does:** Semantic code search + knowledge graph. Hybrid search combining vector + text + path matching.
- **Key tools:**
  - `search_code` — hybrid semantic + keyword search
  - `get_code_relationships` — graph traversal for dependencies
  - `get_coding_standards` — detected project patterns (validation, error handling)
  - `find_duplicates` / `find_dead_code` — code quality analysis
- **Languages:** TypeScript/JavaScript (Babel AST), Python, Java, C#; basic regex for Rust, Go, Ruby, PHP
- **Notable:** `get_coding_standards` auto-detects patterns — this is closest to "understanding how subsystems integrate"
- **Confidence:** MEDIUM

#### CodeGraph-MCP (NabiaTech)
- **GitHub:** `github.com/NabiaTech/codegraph-mcp`
- **What it does:** Lightweight TypeScript+Python code graph exposed via MCP. Uses TypeScript compiler API for full AST parsing.
- **Key tools:**
  - `graph.resolve_symbol` — fuzzy symbol lookup
  - `graph.references` — find callers/importers of a symbol
  - `graph.related` — k-hop neighbors in dependency graph
  - `graph.impact_from_diff` — changed files + 1-hop impact analysis
  - `code://file` resource — streams code snippets
- **Languages:** TypeScript (TypeScript compiler API), Python (stdlib ast)
- **Notable:** Uses the actual TypeScript compiler API, not just regex — accurate symbol resolution for TS
- **Roadmap:** SQLite backend planned for large monorepos; current JSON store not optimized for monorepos
- **Confidence:** MEDIUM — October 2025 creation, 8 commits, early stage

#### Code-Graph-RAG (vitali87)
- **GitHub:** `github.com/vitali87/code-graph-rag`
- **What it does:** Monorepo-focused RAG with Tree-sitter parsing, Memgraph graph DB backend, real-time file watching
- **Key tools:** 26 MCP methods; natural language queries and code modification
- **Languages:** Full JS/TS support (ES6 modules, CommonJS, arrow functions, interfaces, type aliases)
- **Auto-update:** Real-time watcher syncs graph on file create/modify/delete
- **Architecture relationships:** Dependency analysis including function call relationships; recalculates CALLS relationships on changes
- **Dependency:** Requires Memgraph (graph DB) to be running — non-trivial operational overhead
- **Confidence:** MEDIUM — GitHub repo and NPM package exist, but requires infrastructure

#### CartographAI/mcp-server-codegraph
- **GitHub:** `github.com/CartographAI/mcp-server-codegraph`
- **What it does:** Indexes codebase into entity/relationship graph
- **Tools:** `index`, `list_file_entities`, `list_entity_relationships`
- **Languages:** Python, JavaScript, Rust
- **Status:** 23 commits, February 2025 creation, modest activity
- **Confidence:** LOW-MEDIUM — narrow tool set, limited maintenance indicators

---

### 3. MCP Servers: Semantic Code Search (RAG-Based)

#### claude-context (Zilliz)
- **GitHub:** `github.com/zilliztech/claude-context`
- **What it does:** AST-based code chunking + Milvus/Zilliz vector DB for hybrid BM25+semantic search
- **Key tools:**
  - `index_codebase` — indexes a directory
  - `search_code` — natural language semantic search
  - `clear_index` — remove indexes
  - `get_indexing_status` — indexing progress
- **Auto-update:** Merkle tree-based incremental re-indexing of changed files only
- **Dependency:** Milvus or Zilliz Cloud required (external vector DB)
- **Confidence:** HIGH — backed by Zilliz (Milvus company), well-documented

#### code-index-mcp (johnhuang316)
- **GitHub:** `github.com/johnhuang316/code-index-mcp`
- **What it does:** Tree-sitter parsing for 7 core languages + fallback for 50+ file types
- **Key tools:**
  - `set_project_path`, `refresh_index`, `build_deep_index`
  - `search_code_advanced` — regex, fuzzy matching, pagination
  - `find_files` — glob patterns
  - `get_file_summary` — structure and complexity analysis
  - `configure_file_watcher` / `get_file_watcher_status`
- **Auto-update:** Native OS file watcher with batch processing of rapid changes
- **Monorepo support:** Not explicit, but per-directory indexing architecture is compatible
- **Confidence:** MEDIUM-HIGH — well-documented, active

#### mcp-local-rag (shinpr)
- **GitHub:** `github.com/shinpr/mcp-local-rag`
- **What it does:** Semantic + keyword search over local code and technical docs. Fully offline, zero setup.
- **Key tools:** `ingest_file`, `ingest_data`, `search`, `list`, `delete`, `status`
- **Confidence:** MEDIUM

---

### 4. MCP Servers: Documentation Indexing

#### docs-mcp-server (arabold) — "Open-source Context7"
- **GitHub:** `github.com/arabold/docs-mcp-server`
- **What it does:** Indexes websites, GitHub repos, npm/PyPI packages, local folders, zip archives. Runs entirely locally.
- **Key tools:**
  - `search_docs` — hybrid vector + full-text search
  - `list_libraries` — show indexed sources
  - `find_version` — version-specific documentation lookup
  - `fetch_url` — on-demand single URL fetch to Markdown
  - `remove_docs` — remove indexed content
- **Local file support:** Yes — `file://` URL prefix for local folders
- **File formats:** HTML, Markdown, PDF, Word, Excel, PowerPoint, source code
- **Notable for this use case:** Can index local architecture docs, ADRs, and markdown files as a queryable knowledge base
- **Semantic search:** Optional; requires embedding provider (OpenAI, Ollama, Gemini, Azure)
- **Confidence:** HIGH — well-maintained, positioned directly as Context7 alternative

---

### 5. MCP Servers: Persistent Knowledge Graph / Memory

#### Official Anthropic Memory MCP (modelcontextprotocol/servers src/memory)
- **GitHub:** `github.com/modelcontextprotocol/servers/tree/main/src/memory`
- **What it does:** Stores entities, relations, and observations in a local JSONL file. Persistent across sessions.
- **Core tools:** `create_entities`, `create_relations`, `add_observations`, `delete_entities`, `delete_relations`, `read_graph`, `search_nodes`, `open_nodes`
- **Storage:** JSONL file; "basic implementation" — designed for simple use cases
- **Limitation:** Manually populated. Claude must be explicitly told to remember things. Does not auto-extract from code.
- **Use case fit:** Good for storing architectural decisions Claude discovers, NOT for auto-indexing a codebase
- **Confidence:** HIGH — official Anthropic server

#### mcp-knowledge-graph (shaneholloman fork)
- **GitHub:** `github.com/shaneholloman/mcp-knowledge-graph`
- **What it does:** Extended fork of official memory server. Adds multiple named databases, per-project `.aim` directory isolation, safety markers on files.
- **Notable:** Per-project memory isolation via `.aim` directory — cleaner than global memory for multi-project setups
- **Confidence:** MEDIUM

#### MCP Neo4j Knowledge Graph Memory Server
- **Listed at:** `mcp.so/server/mcp-neo4j-memory-server/JovanHsu`
- **What it does:** Uses Neo4j as the backend instead of JSONL. Higher scale, proper graph query language (Cypher).
- **Use case fit:** Architecture modeling at scale — could represent plugin graph, orchestrator relationships with proper traversal queries
- **Dependency:** Neo4j instance required
- **Confidence:** LOW-MEDIUM — limited public documentation found

---

### 6. Monorepo-Specific MCP Servers

#### Rush MCP Server (@rushstack/mcp-server)
- **GitHub:** `github.com/microsoft/rushstack/tree/main/apps/rush-mcp-server`
- **What it does:** Gives AI assistants structured access to Rush monorepo data
- **Key tools:**
  - `rush_workspace_details` — full monorepo structure overview
  - `rush_project_details` — specific project metadata
  - `rush_docs` — relevant Rush documentation sections
  - `rush_command_validator` — validates commands against best practices
  - `rush_migrate_project` — project migrations
  - `rush_pnpm_lock_file_conflict_resolver` — lockfile conflicts
- **Extensible:** Via Rush MCP plugins — team can add custom tools
- **Design goal:** Centrally managed by monorepo maintainer, consistent for all contributors
- **Relevance for this codebase:** Rush-specific; this project uses Turborepo, NOT Rush — not directly applicable
- **Confidence:** HIGH — Microsoft official, actively maintained

#### Turborepo MCP
- **Status:** Does not exist yet. Open discussion at `github.com/vercel/turborepo/discussions/10130`
- **Proposal:** Would expose monorepo cache structure, task dependencies, workspace organization as LLM context
- **Current workaround:** Use Nx MCP or build custom tools
- **Confidence:** HIGH (confirmed absence) — verified via GitHub discussion thread

#### Nx MCP Server (nrwl/nx-console)
- **GitHub:** `github.com/nrwl/nx-console/tree/master/apps/nx-mcp`
- **What it does:** Exposes project graph, project relationships, file mappings, runnable tasks, ownership info, tech stacks
- **Current focus:** Lean server focused on Nx Cloud CI integration; workspace exploration moved to CLI skills (`nx show projects`, `nx graph`)
- **Relevance:** Nx-specific; this project uses Turborepo. Requires Nx migration to use.
- **Confidence:** HIGH — official Nx tooling

---

### 7. Architecture-as-Code Tools

#### LikeC4
- **Website:** `likec4.dev`
- **What it does:** Architecture-as-a-Code DSL (similar to C4 model). Teams write architecture descriptions; LikeC4 generates diagrams and exposes them via MCP.
- **MCP integration:** Yes — "provide architectural context for developers and agents" via MCP
- **Limitation:** Architecture must be written manually in DSL; does not auto-extract from code
- **Best fit:** When you want to author the architecture graph, not auto-derive it

#### Structurizr
- **Website:** `structurizr.com`
- **What it does:** C4 model implementation. Architecture described in DSL, generates diagrams.
- **MCP integration:** No dedicated MCP server found. Community tooling exists but nothing official.
- **Confidence:** HIGH (confirmed no MCP server)

#### ai-software-architect (codenamev)
- **GitHub:** `github.com/codenamev/ai-software-architect`
- **What it does:** Claude Code plugin for Architecture Decision Records (ADRs). Automates ADR creation, stores in `.architecture/decisions/adrs/`. Multi-perspective reviews.
- **AI integration:** Works as Claude Code plugin/skill (not MCP server)
- **Auto-update:** No — ADRs are authored, not auto-generated from code
- **Confidence:** MEDIUM — GitHub repo exists, active

---

### 8. Gaps Identified

The following capabilities do **not have production-ready MCP solutions** as of February 2026:

1. **Turborepo-specific MCP server** — does not exist; open feature request only
2. **pnpm workspace graph querying** — no MCP server found that reads `pnpm-workspace.yaml` and exposes workspace topology
3. **Plugin responsibility mapping** — no tool auto-extracts "Plugin X handles Y because it implements Z interface"
4. **Cross-subsystem integration documentation** — no tool auto-generates "how orchestrator, web plugin, and database interact" from code
5. **Auto-generated CLAUDE.md sections** — no pipeline found that watches code, detects architectural changes, and writes/updates a section of `.claude/rules/`
6. **Architectural constraint validation integrated with CI** — dependency-mcp has layer validation but no CI integration found

---

## Key Takeaways

- **For immediate CLAUDE.md bloat relief:** Use `.claude/rules/` directory with path-scoped rule files. Split by domain: `orchestrator.md`, `plugins.md`, `web-app.md`, `database.md`. (Native Claude Code feature, zero setup)
- **For queryable semantic code search:** `code-index-mcp` (johnhuang316) is the lowest-friction option with file watching. `claude-context` (Zilliz) is higher quality but needs Milvus.
- **For dependency graph and architecture summary:** `depwire` is the most polished (10 tools, always-current graph, architecture summary tool). `dependency-mcp` adds architectural layer validation.
- **For indexing architecture markdown docs:** `docs-mcp-server` (arabold) can index local folders of `.md` files with hybrid search — effectively "Context7 for your private docs."
- **For monorepo awareness:** No Turborepo MCP exists. Closest alternative: `rush-mcp-server` if willing to switch, or custom tool reading `turbo.json` + `pnpm-workspace.yaml`.
- **For persistent memory across sessions:** Official Anthropic memory MCP is correct but manual. Auto Memory (Claude Code native) fills gaps automatically.

---

## Sources
- Official Claude Code memory docs: https://code.claude.com/docs/en/memory
- Depwire MCP: https://glama.ai/mcp/servers/@depwire/depwire
- dependency-mcp: https://github.com/mkearl/dependency-mcp
- CodeSeeker: https://github.com/jghiringhelli/codeseeker
- CodeGraph-MCP (NabiaTech): https://github.com/NabiaTech/codegraph-mcp
- code-graph-rag: https://github.com/vitali87/code-graph-rag
- CartographAI/mcp-server-codegraph: https://github.com/CartographAI/mcp-server-codegraph
- claude-context (Zilliz): https://github.com/zilliztech/claude-context
- code-index-mcp: https://github.com/johnhuang316/code-index-mcp
- mcp-local-rag: https://github.com/shinpr/mcp-local-rag
- docs-mcp-server: https://github.com/arabold/docs-mcp-server
- Official Anthropic memory MCP: https://github.com/modelcontextprotocol/servers/tree/main/src/memory
- mcp-knowledge-graph fork: https://github.com/shaneholloman/mcp-knowledge-graph
- Rush MCP server: https://github.com/microsoft/rushstack/tree/main/apps/rush-mcp-server
- Turborepo MCP discussion (does not exist): https://github.com/vercel/turborepo/discussions/10130
- Nx MCP server: https://github.com/nrwl/nx-console/tree/master/apps/nx-mcp
- LikeC4 MCP: https://likec4.dev
- ai-software-architect: https://github.com/codenamev/ai-software-architect
- Axon.MCP.Server: https://github.com/ali-kamali/Axon.MCP.Server
- Awesome MCP Servers: https://github.com/wong2/awesome-mcp-servers
- MCP Knowledge base servers (2026): https://desktopcommander.app/blog/best-mcp-servers-for-knowledge-bases-in-2026
- Scaffold MCP: https://mcp.so/server/scaffold/Beer-Bears
- mcp.so knowledge-graph tag: https://mcp.so/servers?tag=knowledge-graph
