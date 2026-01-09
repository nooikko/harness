---
name: Agents Directory
type: documentation
category: agents
description: Sub-agent definitions organized by type and purpose with specific capabilities and tool restrictions
---

# Claude Code Agents Directory Structure

This directory contains sub-agent definitions organized by type and purpose. Each agent has specific capabilities, tool restrictions, and naming conventions that trigger automatic delegation.

## Directory Structure

```
.claude/agents/
├── README.md                    # This file
├── _templates/                  # Agent templates
│   ├── base-agent.yaml
│   └── agent-types.md
├── development/                 # Development agents
│   ├── backend/
│   ├── frontend/
│   ├── fullstack/
│   └── api/
├── testing/                     # Testing agents
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
├── architecture/                # Architecture agents
│   ├── system-design/
│   ├── database/
│   ├── cloud/
│   └── security/
├── devops/                      # DevOps agents
│   ├── ci-cd/
│   ├── infrastructure/
│   ├── monitoring/
│   └── deployment/
├── documentation/               # Documentation agents
│   ├── api-docs/
│   ├── user-guides/
│   ├── technical/
│   └── readme/
├── analysis/                    # Analysis agents
│   ├── code-review/
│   ├── performance/
│   ├── security/
│   └── refactoring/
├── data/                        # Data agents
│   ├── etl/
│   ├── analytics/
│   ├── ml/
│   └── visualization/
└── specialized/                 # Specialized agents
    ├── mobile/
    ├── embedded/
    ├── blockchain/
    └── ai-ml/
```

## Naming Conventions

Agent files follow this naming pattern:
`[type]-[specialization]-[capability].agent.yaml`

Examples:
- `dev-backend-api.agent.yaml`
- `test-unit-jest.agent.yaml`
- `arch-cloud-aws.agent.yaml`
- `docs-api-openapi.agent.yaml`

## Automatic Delegation Triggers

Claude Code automatically delegates to agents based on:
1. **Keywords in user request**: "test", "deploy", "document", "review"
2. **File patterns**: `*.test.js` → testing agent, `*.tf` → infrastructure agent
3. **Task complexity**: Multi-step tasks spawn coordinator agents
4. **Domain detection**: Database queries → data agent, API endpoints → backend agent

## Tool Restrictions

Each agent type has specific tool access:
- **Development agents**: Full file system access, code execution
- **Testing agents**: Test runners, coverage tools, limited write access
- **Architecture agents**: Read-only access, diagram generation
- **Documentation agents**: Markdown tools, read access, limited write to docs/
- **DevOps agents**: Infrastructure tools, deployment scripts, environment access
- **Analysis agents**: Read-only access, static analysis tools

## Persistent Memory Access

All agents have access to persistent memory via the `mcp-knowledge-graph` MCP:

**Available Tools:**
- `aim_search_nodes` - Search for relevant prior context
- `aim_create_entities` - Create new entities (concepts, patterns, decisions)
- `aim_add_observations` - Add facts to existing entities
- `aim_create_relations` - Link entities together
- `aim_read_graph` - View complete memory
- `aim_open_nodes` - Retrieve specific entities by name
- `aim_list_databases` - Check available databases and current location

**Storage Locations:**
- **Project**: `.aim/` directory (project-specific memory)
- **Global**: `~/.aim/` directory (cross-project memory)

**Usage Guidelines:**
1. Check memory at the start of tasks for relevant context
2. Store significant findings, patterns, and decisions
3. Use consistent entity naming for searchability
4. Memory persists across sessions and is shared between agents

## Doppler CLI for Secrets Management

Agents can use the Doppler CLI for secrets management. The CLI is pre-authenticated.

**Common Commands:**
```bash
# List projects
doppler projects

# List secrets in a config (names only)
doppler secrets --project athena --config prd --only-names

# Get a specific secret value
doppler secrets get SECRET_NAME --project athena --config prd

# Set a secret
doppler secrets set SECRET_NAME=value --project athena --config prd

# Run a command with secrets injected
doppler run --project athena --config prd -- your-command
```

**Available Projects:**
- `athena` - Main backend service
  - `dev_personal` - Local development config
  - `prd` - Production config (currently needs population)
- `metrics-bot` - Discord metrics bot

**Usage Guidelines:**
1. Always specify `--project` and `--config` flags
2. Use `--only-names` when listing to avoid exposing values
3. For production deployments, use `doppler run` to inject secrets at runtime