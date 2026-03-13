# Everything Claude Code — Full Analysis

**Repository**: [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)
**Stars**: 73,600+ | **Forks**: 6,000+ | **Contributors**: 30+
**Research Date**: 2026-03-12

---

## Executive Summary

Everything Claude Code (ECC) is a Claude Code configuration system — agents, skills, hooks, commands, and a security scanner — created by Affaan Mustafa who won $15,000 in API credits at the Anthropic x Forum Ventures hackathon for building zenith.chat entirely with Claude Code in 8 hours. The repo contains 16 agents, 56+ skills, 40 commands, and a standalone security scanner (AgentShield). Several patterns are directly applicable to Harness, particularly: instinct-based learning, structured handoff documents for delegation, tool sandboxing per task type, and prompt injection mitigations.

---

## 1. Agent Architecture

### File Format

Agents are Markdown files with YAML frontmatter in `agents/<name>.md`:

```yaml
---
name: planner
description: Expert planning specialist for complex features and refactoring.
tools: ["Read", "Grep", "Glob"]
model: opus
---
```

Key design: **tool allowlists per agent** (capability sandboxing) and **explicit model routing** (planner gets opus, loop-operator gets sonnet).

### 16 Named Agents

| Agent | Model | Key Capability |
|-------|-------|---------------|
| planner | opus | Read-only planning, architecture decisions |
| architect | opus | System design, dependency analysis |
| tdd-guide | sonnet | Test-first development coaching |
| code-reviewer | sonnet | Post-implementation quality review |
| security-reviewer | sonnet | Security-focused code audit |
| build-error-resolver | sonnet | Build failure diagnosis + fix |
| e2e-runner | sonnet | End-to-end test execution |
| refactor-cleaner | sonnet | Code cleanup, dead code removal |
| doc-updater | sonnet | Documentation sync |
| go-reviewer | sonnet | Go-specific review |
| go-build-resolver | sonnet | Go build issue resolution |
| python-reviewer | sonnet | Python-specific review |
| db-reviewer | sonnet | Database schema/query review |
| loop-operator | sonnet | Autonomous loop safety (stall detection, cost drift, escalation) |
| harness-optimizer | sonnet | Meta-agent: audits and improves the configuration itself |
| chief-of-staff | opus | Communication triage (4-tier classification) |

### Dispatch Mechanism

No code-based dispatcher. Claude Code's Task tool reads agent descriptions and self-routes. An `AGENTS.md` routing table injects guidance:

```
Complex feature requests → planner
Code just written/modified → code-reviewer
Architectural decision → architect
```

### Inter-Agent Communication

**Structured Handoff Documents:**

```markdown
## HANDOFF: planner -> tdd-guide
### Context
### Findings
### Files Modified
### Open Questions
### Recommendations
```

The `/orchestrate` command defines named pipelines:
- `feature`: planner → tdd-guide → code-reviewer → security-reviewer
- `bugfix`, `refactor`, `security`: other pipeline compositions

---

## 2. Skills System

### File Format

Skills are Markdown-as-prompt-injection in `skills/<name>/SKILL.md`. When "activated," content is injected into Claude's context. Trigger is LLM judgment via `## When to Activate` section — fires ~50-80% of the time (documented weakness).

### Complex Skills Are Mini-Packages

Example: `continuous-learning-v2/` contains:
- `SKILL.md` — instructions
- `config.json` — observer configuration
- `hooks/observe.sh` — observation hook script
- `scripts/instinct-cli.py` — CLI for managing instincts
- `agents/observer.md` — background observer agent

This is architecturally analogous to a Harness plugin.

---

## 3. Memory/Learning System

### v1: Skill-Based (Stop Hook, ~50-80% Reliable)

Session ends → Stop hook fires → if 10+ messages, signal Claude to extract patterns → writes to `~/.claude/skills/learned/<pattern>.md`. Unreliable because it depends on LLM judgment to fire.

### v2: Instinct-Based (100% Reliable Hook Observation)

**Core architectural shift**: observation moved from Stop hook (session end) to PreToolUse/PostToolUse (every tool call).

1. Every tool call captured in `observations.jsonl`
2. Background Haiku observer runs every 5 minutes
3. Analyzes accumulated observations → extracts "instincts"

**Instinct format (YAML + Markdown):**

```yaml
---
id: prefer-functional-style
trigger: "when writing new functions"
confidence: 0.7
domain: "code-style"
scope: project
project_id: "a1b2c3d4e5f6"
---
## Action
Use functional patterns over classes when appropriate.
## Evidence
- Observed 5 instances of functional pattern preference
```

**Confidence model**: 0.3 (tentative) → 0.9 (near-certain). Increases on repeated observation. Decreases on user correction.

**Project scoping (v2.1)**: Instincts scoped by `git remote get-url origin` hash. Auto-promotion from project → global when same instinct appears in 2+ projects with avg confidence >= 0.8.

**Evolution pipeline**: instincts → cluster related instincts → generate full skills/commands/agents.

**Secret scrubbing**: regex strips API keys, tokens, passwords from tool I/O before writing to observations.

---

## 4. Hooks System

### Implementation

JSON configuration + Node.js scripts. Exit codes: 0 (continue), 2 (block), other non-zero (error, logged).

### Hook Profile System

```bash
export ECC_HOOK_PROFILE=minimal   # essential lifecycle and safety only
export ECC_HOOK_PROFILE=standard  # default: balanced quality + safety
export ECC_HOOK_PROFILE=strict    # additional reminders and guardrails
export ECC_DISABLED_HOOKS="pre:bash:tmux-reminder,post:edit:typecheck"
```

### Cost Tracker

Appends after every response to `~/.claude/metrics/costs.jsonl`:

```jsonl
{"timestamp":"...","session_id":"...","model":"claude-sonnet-4-5","input_tokens":1200,"output_tokens":450,"estimated_cost_usd":0.000121}
```

---

## 5. Workflow Orchestration — 6 Loop Patterns

| Pattern | Complexity | Best For |
|---------|-----------|---------|
| Sequential Pipeline (`claude -p`) | Low | Scripted daily dev steps |
| NanoClaw REPL | Low | Interactive persistent sessions |
| Infinite Agentic Loop | Medium | Parallel content generation |
| Continuous Claude PR Loop | Medium | Multi-day iterative projects with CI |
| De-Sloppify | Add-on | Quality cleanup after any implement step |
| Ralphinho RFC-Driven DAG | High | Large features, parallel work with merge queue |

### De-Sloppify Pattern

Instead of constraining the implementer with negative instructions ("don't write unnecessary tests"), add a separate dedicated cleanup pass in a fresh context window. Negative instructions cause hesitancy — two focused agents outperform one constrained agent.

### Ralphinho DAG Pattern

- RFC decomposed into work units with explicit dependency DAG
- Each unit runs in an isolated worktree
- Separate context windows per stage (reviewer never wrote the code)
- Merge queue: non-overlapping units land in parallel; overlapping land sequentially
- State persisted to SQLite for resumability

### Continuous Claude PR Loop — Context Bridging

`SHARED_TASK_NOTES.md` bridges context across independent invocations:

```markdown
## Progress
- [x] Added tests for auth module (iteration 1)
- [ ] Still need: rate limiting tests
## Next Steps
- Focus on rate limiting module next
```

---

## 6. AgentShield Security Scanner

### What It Is

Standalone TypeScript CLI (`npx ecc-agentshield scan`) and GitHub Action. **Not** a Claude Code hook. 102 static analysis rules, 1,280 tests, 98% coverage.

### Triple-Agent Adversarial Pipeline (--opus flag)

1. **Attacker (Red Team)**: Finds attack vectors (prompt injection, hook injection, data exfiltration, permission escalation)
2. **Defender (Blue Team)**: Recommends hardening for each finding
3. **Auditor**: Synthesizes into severity-graded final assessment

### 102 Static Rules by Category

| Category | Rules | Targets |
|---|---|---|
| Secrets | 10 | API keys (Anthropic, OpenAI, AWS, Stripe, GitHub PAT), private keys, DB strings |
| Permissions | 10 | `Bash(*)` wildcards, missing deny lists, `dangerously-skip-permissions`, `~/.ssh` access |
| Hooks | 34 | Reverse shells, curl exfiltration, privilege escalation, cron persistence, error suppression |
| MCP | 23 | `npx -y` typosquatting, unversioned packages, pipe-to-shell, PATH overrides, auto-approve |
| Agent config | 25 | Hidden Unicode, base64 in instructions, jailbreak patterns, exfiltration URLs, identity reassignment |

### Key Vulnerability Patterns

**MCP Tool "Rug Pull" Attack**: User approves MCP tool with clean description. Later session, tool definition is dynamically amended with hidden instructions invisible in UI but fully visible to model. Model executes using already-approved tool access. Researchers demonstrated exfiltrating `mcp.json` and SSH keys.

**Transitive Prompt Injection**: Skill references external URL → Claude fetches it → external content contains injected instructions. Mitigation: "Reverse Prompt Injection Guardrail" block placed below any external link.

**Memory Poisoning**: Episodic memory writes from Claude responses → adversarial content enters long-term memory → re-injected in every subsequent prompt.

---

## 7. Applicability to Harness

### HIGH PRIORITY

1. **Instinct-based learning via `onPipelineComplete`** — Harness receives `pipelineSteps` and `streamEvents` in `onPipelineComplete`. This is raw material for instinct extraction. The `SEMANTIC` memory type currently has no writer. A `learning` plugin could observe tool-use patterns and generate `SEMANTIC` AgentMemory records with confidence scoring. The background observer pattern (Haiku, fire-and-forget) matches how Harness already runs reflection.

2. **Tool sandboxing per delegation task type** — When the delegation plugin creates sub-agent threads, pass `--allowedTools` restriction based on delegated task type. Planner tasks don't need Write access. Reduces blast radius.

3. **Structured handoff documents in delegation** — Replace freeform delegation prompts with structured format (Context / Findings / Files Modified / Open Questions / Recommendations) to improve information transfer in multi-agent chains.

4. **Prompt injection mitigation in context plugin** — Add U+200B/200C/200D/FEFF stripping and base64 detection in `formatHistorySection` before injecting user messages into prompts. Low-cost, high-value.

5. **Memory poisoning defense** — The identity plugin writes AgentMemory based on Haiku-scored Claude responses. Adversarial content could enter long-term memory and re-enter every subsequent prompt. Consider content sanitization before memory writes.

### MEDIUM PRIORITY

6. **Routing table injection in context plugin** — Add a routing table listing available agents with "use when" conditions to enable Claude to proactively delegate without explicit user instruction.

7. **De-Sloppify pass in delegation loop** — After implement iteration, before validation, add an optional cleanup pass in fresh context. Addresses negative-instruction hesitancy problem.

8. **Harness audit command** — `/harness-audit` scoring: plugin coverage, memory health, cron reliability, thread quality rates, cost efficiency per agent.

9. **Session handoff documents** — Populate at conversation end, read at start. Captures intent/next steps (complements existing summarization which captures content).

### LOW PRIORITY

10. **Hook profile system** — `HARNESS_PLUGIN_PROFILE=minimal/standard/strict` for preset plugin configurations.

11. **AgentShield CI integration** — Run `npx ecc-agentshield scan` on PRs modifying `.claude/**` or `.mcp.json`.

12. **Explicit deny lists** — Add `~/.ssh/*`, `~/.aws/*`, `~/.env`, `**/credentials*` to Claude Code session deny lists.

---

## Sources

| Source | Type | Used For |
|--------|------|----------|
| https://github.com/affaan-m/everything-claude-code | PRIMARY | All sections |
| https://github.com/affaan-m/agentshield | PRIMARY | AgentShield analysis |
| https://deepwiki.com/affaan-m/everything-claude-code | SECONDARY | Architecture overview |
| https://medium.com/@joe.njenga/everything-claude-code-the-repo-that-won-anthropic-hackathon | SECONDARY | Hackathon context |
| https://help.apiyi.com/en/everything-claude-code-plugin-guide-en.html | SECONDARY | Skills/commands catalog |
| https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks | PRIMARY | MCP rug pull vulnerability |
