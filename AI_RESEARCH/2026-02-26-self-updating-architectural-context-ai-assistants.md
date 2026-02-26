# Research: Self-Updating Architectural Context for AI Coding Assistants

Date: 2026-02-26

## Summary

Engineering teams with large, evolving codebases face a core problem: static documentation like CLAUDE.md becomes stale and bloated. The solution space has three distinct tiers — (1) semantic code intelligence MCPs that let the AI query a live code index at runtime, (2) auto-documentation pipelines that derive structured context from code on commit, and (3) a knowledge-base architecture (hot/cold memory) that keeps CLAUDE.md minimal and shifts heavy knowledge to on-demand documents. The "internalized Context7 for your own repo" goal is achievable with existing open-source tooling in 2026.

## Prior Research

None directly on this topic. Adjacent: `2026-02-22-claude-code-ecosystem-state.md`.

## Current Findings

---

### 1. Code Intelligence MCPs (Query Your Codebase at Runtime)

These MCPs let Claude ask questions about the codebase rather than loading everything into context upfront. This is the highest-leverage approach.

#### Serena (STRONGLY RECOMMENDED for this use case)

- **GitHub**: https://github.com/oraios/serena
- **Stars**: 20.7k | **Commits**: 2,241 | **Contributors**: 120 | **Latest release**: v0.1.4 (August 2025)
- **What it does**: Symbol-level code retrieval and editing via Language Server Protocol (LSP). Works like an IDE — `find_symbol`, `find_referencing_symbols`, `GetCodeMap`, `go_to_definition`, `find_references`.
- **Language support**: 30+ languages including TypeScript, JavaScript, Python, Go, Rust, Java.
- **TypeScript backend**: Uses TypeScriptLanguageServer via Node.js.
- **Key MCP tools exposed**:
  - `GetCodeMapTool` — returns a structured map of all symbols in the codebase
  - `find_symbol` / `find_referencing_symbols` — navigation at symbol level, not text level
  - `ReplaceSymbolBodyTool`, `InsertAfterSymbolTool` — editing at symbol level
  - `SearchForPatternTool` — semantic pattern search
- **Install**: `uvx --from git+https://github.com/oraios/serena serena start-mcp-server`
- **Why it matters**: Allows Claude to ask "what does the context plugin do?" and receive an accurate, up-to-date answer derived directly from the code's symbol graph — no manual docs needed.

#### Claude Context / CodeIndexer (Zilliz)

- **GitHub**: https://github.com/zilliztech/claude-context
- **Stars**: 5.5k | **Commits**: 147 | **Forks**: 492
- **What it does**: Hybrid BM25 + dense vector semantic search. AST-based code chunking. Merkle tree incremental re-indexing (only re-indexes changed files).
- **Claims ~40% token reduction** compared to loading full codebase.
- **Embedding providers**: OpenAI, VoyageAI, Ollama, Gemini.
- **Vector backends**: Milvus, Zilliz Cloud.
- **Limitation**: Requires Zilliz Cloud account (free tier available). Incompatible with Node.js 24.0.0+.
- **Best for**: Natural language semantic search over large codebases when you need "find code that does X" queries.

#### Code-Index-MCP (local-first)

- **GitHub**: https://github.com/johnhuang316/code-index-mcp
- **npm**: `@code-indexer/mcp`
- **What it does**: Hybrid BM25 + semantic search, entirely local. 7 languages with Tree-sitter AST parsing (includes TypeScript). 48-language fallback.
- **Performance**: Sub-100ms queries, <10s indexing for cached repos.
- **Key advantage**: No external API or cloud dependency. Indexes `.env` files and secrets locally (never leaves machine).
- **Best for**: Privacy-sensitive codebases where external APIs are not acceptable.

#### mcp-server-tree-sitter (wrale)

- **GitHub**: https://github.com/wrale/mcp-server-tree-sitter
- **Stars**: 266 | MIT licensed
- **What it does**: AST-based analysis via tree-sitter. 30+ tools for project management, syntax analysis, symbol extraction, dependency tracking, complexity analysis.
- **Key capability**: Returns structured AST data — the AI gets the actual syntactic structure of the code, not just text.
- **Install**: `pip install mcp-server-tree-sitter`
- **Language support**: Python, JavaScript, TypeScript, Go, Rust, C++, Java (via tree-sitter).

#### Code-Graph-RAG

- **GitHub**: https://github.com/vitali87/code-graph-rag
- **Stars**: 2,000+
- **What it does**: Builds a knowledge graph (stored in Memgraph via Docker) from Tree-sitter analysis. Supports natural language queries translated to graph queries. Real-time file-watch updates.
- **Languages**: Python, JavaScript, TypeScript, Rust, Java, C++, Go, PHP, Scala, C#.
- **MCP integration**: Yes — works as MCP server with Claude Code.
- **Limitation**: Requires Docker + Memgraph container + Python 3.12+ + CMake + ripgrep.
- **Best for**: Teams that want graph-based "how does X connect to Y?" queries.

#### Code Pathfinder

- **URL**: https://codepathfinder.dev/mcp
- **GitHub**: https://github.com/shivasurya/code-pathfinder
- **License**: AGPL-3.0, free
- **What it does**: 5-pass static analysis, call graph generation, dataflow analysis, import resolution.
- **IMPORTANT LIMITATION**: Currently supports **Python only**. TypeScript/JavaScript support is planned but not released.
- **MCP tools**: project stats, symbol search, call graphs (forward + reverse), call site details, import resolution, dataflow tracking.
- **Not applicable yet** for TypeScript/Node.js stacks.

---

### 2. Auto-Documentation from Code (Derive Context Automatically)

#### TypeDoc + typedoc-plugin-markdown

- **TypeDoc**: https://typedoc.org/ | **GitHub**: https://github.com/TypeStrong/typedoc (Stars: high, actively maintained)
- **Plugin**: https://github.com/typedoc2md/typedoc-plugin-markdown
- **What it does**: Generates documentation directly from TypeScript source and JSDoc/TSDoc comments.
- **Output formats**: HTML, JSON (machine-readable model), Markdown (via plugin).
- **For AI context use**: The `--json` flag outputs a complete project model in JSON — every module, class, function, interface with full type information. This JSON can be used as input to a script that generates CLAUDE.md sections automatically.
- **Integration path**: `typedoc --json docs/architecture.json src/index.ts` → post-process JSON into human-readable architecture summaries.

#### dependency-cruiser

- **GitHub**: https://github.com/sverweij/dependency-cruiser (Stars: high, actively maintained)
- **npm**: `dependency-cruiser`
- **What it does**: Validates and visualizes JavaScript/TypeScript module dependencies. Outputs JSON, HTML, SVG, DOT.
- **Machine-readable output**: Full JSON schema at `src/schema/cruise-result.schema.json`. Each module shows incoming/outgoing dependencies.
- **For AI context use**: `depcruise --output-type json src` produces a complete dependency graph as JSON. Can be transformed into a "module relationship" section of CLAUDE.md automatically.
- **Key capability**: Can enforce architectural rules (e.g., "plugins must not import from orchestrator") as part of CI.

#### Repomix (22.1k stars — highly active)

- **GitHub**: https://github.com/yamadashy/repomix
- **Website**: https://repomix.com
- **What it does**: Packs entire repository into a single AI-optimized file (XML, Markdown, or plain text). Respects .gitignore. Uses Tree-sitter for code compression. Includes token counts.
- **Claude Code integration**: Official MCP plugin (`repomix-mcp`), slash commands plugin, explorer plugin.
- **For architectural context**: Run `npx repomix --include "src/**/*.ts" --output-format markdown` to generate a filtered, AI-readable snapshot of all TypeScript source. Can be regenerated on each commit via git hook.
- **Filtering**: `--include`, `--ignore`, glob patterns, directory scoping.
- **Best quick win**: The `repomix-explorer` Claude Code plugin intelligently analyzes repo structure without dumping everything into context.

#### CTX / Context-Hub Generator

- **GitHub**: https://github.com/context-hub/generator
- **Stars**: 301 | **Commits**: 685
- **What it does**: YAML-configured context generation. Specify sources (files, git diffs, URLs), apply filters/modifiers, output structured markdown. Also works as MCP server for live filesystem access.
- **For architectural context**: Define a `context.yaml` that pulls in key architecture files, recent diffs, and generates a consolidated document. Can be run as part of CI or git hooks.
- **Limitation**: Primarily PHP-ecosystem focused in documentation examples, but the tool itself is language-agnostic.

---

### 3. Vector Database MCPs (Build a Searchable Knowledge Base)

#### Qdrant MCP (Official)

- **GitHub**: https://github.com/qdrant/mcp-server-qdrant
- **Stars**: 1.2k | **Commits**: 73 | Officially maintained by Qdrant.
- **What it does**: Two tools — `qdrant-store` (persist information) and `qdrant-find` (semantic retrieval). Uses FastEmbed (sentence-transformers/all-MiniLM-L6-v2 by default). Auto-creates collections.
- **Use case**: Store module descriptions, architectural decisions, plugin documentation as vectors. Claude queries with "how does the context plugin work?" and retrieves the relevant stored document.
- **Installation**: `uvx mcp-server-qdrant` or Docker. Run Qdrant locally for free.
- **Pipeline**: TypeDoc JSON → process into module summaries → `qdrant-store` each summary → Claude queries via `qdrant-find`.

#### Chroma MCP (Official)

- **GitHub**: https://github.com/chroma-core/chroma-mcp
- **PyPI**: `chroma-mcp-server`
- **What it does**: Full-text search, vector search, metadata filtering over collections. Multiple embedding providers (OpenAI, Cohere, Jina, VoyageAI, Ollama).
- **TypeScript client**: Available via `chromadb` npm package.
- **Persistence**: Configurable persistent storage via data directory.
- **Use case**: Same as Qdrant — index module docs and query semantically.

---

### 4. Private Context7 / Custom Documentation Indexing

#### Context7 (Official — upstash)

- **GitHub**: https://github.com/upstash/context7
- **Plans page**: https://context7.com/plans
- **Private repo support**: Only on Pro and Enterprise plans. NOT available on free tier.
- **Self-hosted**: Only available on Enterprise tier. The client is open-source but the backend is proprietary.
- **Verdict for private codebases**: Not viable without significant cost unless on Enterprise.

#### open-context7

- **GitHub**: https://github.com/rakuv3r/open-context7
- **Stars**: 1 | **Commits**: 2 | **Last commit**: January 9, 2025.
- **Status**: Extremely early-stage, not production-ready. Architecture looks right (FastAPI + Qdrant + Next.js + nginx) but there is no community adoption.
- **Verdict**: Not viable — use Qdrant MCP directly instead.

#### Sourcegraph MCP

- **Docs**: https://sourcegraph.com/docs/api/mcp
- **What it does**: Full Sourcegraph code intelligence via MCP — keyword search, semantic (NLS) search, go-to-definition, find-references, commit search, diff search, deep search.
- **Private repo support**: YES — self-hosted Sourcegraph instances are explicitly supported. Point MCP at `https://your-sourcegraph-instance.com/.api/mcp`.
- **Authentication**: OAuth 2.0 or access tokens.
- **Cost**: Sourcegraph requires a license for self-hosted deployment (Community edition free for small teams).
- **Best for**: Teams already running Sourcegraph. Provides the most complete code intelligence MCP available.

---

### 5. The "Codified Context" Three-Tier Architecture (Academic Backing)

**Paper**: "Codified Context: Infrastructure for AI Agents in a Complex Codebase"
- **arXiv**: https://arxiv.org/abs/2602.20478 (published February 2026, 3 days ago)
- **Empirical validation**: 283 development sessions, 108,000-line C# codebase.

**Three-tier model**:

1. **Hot Memory (Constitution)** — Always loaded. Contains conventions, retrieval hooks, and orchestration protocols. This is CLAUDE.md — but kept minimal (only things the agent cannot infer from code).

2. **Domain-Expert Agents (19 of them)** — Invoked per-task. Each agent is specialized for a domain (e.g., database layer, plugin system, web frontend). They load task-specific context without polluting the main conversation.

3. **Cold Memory (34 Specification Documents)** — On-demand retrieval. Detailed architectural specs, interface contracts, plugin integration guides. These are the "knowledge base" — loaded only when relevant.

**Key finding**: "Agents operating in complex, bug-prone domains produced significantly more errors without pre-loaded context, consistent with the brevity bias phenomenon." — This validates the need for structured context infrastructure, not just a big CLAUDE.md.

**Practical mapping for this project**:
- Hot memory = minimal CLAUDE.md (conventions only, not file-by-file docs)
- Domain agents = `.claude/agents/plugin-expert.md`, `.claude/agents/orchestrator-expert.md`
- Cold memory = `.claude/skills/plugin-architecture/SKILL.md`, `.claude/skills/web-integration/SKILL.md` — auto-generated from code

---

### 6. Anthropic's Official Guidance on CLAUDE.md

Source: https://code.claude.com/docs/en/best-practices

Key recommendations directly relevant to this use case:

- **"Keep it concise. For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions."** — This is the core problem being solved.
- **CLAUDE.md can import additional files**: `@path/to/import` syntax. So CLAUDE.md can stay minimal and reference generated doc files.
- **Child directory CLAUDE.md files**: Place `CLAUDE.md` in each package directory — Claude pulls them in on demand when working with files in those directories. This is the per-package documentation pattern.
- **Skills for domain knowledge**: "For domain knowledge or workflows that are only relevant sometimes, use skills instead. Claude loads them on demand without bloating every conversation."
- **Subagents for codebase investigation**: "Delegate research with 'use subagents to investigate X'. They explore in a separate context."
- **Table of what NOT to include in CLAUDE.md**: "File-by-file descriptions of the codebase" is explicitly listed as something to EXCLUDE.

---

### 7. Git-Hook Based Documentation Update

No purpose-built tools found for "auto-update CLAUDE.md on commit." However, the pattern is achievable:

- **Claude Code PostToolUse hooks**: Fire after `git commit` via `Bash(git commit:*)` matcher. Can trigger documentation regeneration scripts.
- **Husky + lint-staged**: Pre-commit hooks can run TypeDoc, dependency-cruiser, and write output to docs files.
- **Repomix on commit**: `npx repomix --include "src/**/*.ts" --output docs/codebase-snapshot.md` in a post-commit hook generates a fresh snapshot.
- **GitHub Actions**: Most robust option for heavier regeneration tasks (TypeDoc JSON → AI summary via claude -p).

The missing piece is tooling that takes TypeDoc JSON + dependency-cruiser JSON and produces a human-readable architectural summary. This requires a small custom script (or a `claude -p` call in CI).

---

## Key Takeaways

1. **Serena is the single best MCP for this use case** — it provides live, LSP-backed symbol navigation over TypeScript/Node.js code. "What does the context plugin do?" becomes a direct symbol query, not a documentation lookup. No staleness possible.

2. **The CLAUDE.md problem has an official Anthropic answer**: Use `@imports` for generated docs, place package-level CLAUDE.md files, use skills for domain knowledge. The root CLAUDE.md should be 20-30 lines max.

3. **The three-tier hot/cold memory architecture** (from the Feb 2026 paper) is empirically validated and directly maps to Claude Code's CLAUDE.md + skills + subagents model.

4. **Repomix is the quickest path to auto-generated snapshots** — 22.1k stars, active, has official Claude Code plugins, and can be run on every commit to generate fresh context files.

5. **Context7 is not viable for private repos** without Enterprise cost. Use Qdrant MCP + TypeDoc pipeline instead to build an equivalent capability locally.

6. **Code-Graph-RAG and Serena are complementary**: Serena is fast (LSP-backed), Code-Graph-RAG is comprehensive (graph queries) but requires Docker infrastructure.

7. **Code Pathfinder is not yet usable** for TypeScript — Python only as of 2026.

---

## Sources

- Serena MCP: https://github.com/oraios/serena
- Claude Context (Zilliz): https://github.com/zilliztech/claude-context
- Code-Index-MCP: https://github.com/johnhuang316/code-index-mcp
- mcp-server-tree-sitter: https://github.com/wrale/mcp-server-tree-sitter
- Code-Graph-RAG: https://github.com/vitali87/code-graph-rag
- Code Pathfinder MCP: https://codepathfinder.dev/mcp | https://github.com/shivasurya/code-pathfinder
- Qdrant MCP: https://github.com/qdrant/mcp-server-qdrant
- Chroma MCP: https://github.com/chroma-core/chroma-mcp
- Repomix: https://github.com/yamadashy/repomix | https://repomix.com/guide/claude-code-plugins
- Context7 plans: https://context7.com/plans
- open-context7: https://github.com/rakuv3r/open-context7
- Sourcegraph MCP: https://sourcegraph.com/docs/api/mcp
- TypeDoc: https://typedoc.org/ | https://github.com/TypeStrong/typedoc
- typedoc-plugin-markdown: https://github.com/typedoc2md/typedoc-plugin-markdown
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser
- CTX context-hub: https://github.com/context-hub/generator
- Codebase Context Spec (archived): https://github.com/Agentic-Insights/codebase-context-spec
- Codified Context paper (arXiv): https://arxiv.org/abs/2602.20478
- Anthropic Claude Code best practices: https://code.claude.com/docs/en/best-practices
- PulseMCP tree-sitter entry: https://www.pulsemcp.com/servers/wrale-tree-sitter
- Code-Graph MCP (JudiniLabs): https://github.com/JudiniLabs/mcp-code-graph
