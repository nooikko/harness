# Documentation Pipeline & Internalized Context Research
*Date: 2026-02-26*
*Problem: CLAUDE.md too large; Claude loses awareness of plugin/orchestrator architecture as codebase grows*

## The Core Problem

Static context files (CLAUDE.md) have a fundamental scaling limit:
1. They load entirely into the context window even if 5% is relevant
2. They go stale as code evolves and require manual maintenance
3. They can't capture relationships ("how does the web plugin call the orchestrator?")
4. The more you add, the less useful individual entries become

The goal: something like "an internalized Context7 for this private repo" — queryable, code-derived, self-updating.

## Finding: No Single Drop-in Solution Exists

Auto-extraction of architectural relationships from TypeScript code does not have a production-ready MCP solution. The realistic answer is a **layered architecture** of 3–4 tools.

## Recommended Architecture (Four Layers)

### Layer 1: Structured Static Context (Fix Immediately, Zero Tooling)

Claude Code natively supports path-scoped rules in `.claude/rules/`:

```markdown
---
paths:
  - "packages/plugins/**/*.ts"
---
# Plugin Architecture Rules
(content only loaded when editing plugin files)
```

**Action: Split CLAUDE.md into `.claude/rules/` files:**
```
.claude/rules/
├── project-conventions.md   # Always loaded (no frontmatter) — conventions, commands only
├── orchestrator.md          # paths: apps/orchestrator/**
├── plugins.md               # paths: packages/plugins/**
├── web-app.md               # paths: apps/web/**
└── database.md              # paths: packages/database/**
```

This reduces always-loaded context to ~25 lines. Package-specific rules only load when Claude is editing in that package.

### Layer 2: Live Symbol Graph — Serena MCP

**[Serena](https://github.com/oraios/serena)** (20.7k stars, 120 contributors)

Uses the TypeScript Language Server (the same engine as VS Code) to give Claude live symbol navigation:
- `find_symbol`, `find_referencing_symbols`, `GetCodeMap`, `go_to_definition`
- Answers "what does the context plugin do?" from live code — never stale
- Answers "what calls sendToThread?" by querying the actual symbol graph

```bash
# .mcp.json addition:
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

This is the most powerful immediate win — Claude gets VS Code-level code understanding.

### Layer 3: Queryable Documentation — docs-mcp-server

**[docs-mcp-server](https://github.com/arabold/docs-mcp-server)** — the closest to "private Context7"

- Indexes local folders via `file://` prefix
- Exposes `search_docs` (hybrid vector + full-text)
- Processes Markdown, HTML, PDF, source code
- Runs entirely offline; nothing leaves the machine

**Use case:** Index `docs/`, `AI_RESEARCH/`, per-package READMEs. Claude calls `search_docs("how do plugins integrate with the orchestrator?")` instead of loading everything upfront.

```json
// .mcp.json
{
  "mcpServers": {
    "docs": {
      "command": "npx",
      "args": ["-y", "@arabold/docs-mcp-server"]
    }
  }
}
```

### Layer 4: Live Dependency Graph — depwire

**[depwire](https://glama.ai/mcp/servers/@depwire/depwire)** — tree-sitter parsed dependency graph

- `get_architecture_summary` — high-level module organization
- `impact_analysis` — what breaks if I change X?
- Real-time, no DB required
- Deterministic (not ML-based)

Also consider **[dependency-mcp](https://github.com/mkearl/dependency-mcp)** — uniquely adds architectural layer inference and boundary validation (can enforce "plugins never import from orchestrator").

## CI Pipeline: Auto-Generating Per-Package Context

For the "always up-to-date" requirement, a post-commit hook runs:

```bash
# .husky/post-commit
npx depcruise --output-type json apps packages \
  --exclude "node_modules|\.test\." > docs/module-graph.json

npx typedoc --json docs/api-model.json

node scripts/generate-context.ts
# Reads api-model.json + module-graph.json
# Writes packages/plugins/context/CLAUDE.md, apps/orchestrator/CLAUDE.md, etc.
# Each file: "This module exports: X, Y. It depends on: A. It is imported by: B."
```

**`scripts/generate-context.ts`** (~150 lines, custom build) is the missing piece — no off-the-shelf tool generates per-package CLAUDE.md from TypeDoc + dependency-cruiser output.

## Tool Comparison Matrix

| Need | Best Tool | Alternative | Custom Build? |
|------|-----------|-------------|---------------|
| CLAUDE.md too large | `.claude/rules/` path-scoped files | Per-package CLAUDE.md | No |
| "What does X do?" | Serena MCP (LSP) | code-index-mcp | No |
| "What calls X?" | Serena MCP | depwire | No |
| Queryable architecture docs | docs-mcp-server | Qdrant MCP | No |
| Dependency graph | depwire | dependency-mcp | No |
| Auto-update docs from code | TypeDoc + dependency-cruiser | Repomix | Scripts only |
| Per-package context generation | **Doesn't exist** | — | ~150 lines |
| Plugin responsibility extraction | **Doesn't exist** | — | Significant |

## What Doesn't Exist

- **Turborepo MCP** — open feature request, no implementation
- **pnpm workspace topology MCP** — nothing reads `pnpm-workspace.yaml`
- **Auto-extraction of architectural intent** — "the context plugin is responsible for X" cannot be derived from code alone; requires humans to write it or LLMs to summarize
- **Self-updating integration docs** — "how orchestrator → web plugin → database" requires manual authoring or an LLM summarization pipeline

## Implementation Priority

**This week (zero to low effort):**
1. Add Serena to `.mcp.json`
2. Create `.claude/rules/` directory, split CLAUDE.md by package
3. Add docs-mcp-server to `.mcp.json`, index `docs/` and `AI_RESEARCH/`

**Next sprint:**
4. Add depwire to `.mcp.json`
5. Write `scripts/generate-context.ts` (TypeDoc + depcruise → per-package CLAUDE.md)
6. Add post-commit hook to regenerate context files

**Later:**
7. Evaluate code-graph-rag if graph-based relationship queries are needed
8. Write per-package README.md files capturing architectural intent (feeds docs-mcp-server)

## Resources

- [Serena GitHub](https://github.com/oraios/serena)
- [docs-mcp-server GitHub](https://github.com/arabold/docs-mcp-server)
- [depwire on Glama](https://glama.ai/mcp/servers/@depwire/depwire)
- [dependency-mcp GitHub](https://github.com/mkearl/dependency-mcp)
- [code-graph-rag GitHub](https://github.com/vitali87/code-graph-rag)
- [Repomix Claude plugins](https://repomix.com/guide/claude-code-plugins)
- [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
