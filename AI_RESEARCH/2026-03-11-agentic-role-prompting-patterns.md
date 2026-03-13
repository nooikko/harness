# Research: Agentic Role Prompting — Autonomous Action vs Conversational

Date: 2026-03-11

## Summary

Role prompting for autonomous, tool-using agents requires a fundamentally different structure than conversational role prompting. The core shift: conversational roles define *personality*; agentic roles define *personality + capability set + operating procedures + action constraints*. Six major sources (Anthropic, OpenAI, CrewAI, OpenAI Realtime, Claude Skills, and empirical research) converge on a multi-section system prompt architecture that the identity plugin partially implements but can be extended.

## Prior Research

- `AI_RESEARCH/2026-01-12-ai-agent-prompt-design-best-practices.md` — foundational Anthropic/LangChain principles for research agents
- `AI_RESEARCH/2026-03-01-agent-identity-soul-memory-research.md` — identity, soul, and memory architecture

## Current Findings

---

### 1. The Core Structural Difference: Conversational vs Agentic Role Prompting

**Conversational role prompting** (single-turn or back-and-forth):
- One section: "You are a helpful [X]."
- System role establishes persona, tone, constraints.
- Model reacts to each user message independently.
- Role is purely *behavioral* — how to communicate.

**Agentic role prompting** (multi-step autonomous operation):
- Multiple sections required: identity, objective, tool use guidance, operating procedures, action constraints, safety gates.
- Role must encode BOTH persona AND capability set AND workflow.
- Model must know not just *who it is* but *what it does*, *when* to do it, *how* to sequence actions, and *when to stop*.

Source: Clarifai Blog "Agentic Prompt Engineering" (https://www.clarifai.com/blog/agentic-prompt-engineering):
> "In more advanced agentic systems, additional roles like tool_use, tool_result, and planner help organize reasoning and decision-making."
> "Agent prompts are far more detailed and serve as the main control mechanism for complex, goal-oriented, and interactive processes."

Source: APXML course on Agentic Workflows (https://apxml.com/courses/prompt-engineering-agentic-workflows/):
> "Standard prompts typically initiate a single-turn interaction aimed at a direct response, while agent prompts are designed to steer a potentially long-running, multi-step process where the AI must plan, act, and adapt."

**Confidence: HIGH** (multiple authoritative sources agree)

---

### 2. The Canonical Agentic System Prompt Architecture

Three independent frameworks converge on the same multi-section structure:

#### OpenAI Realtime API Template (official)
Source: https://developers.openai.com/cookbook/examples/realtime_prompting_guide

1. **Role & Objective** — who you are + what "success" means
2. **Personality & Tone** — voice, style, verbosity, warmth
3. **Context** — retrieved background information
4. **Tools** — names, usage rules, when to use/avoid, confirmation requirements
5. **Instructions/Rules** — do's, don'ts, edge case handling
6. **Conversation Flow** — phases, exit criteria, state machine
7. **Safety & Escalation** — thresholds for human handoff

#### OpenAI GPT-4.1 Agentic Template (official)
Source: https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide

Empirically tested — these three reminders increased SWE-bench performance by ~20%:

1. **Persistence instruction**: "You are an agent — please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user."
2. **Tool-calling guidance**: "If you are not sure about file content or codebase structure pertaining to the user's request, use your tools to gather the relevant information: do NOT guess or make up an answer."
3. **Planning instruction (optional, +4%)**: "You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls."

Recommended architecture: Role & Objective → Instructions (with subcategories) → Reasoning Steps → Output Format → Examples → Context

#### BrightCoding System Prompt Blueprint
Source: https://converter.brightcoding.dev/blog/system-prompts-for-ai-agents-the-complete-2026-guide-to-building-powerful-safe-autonomous-systems

8 sections for production agent prompts:
1. Role Definition & Scope (3–7 capability categories)
2. Structured Organization (XML or Markdown)
3. Tool Integration (TypeScript schemas + policies + examples)
4. Reasoning & Planning (mandatory thinking phases, error recovery, max 3 retries)
5. Environment Context (OS, directory, resource limits, network permissions)
6. Domain Expertise (tech stack preferences, style guides, anti-patterns)
7. Safety & Refusal (minimum 7 refusal categories)
8. Interaction Tone (verbosity rules, communication style consistency)

Key quote: "While a standard chatbot prompt might say 'You are a helpful assistant,' an agentic system prompt defines identity, tool usage, safety boundaries, iterative workflows, and domain-specific expertise in excruciating detail."

**Confidence: HIGH** (OpenAI empirical evidence; multiple sources agree on structure)

---

### 3. CrewAI Agent Definition Model — Role-Goal-Backstory Schema

Source: https://docs.crewai.com/en/concepts/agents

CrewAI's agent schema uses a three-field triad that acts as a "hyper-specialized system prompt":

| Field | Type | Agentic Purpose |
|-------|------|-----------------|
| `role` | str | Defines expertise domain and function; shapes how the agent approaches problems |
| `goal` | str | Specifies primary objective; guides decision-making and task prioritization |
| `backstory` | str | Provides personality/context; biases cognitive stance and vocabulary |
| `tools` | List[BaseTool] | Explicit capability set — what actions the agent can take |
| `max_iter` | int | Autonomy constraint — max attempts before providing best-effort answer (default: 20) |
| `reasoning` | bool | Enables pre-action reflection and execution planning |
| `allow_delegation` | bool | Permits task delegation to other agents |
| `code_execution_mode` | Literal | "safe" (Docker) or "unsafe" (direct) execution |

Three customizable templates control agent behavior:
- `system_template` — core behavior and system-level instructions
- `prompt_template` — input format
- `response_template` — output format

**Why these three fields?** Behind the scenes, CrewAI uses role + goal + backstory to construct the system prompt. The backstory "isn't fluff — it's a prompt engineering lever to bias the agent's behavior." A "Senior Research Analyst with 10 years at a journal" produces different output than a "Wikipedia Contributor" even with identical tasks.

Example from CrewAI:
```python
agent = Agent(
    role='Senior Financial Analyst',
    goal='Calculate intrinsic value using DCF analysis',
    backstory='You are a skeptical analyst who prioritizes cash flow over growth metrics',
    tools=[dcf_calculator, financial_data_tool],
    reasoning=True,
    max_iter=15
)
```

**Confidence: HIGH** (official CrewAI documentation)

---

### 4. Anthropic's Official Guidance on Tool-Using Agents

Source: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices

Key findings from the official Claude 4.6 best practices document (agentic systems section):

**On role definition:**
> "Setting a role in the system prompt focuses Claude's behavior and tone for your use case. Even a single sentence makes a difference."

**On action-taking vs suggestions (critical for agentic work):**
```
# Proactive agent (takes action by default):
<default_to_action>
By default, implement changes rather than only suggesting them. If the user's intent is unclear, infer the most useful likely action and proceed, using tools to discover any missing details instead of guessing.
</default_to_action>

# Conservative agent (confirms before acting):
<do_not_act_before_instructions>
Do not jump into implementation or change files unless clearly instructed to make changes. Default to providing information, doing research, and providing recommendations rather than taking action.
</do_not_act_before_instructions>
```

**On long-horizon agentic sessions:**
- Use context awareness prompts to prevent premature task termination
- Structure prompts with explicit persistence: "Never artificially stop any task early regardless of the context remaining."
- State tracking via structured JSON (test results, task status) + unstructured progress notes
- Use git for multi-session checkpointing

**On parallel tool use:**
```
<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies between the tool calls, make all of the independent tool calls in parallel.
</use_parallel_tool_calls>
```

**On safety for autonomous agents:**
```
Consider the reversibility and potential impact of your actions. For actions that are hard to reverse, affect shared systems, or could be destructive, ask the user before proceeding.
```

**On thinking for agentic work:**
> "After receiving tool results, carefully reflect on their quality and determine optimal next steps before proceeding. Use your thinking to plan and iterate based on this new information."

**On tool definition quality:**
> "Put yourself in the model's shoes. Is it obvious how to use this tool?" Treat tool definitions like writing "a great docstring for a junior developer on your team."

**On context engineering:**
From https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents:
> "organizing prompts into distinct sections (like `<background_information>`, `<instructions>`, `## Tool guidance`, `## Output description`)"
> "find the smallest set of high-signal tokens that maximize the likelihood of your desired outcome"
> System prompts should be "specific enough to guide behavior effectively, yet flexible enough to provide the model with strong heuristics" — avoid both brittle if-else logic and vague high-level guidance.

**Confidence: HIGH** (official Anthropic documentation, direct quote)

---

### 5. Role-as-Personality vs Role-as-Capability-Set

This is the central distinction for agentic prompting:

**Role-as-Personality** (conversational):
- "You are a Senior UX Designer" → outputs text that sounds like a designer
- Controls tone, vocabulary, and framing
- Evidence: role prompting research shows only modest accuracy improvements (~53.5% → 63.8% on math tasks with GPT-3.5); benefits are primarily stylistic

**Role-as-Capability-Set** (agentic):
- "You are a Senior UX Designer" must also encode:
  - WHICH tools to prefer (Playwright for visual review, accessibility checkers, design token tools)
  - HOW to approach tasks (research-first: audit existing patterns before designing; or build-first: prototype then iterate)
  - WHAT quality standards apply (WCAG 2.2 AA minimum, consistent spacing system, semantic HTML)
  - WHAT deliverables to produce (accessibility report, component inventory, design system tokens)
  - WHEN to take action vs. when to ask (make decisions autonomously within the design system; escalate if brand guidelines are ambiguous)
  - HOW to sequence a multi-step workflow (audit → identify patterns → propose changes → implement → verify)

Source: BrightCoding blueprint:
> "Autonomous agents require substantially more scaffolding: explicit agent loops with phases (Analyze → Select → Wait → Iterate → Submit → Standby), resource constraints, and approval gates for destructive actions."

Source: Claude Skills documentation (https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/):
Skills define capability via two mechanisms:
1. `allowed-tools` field — explicit tool permission list (e.g., `"Bash(git status:*),Bash(git diff:*),Read,Grep"`)
2. Instructional framing in Markdown content — imperative language that specifies workflow steps

Key quote from Skills architecture: "Persona emerges from task specification and available tool constraints" — the role is defined by what the agent CAN DO and MUST DO, not just what it is.

Source: Anthropic Building Effective Agents:
> Tool constraints define the contract between agents and their information/action space. "If humans can't definitively choose which tool to use, agents won't do better."

**Confidence: HIGH** (multiple independent sources; Skills architecture is Anthropic canonical)

---

### 6. Role-to-Action Mapping — Practical Patterns

How production systems encode "Senior UX Designer means use Playwright first":

**Pattern 1: Embedded constraints in tool descriptions (v0 system prompt style)**
Rather than telling the agent "as a designer, prefer Tailwind," encode it in tool definitions:
> "v0 ONLY uses icons from lucide-react"
> "v0 ALWAYS uses Tailwind CSS for styling"
Tool policies use exact conditions: "NEVER use this for..." and "ONLY use when..."

Source: BrightCoding blueprint, analyzing production v0 system prompt

**Pattern 2: Workflow phases in the role definition**
Define the agent's operating procedure as numbered phases:
```
## Operating Procedure

Phase 1 — AUDIT: Before any design work, use Playwright to capture screenshots of all
affected views. Review for spacing inconsistencies, color deviations from design tokens,
and accessibility violations.

Phase 2 — DIAGNOSE: Produce a structured findings report identifying (a) critical issues,
(b) moderate issues, (c) enhancement opportunities.

Phase 3 — IMPLEMENT: Address issues in priority order. Use design tokens exclusively.

Phase 4 — VERIFY: Re-capture screenshots and confirm all issues are resolved.
```

Source: OpenAI GPT-4.1 guide on agentic systems; Augment Code "11 prompting techniques" article

**Pattern 3: Explicit decision criteria**
```
## Decision Authority

You may make these decisions autonomously:
- Choosing between design token variants within the established palette
- Selecting component variants documented in the design system
- Fixing accessibility violations without confirmation

Always ask before:
- Introducing a new design pattern not in the system
- Changing spacing/grid fundamentals
- Modifying color tokens
```

Source: OpenAI building agents guide; HatchWorks design best practices

**Pattern 4: Research-first vs build-first framing**
```
## Approach

Default to RESEARCH-FIRST. Do not modify any files until you have:
1. Audited the existing implementation
2. Identified all affected components
3. Proposed a plan and received confirmation

Exception: accessibility violations with unambiguous fixes may be implemented directly.
```

Source: Anthropic Claude 4.6 best practices (`<do_not_act_before_instructions>` pattern)

**Confidence: HIGH** (Pattern 1 documented from production system; Patterns 2-4 consistent with all authoritative sources)

---

### 7. Long-Running Agent Session Patterns — Maintaining Role Coherence

**The problem: identity/behavioral drift**

Source: HuggingFace Forums research thread (https://discuss.huggingface.co/t/runtime-identity-drift-in-llms-can-we-stabilize-without-memory/152430):
> "Most multi-agent chains and LLM workflows suffer from role drift and behavioral collapse after a few hundred turns."

Reported causes: context windowing alone is insufficient; the model's coherence degrades as the context fills with tool calls and results, diluting the role definition in the initial system prompt.

**Pattern: Dual Injection (Anchor Pattern)**

This is what Harness's identity plugin implements. Key insight: a single system-prompt role definition at position 0 loses influence as context grows. The anchor at the bottom of the prompt context reinforces identity at the point where the model generates its response.

From `/Users/quinn/dev/harness/packages/plugins/identity/src/_helpers/format-identity-header.ts`:
```
[Header: soul + identity + memories] \n\n---\n\n [prompt] \n\n---\n\n [Anchor: core principle reminder]
```
The anchor: `> Before responding, briefly consider: given who you are as {name} and what you stand for, what is the right response here?`

**Pattern: SAGE Runtime Coherence Layer**

Source: HuggingFace discussion:
- Tracks three signals: Cr (coherence rating), ∆Cr (coherence change), RTR (return-to-role metric)
- Claims 3,000+ consecutive turns without identity collapse across 75 roles
- Operates as a state machine: Stable → Drift → Correction → Return → Stabilized
- Implementation not publicly released; evidence is community-reported

**Pattern: Context-Window State Management**

Source: Anthropic Claude 4.6 best practices (agentic systems section):
- Structured state files (JSON for task tracking, progress.txt for context)
- Git checkpoints for multi-session continuity
- "Claude's latest models are extremely effective at discovering state from the local filesystem"
- Use the first context window to set up framework (tests, setup scripts); subsequent windows iterate on todo-list

For a UX audit agent reviewing an entire application:
```
# Multi-Session Strategy
1. Session 1: Audit all screens, write audit-report.json with findings
2. Session 2: Review progress.json, continue from last_completed_section
3. Each session ends: write current findings to disk, commit to git

Never stop work mid-audit. If approaching context limit, write current state and stop cleanly.
```

**Pattern: Explicit Persistence Instruction**

Source: Anthropic Claude 4.6 best practices:
```
Your context window will be automatically compacted as it approaches its limit, allowing
you to continue working indefinitely from where you left off. Therefore, do not stop tasks
early due to token budget concerns. As you approach your token budget limit, save your
current progress and state to memory before the context window refreshes.
```

**Confidence: MEDIUM-HIGH** (Anthropic patterns are HIGH confidence; SAGE research is LOW confidence — community-reported without peer review)

---

### 8. Evidence on Role Prompting Effectiveness — Research Caveats

Source: PromptHub research review (https://www.prompthub.us/blog/role-prompting-does-adding-personas-to-your-prompts-really-make-a-difference)

**Role prompting works for:**
- Style and tone control (reliable improvement)
- Domain-specific vocabulary adoption
- Creative/open-ended tasks

**Role prompting is weak for:**
- Pure accuracy on reasoning tasks with newer models (GPT-4+ era): "personas in system prompts did not improve model performance" on factual questions
- Simple role labels ("You are a lawyer"): negligible improvement
- Some cases: role prompting *degrades* performance, especially with advanced models

**What actually works:**
- Domain-specific, detailed personas > simple role labels
- Auto-generated personas > human-written ones (per ExpertPrompting paper)
- Specific professional context > generic role name

**Key implication for agentic work:** Role prompting alone (the "personality" layer) does not reliably improve tool use or task execution quality. The critical additions for agentic roles are the operating procedure, tool constraints, and action authorities — not just the persona statement.

**Confidence: HIGH** (multiple peer-reviewed studies cited, including contrary evidence)

---

### 9. AutoGPT/LangChain Historical Patterns (Foundational Reference)

Source: LangChain AutoGPT documentation (https://api.python.langchain.com/en/latest/autonomous_agents/langchain_experimental.autonomous_agents.autogpt.agent.AutoGPT.html)

AutoGPT (2023, foundational for all subsequent agentic frameworks) used:
- `ai_name` parameter — agent identifier
- `ai_role` parameter — role description
- System prompt that instructs the model to produce JSON output with structured action fields
- Goal-oriented loop: perceive → reason → act → reflect
- Retrieval-based memory over intermediate steps using VectorStore

The key innovation: the system prompt defined not just the role but the **output format** (structured JSON with `action`, `action_input`, `thought` fields). This forced explicit planning and enabled parsing the agent's reasoning.

This JSON-structured approach became the basis for ReAct (Reasoning + Acting) prompting, now standard across all major frameworks.

**Confidence: HIGH** (official LangChain documentation)

---

## Key Takeaways

### The 6-Layer Agentic Role Definition

For any agent that takes autonomous actions, the role definition needs these layers:

1. **Identity** — who the agent is (persona, expertise, communication style)
2. **Objective** — what success looks like (goal, mission, deliverables)
3. **Capability Set** — which tools exist and when to use/avoid each
4. **Operating Procedure** — step-by-step workflow for the primary task type
5. **Decision Authority** — what to do autonomously vs. what requires confirmation
6. **Coherence Anchor** — a brief reinforcement at the end of the prompt to resist drift

Layers 1-2 exist in conversational prompting. Layers 3-6 are agentic-only.

### Specific Differences by Role Type

| Aspect | Conversational "UX Designer" | Agentic "UX Designer" |
|--------|------------------------------|----------------------|
| Identity | "You are a Senior UX Designer." | Same |
| Objective | Implicit — help with design questions | Explicit: "Audit this application, produce a WCAG-compliant design system, implement all changes" |
| Tools | None | Playwright (visual audit), accessibility checker, filesystem tools |
| Preferred tools | Not applicable | "Use Playwright before any implementation. Always verify visually." |
| Approach | React to questions | Research-first: audit before implementing |
| Decision authority | Not applicable | Explicit list of autonomous vs. escalation decisions |
| Quality standard | Implied by persona | Explicit: "WCAG 2.2 AA minimum, 4px grid, design tokens exclusively" |
| Long-session coherence | Not a concern | Anchor pattern + state file management |

### Gotchas and Warnings

1. **Tool descriptions are part of the role definition.** Anthropic and OpenAI both emphasize that tool definitions receive as much prompt engineering attention as the system prompt itself. The role is incomplete without the tool specification.

2. **Role prompting alone does not improve accuracy for reasoning tasks.** The research is clear: detailed, domain-specific operating procedures matter more than the persona label for tool-using agents.

3. **Agentic prompts need explicit persistence.** Without "keep going until complete" instructions, models prematurely yield control back to the user. OpenAI documents a ~20% performance improvement from adding three specific reminder types.

4. **Action/inaction must be explicitly controlled.** Anthropic documents two distinct system prompt patterns (`<default_to_action>` vs `<do_not_act_before_instructions>`) that produce fundamentally different agent behaviors. This is not implicit from the role.

5. **Long-running sessions require external state, not context-window solutions.** Role coherence over hundreds of turns requires structured state files, git checkpoints, and possibly a runtime coherence layer — not just a longer context window.

---

## Gaps Identified

- **Role-to-tool mapping in practice:** No official documentation from any framework provides a direct mapping between role type and tool preferences. This is currently encoded implicitly in tool descriptions or operating procedures. No formal schema for this mapping exists.
- **CrewAI design rationale source:** The specific academic/engineering justification for why role/goal/backstory was chosen over other schemas is not publicly documented; the rationale reconstructed from practitioner articles, not primary source.
- **SAGE coherence layer:** Not publicly released; only community-reported results available. Cannot verify claims.
- **Agentic role prompting research gap:** The empirical research on role prompting effectiveness (PromptHub synthesis) covers accuracy tasks and conversational settings, not tool-using autonomous agents specifically. No peer-reviewed study directly measures role prompt effectiveness on agentic benchmarks.

---

## Sources

### Authoritative (HIGH confidence)
- Anthropic Claude 4.6 Prompting Best Practices: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
- Anthropic Building Effective Agents: https://www.anthropic.com/research/building-effective-agents
- Anthropic Context Engineering for AI Agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- OpenAI GPT-4.1 Prompting Guide: https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide
- OpenAI Realtime Prompting Guide: https://developers.openai.com/cookbook/examples/realtime_prompting_guide
- CrewAI Agent Documentation: https://docs.crewai.com/en/concepts/agents
- Claude Code Skills Deep Dive: https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/
- LangChain AutoGPT Documentation: https://api.python.langchain.com/en/latest/autonomous_agents/langchain_experimental.autonomous_agents.autogpt.agent.AutoGPT.html

### Secondary (MEDIUM confidence)
- Clarifai Agentic Prompt Engineering: https://www.clarifai.com/blog/agentic-prompt-engineering
- BrightCoding Agent System Prompt Blueprint: https://converter.brightcoding.dev/blog/system-prompts-for-ai-agents-the-complete-2026-guide-to-building-powerful-safe-autonomous-systems
- PromptHub Role Prompting Research: https://www.prompthub.us/blog/role-prompting-does-adding-personas-to-your-prompts-really-make-a-difference
- Augment Code 11 Prompting Techniques: https://www.augmentcode.com/blog/how-to-build-your-agent-11-prompting-techniques-for-better-ai-agents
- HatchWorks AI Agent Design Best Practices: https://hatchworks.com/blog/ai-agents/ai-agent-design-best-practices/

### Tertiary (LOW confidence / community-reported)
- HuggingFace SAGE runtime coherence discussion: https://discuss.huggingface.co/t/runtime-identity-drift-in-llms-can-we-stabilize-without-memory/152430
- Lakera Agentic AI Threats: https://www.lakera.ai/blog/agentic-ai-threats-p1
