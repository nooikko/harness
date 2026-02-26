# Research: Dynamic Tool Discovery and Intent-Based Routing in AI Agent Systems
Date: 2026-02-25

## Summary

Five major AI agent systems were analyzed for how they handle dynamic command/tool discovery and intent-based routing. The clear consensus in 2025-2026 is that **structured tool_use/function-calling API is strongly preferred over system prompt text injection** for reliability. Every production system (Claude Code CLI internally, OpenAI Agents SDK, Claude Agent SDK, LangGraph) uses structured API-level tool registration as the primary mechanism. Text-based slash command parsing is acknowledged as fragile and used only at the outermost interface layer (the human-facing UI), never for internal tool invocation. This has direct implications for the harness orchestrator's current approach of parsing `/command` strings from Claude CLI output.

## Prior Research

- `/mnt/ramdisk/harness/AI_RESEARCH/2026-02-24-claude-cli-streaming-cold-start.md` — Claude CLI subprocess architecture, no daemon mode
- `/mnt/ramdisk/harness/AI_RESEARCH/2026-02-24-anthropic-api-low-latency-chat.md` — Direct SDK alternatives to CLI
- `/mnt/ramdisk/harness/AI_RESEARCH/2026-02-22-claude-code-ecosystem-state.md` — Claude Code ecosystem overview

## Current Findings

---

### 1. Claude Code CLI — How Tools and Skills Are Discovered

**Sources:** Official Claude Code skill documentation, Piebald-AI reverse-engineered system prompts repository, Claude Agent SDK slash-commands documentation

**Discovery mechanism (Confidence: HIGH):**

- Claude Code internally represents skills and built-in tools as a **structured meta-tool called "Skill"** registered in the API `tools` array. The `description` field of this meta-tool aggregates all available skill descriptions.
- Core built-in tools (Bash, Read, Write, Edit, Glob, Grep, Task, WebSearch, WebFetch) are registered as **formal `tool_use` API entries** — they are not described as text in the system prompt alone. The system prompt contains usage *guidance* but the actual tool schema is sent via the structured API parameter.
- Skills discovered from `.claude/skills/`, `~/.claude/skills/`, project directories, and plugins have their **names, descriptions, and `when_to_use` metadata aggregated into the Skill meta-tool's description text**, which then goes into the `tools` array.
- Full skill content (the SKILL.md body) is **only loaded on demand** — it is NOT in the system prompt by default. Only descriptions are in context.
- There is a character budget for skill descriptions: `2%` of context window, fallback `16,000 characters`. Skills beyond the budget are excluded silently.

**Invocation mechanism (Confidence: HIGH):**

- When Claude decides to use a skill, it emits a structured `tool_use` block (type: `tool_use`, name: `Skill`, input: `{command: "skill-name", args: "..."}`) via the API.
- This is not parsed from text — it is a native API-level tool call that Claude Code's runtime intercepts and routes.
- For slash commands entered by humans in interactive mode: the CLI detects the `/` prefix in user input BEFORE sending to the API, loads the skill content, and injects it into the prompt. This is a pre-processing step, not something Claude does.
- For the Claude Agent SDK's `query()` function: slash commands sent as `prompt: "/compact"` are processed by the subprocess before the model sees them — they are **not** parsed from Claude's output.

**Hybrid system prompt injections (Confidence: HIGH):**

- The system prompt does contain extensive tool *descriptions* (the Piebald-AI repo documents 28+ tool descriptions, some spanning 1000+ tokens), but these function as rich usage guidance, not as the sole registration mechanism.
- The pattern is: tool schema in `tools[]` array (formal registration) + verbose description in system prompt (usage guidance). Both are present simultaneously.

**Failure modes:**
- If skill descriptions exceed the character budget, Claude never learns they exist — silent exclusion. No error is raised.
- Vague skill descriptions cause Claude to not invoke the skill when it would be relevant (pure semantic matching failure).
- `disable-model-invocation: true` must be set explicitly for skills that should only be triggered by human `/command` input — without it, Claude may trigger side-effectful skills (deploy, commit) autonomously.

---

### 2. OpenAI Agents SDK

**Sources:** Official OpenAI Agents SDK documentation at `openai.github.io/openai-agents-python/tools/`

**Discovery mechanism (Confidence: HIGH):**

- Tools are registered exclusively via **JSON Schema function calling** — the Python SDK uses `@function_tool` decorators (or `betaZodTool`/`betaTool` in TypeScript equivalents) that use `inspect` + Pydantic to auto-generate the JSON schema.
- The generated schema goes into the standard `tools` parameter of the API request. There is no system prompt injection of tool descriptions.
- Agents can be used as tools: `Agent.as_tool()` exposes a sub-agent as a callable tool, which gets registered in the parent agent's `tools[]` list as a schema entry.
- MCP servers are integrated through the same tool-calling interface — they appear to the agent as function-calling tools.

**Invocation mechanism (Confidence: HIGH):**

- The SDK runs a built-in agent loop: send request → model returns `tool_use` block → SDK invokes the function → result returned as `tool_result` → loop continues until no more `tool_use` blocks.
- The invocation is fully structured. Arguments arrive as JSON strings to the `on_invoke_tool` handler. No text parsing.
- Tool responses can be text, images, files, or structured JSON (stringified).

**Failure modes (Confidence: MEDIUM — from community and docs):**

- Wrong tool selection when tools have similar names or descriptions — mitigated by meaningful namespacing (`github_list_prs` vs `slack_list_channels`).
- Incorrect parameters for complex tools with nested schemas — mitigated by `input_examples` in tool definitions.
- The model may emit a `tool_use` block with an incorrect tool name if the tool list is very large — mitigated by tool search (on-demand loading) rather than registering all tools upfront.
- If a tool throws an exception, the SDK catches it and returns `is_error: true` in the tool result; the model sees the error and typically retries with correction.

---

### 3. Anthropic Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

**Sources:** Official documentation at `platform.claude.com/docs/en/agent-sdk/`, slash-commands doc, overview

**Important clarification (Confidence: HIGH):**

- The Claude Agent SDK is the renamed Claude Code SDK. It still spawns the `claude` binary as a subprocess. It is NOT a direct Anthropic Messages API wrapper. The subprocess manages its own tool loop internally.
- The SDK's `allowedTools` option is a whitelist that the subprocess enforces — it does not change the internal tool registration mechanism.

**Discovery mechanism (Confidence: HIGH):**

- Built-in tools (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion, Task) are pre-registered inside the Claude Code subprocess via its internal structured `tools[]` system. The caller doesn't need to define them.
- Custom tools are exposed via MCP servers: `mcpServers` option in the SDK or `createSdkMcpServer()` for in-process MCP. MCP tools appear to the subprocess as additional structured `tool_use` entries.
- Slash commands (e.g., `/compact`, `/clear`, custom SKILL.md commands) are listed in the `system.subtype == "init"` message's `slash_commands` field when a session starts — this is the SDK's way of advertising available commands to the orchestrating code.
- Custom slash commands defined in `.claude/commands/` or `.claude/skills/` are automatically discovered by the subprocess at startup when `settingSources: ['project']` is enabled.

**Invocation mechanism (Confidence: HIGH):**

- Slash commands sent via the SDK as prompt strings (e.g., `prompt: "/compact"`) are intercepted by the subprocess before the model sees them. The subprocess handles them directly, not via model output parsing.
- Built-in tools are invoked by the model via structured `tool_use` blocks — the subprocess handles all tool execution; the SDK consumer just streams the resulting messages.
- Agents (subagents) are invoked via the `Task` tool, which is itself a structured `tool_use` entry.

**Failure modes (Confidence: HIGH):**

- The subprocess still has the cold-start overhead (~12s for initial spawn, ~2-3s for warm subprocess reuse in streaming input mode). This is not a discovery failure but an architectural constraint.
- If `allowedTools` does not include a needed tool, Claude will attempt to use it, the subprocess will block it, and Claude may loop or return an incomplete response.
- MCP server connection failures cause tool discovery to silently fail for that server's tools — no built-in retry.

---

### 4. LangChain / LangGraph

**Sources:** Official LangChain docs, community analysis of `create_react_agent` vs `create_tool_calling_agent`, Medium comparison articles, GitHub issues

**Two distinct approaches (Confidence: HIGH):**

**Approach A: ReAct (text-based, legacy)**

- Tool descriptions are injected into the system prompt as text: `"You have access to the following tools: [tool_name]: [description]"`.
- The LLM is prompted to output its response in the format `Action: tool_name\nAction Input: {args}`.
- The agent framework uses **regex parsing** to extract the action and arguments from the text output.
- `ReActJsonSingleInputOutputParser` attempts to parse the output — if the format is wrong, it fails.

**Approach B: `create_tool_calling_agent` (structured, recommended as of 2025)**

- Tools are registered via `bind_tools(tools)` on the model — this sends tool schemas via the standard function-calling API parameter.
- The LLM returns structured `tool_calls` in its response (not text that needs parsing).
- LangGraph routes `tool_calls` to the appropriate tool node automatically.
- LangGraph is the recommended production architecture as of 2025, replacing bare LangChain agents.

**Failure modes — ReAct text parsing (Confidence: HIGH):**

- Regex fails if the LLM formats its output differently than expected (e.g., adds commentary between Action and Action Input).
- Model updates can silently change output formatting, breaking the regex without warning.
- JSON embedded in tool arguments is particularly fragile — the agent parses a string that must itself be valid JSON, and markdown code fences in the output break naive parsing.
- Tool hallucination: the model may invent a tool name that doesn't exist; the regex matches a non-existent tool name, the dispatcher fails, and the loop breaks.
- There is no schema validation of tool arguments — the model can pass incorrect types silently.

**Failure modes — function calling approach (Confidence: HIGH):**

- Wrong tool selection when two tools have similar descriptions — less fragile than text parsing but still possible.
- The model generates a `tool_call` with a wrong argument type — caught by Pydantic validation in the tool runner but requires proper schema definition.
- Loss of interpretability: the model's reasoning is internal, not externalized in text, so debugging wrong tool choices is harder than with ReAct's explicit "Thought:" trace.
- In LangGraph, if a tool node throws an exception and error handling is not configured, the graph can halt permanently.

**2025 consensus (Confidence: HIGH):**

- LangChain's own team recommends `create_tool_calling_agent` over `create_react_agent` for all production use cases.
- LangGraph is preferred over bare LangChain agents for stateful, multi-step workflows.
- ReAct is retained only for models that don't support native function calling.

---

### 5. The General Pattern — Cross-Industry Consensus

**Sources:** Anthropic's implement-tool-use docs, Agenta.ai structured output guide, GitHub NeMo issue #1308, production reliability analysis

**The universal architecture (Confidence: HIGH):**

All production systems converge on the same three-layer architecture:

```
Layer 1: Registration
  → Tools defined as JSON schemas in the API `tools[]` parameter
  → Descriptions inform tool selection; schemas enforce argument structure
  → Tool names use meaningful namespacing to prevent ambiguity

Layer 2: Selection
  → LLM sees tool schemas, decides which tool to invoke
  → Returns structured `tool_use` block (name + typed arguments)
  → No text parsing by the system — pure API-native response

Layer 3: Invocation + Loop
  → System executes the indicated tool with validated arguments
  → Result returned as `tool_result` message
  → Loop continues until no `tool_use` block or max turns reached
```

**System prompt injection vs. structured tool_use:**

| Dimension | System Prompt Injection | Structured tool_use API |
|-----------|------------------------|------------------------|
| Reliability | LOW — regex fragility, format drift | HIGH — API-enforced structure |
| Argument validation | None — model can pass anything | JSON schema validation |
| Model updates | Can silently break parsing | Schema is version-independent |
| Token efficiency | Descriptions burn context | Schemas are compact, deduplicated |
| Debugging | Hard — parsing errors are opaque | Clear — wrong tool visible in API response |
| Tool hallucination | HIGH — model can invent names | LOW — constrained to registered names |
| Parallel invocation | Not possible | Native (multi tool_use in one response) |
| Official support | Community workaround | First-class API feature |

**When is system prompt injection still appropriate (Confidence: HIGH):**

- For models that do NOT support function calling (open-source models without tool_use fine-tuning).
- For usage *guidance* alongside formal tool schemas — combining both gives reliability + rich usage examples.
- Never as the sole mechanism in production systems where reliability matters.

**Anthropic's official guidance on tool descriptions (Confidence: HIGH, direct quote):**

> "Provide extremely detailed descriptions. This is by far the most important factor in tool performance. Your descriptions should explain every detail about the tool, including what the tool does, when it should be used (and when it shouldn't), what each parameter means, and any important caveats or limitations."
>
> — Anthropic tool_use implementation docs, `platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use`

**On system prompt construction:**

> "When you call the Claude API with the tools parameter, the API constructs a special system prompt from the tool definitions, tool configuration, and any user-specified system prompt."
>
> — Same source

This confirms the hybrid: the API internally converts the `tools[]` schema into text that goes in the system prompt, but this is done by the API infrastructure — not by the application developer writing raw text.

---

### 6. The Harness's Current Approach vs. Industry Practice

**What the harness currently does (from source code analysis):**

- The orchestrator spawns `claude -p <prompt>` (CLI child process).
- The CLAUDE.md system prompt instructs the model to emit slash commands as text in its response (e.g., `/delegate <prompt>`).
- The orchestrator's `parseCommands()` function uses regex to extract `/command args...` and `[COMMAND type="..."]` blocks from the raw text output.
- Plugin handlers are registered under command names and dispatched when a matching command is parsed from the text.

**How this compares to industry practice:**

- This is the **text injection + text parsing** approach — the pattern that every major production system has moved away from by 2025.
- It is equivalent to LangChain's deprecated ReAct text parsing, which LangChain itself recommends replacing.
- Failure modes that apply directly to the harness:
  1. Claude may change its output format across model versions, breaking regex silently.
  2. Arguments to commands (especially multi-line `/delegate` prompts) can contain characters that confuse the parser (quotes, newlines, markdown).
  3. If Claude wraps a command in a code block (backticks), the parser will miss it.
  4. The `/command` syntax bleeds into user-visible output — the CLAUDE.md says "commands are stripped from the user-visible response" but this depends on correct parsing.
  5. There is no argument type validation — a plugin receives raw strings.
  6. Claude cannot invoke multiple commands atomically — it would need to emit multiple text lines, each of which must be parsed separately.
  7. If Claude decides to discuss a command rather than emit it (e.g., "I would run /delegate here..."), the parser incorrectly fires.

- The **correct industry pattern** for the harness use case would be to register harness commands (delegate, cron_create, etc.) as structured `tool_use` entries in the Claude API request. The model would return a `tool_use` block instead of a text line, which the harness framework would route to the appropriate plugin.

- **Constraint:** Because the harness uses the Claude CLI (not the direct API), the structured `tool_use` approach is only available via MCP (Model Context Protocol) servers — MCP is the mechanism by which Claude CLI exposes custom tools as structured entries. This is already supported by the Claude Code ecosystem.

---

## Key Takeaways

1. **Structured tool_use/function-calling is universally preferred** over system prompt text injection for production reliability. Every major system (OpenAI Agents SDK, Anthropic Claude Agent SDK, LangChain/LangGraph) uses it as the primary mechanism.

2. **Claude Code CLI uses structured tool_use internally.** The `Skill` meta-tool is a registered API-level tool. Built-in tools (Bash, Read, etc.) are formal `tool_use` entries. Text descriptions in the system prompt are guidance, not registration.

3. **Text-based slash command parsing from CLI output has documented failure modes:** regex fragility across model versions, argument parsing breaks with complex content, tool hallucination risk, no schema validation, no parallel invocation, and silent format-drift bugs.

4. **The harness's current mechanism is the legacy approach.** It is functional for simple cases but scales poorly and has reliability risks that grow with the number and complexity of commands.

5. **MCP is the bridge.** Since the harness uses the Claude CLI (not the direct API), exposing harness commands as MCP tools is the correct path to structured tool invocation. Claude CLI has native MCP support. The `@anthropic-ai/claude-agent-sdk`'s `createSdkMcpServer()` demonstrates this pattern.

6. **For the harness specifically:** the most reliable approach to intent routing is to define each orchestrator action (delegate, cron_create, etc.) as an MCP tool with a JSON schema, register the MCP server with the Claude CLI subprocess, and let Claude invoke them via structured `tool_use` blocks rather than text commands. This eliminates all text-parsing failure modes.

---

## Gaps Identified

- No official Anthropic documentation explicitly documents the internal `Skill` meta-tool's wire format in the API request — this was inferred from reverse-engineered system prompts (Piebald-AI repo) and the Claude Code skill documentation.
- The exact behavior when the harness's `parseCommands()` regex encounters edge cases (e.g., Claude wrapping commands in code blocks) has not been tested empirically.
- How LangGraph handles tool invocation failures in graph nodes when no error handler is configured is documented in community sources only (MEDIUM confidence).
- Quantitative comparison of tool selection accuracy (structured vs. text parsing) — no controlled benchmarks found in official sources, only qualitative assessments.

---

## Recommendation (Research-Only)

Based on the evidence:

- **System prompt injection is documented as inferior** to structured tool_use for all dimensions that matter in production: reliability, validation, debuggability, and parallel invocation support.
- **The correct direction for the harness** is to move orchestrator commands from text-parsed slash commands to MCP-registered tools. This aligns with the Claude Code ecosystem's own internal architecture (the `Skill` meta-tool pattern) and with every other production agent framework reviewed.
- **The current text-parsing approach is acceptable as a transitional mechanism** but is not recommended as the long-term architecture for adding new commands or capabilities.
- **LangChain's migration from ReAct to `create_tool_calling_agent`** provides a direct precedent for this transition — the pattern, failure modes, and benefits are well-documented.

---

## Sources

- [Claude Code Slash Commands / Skills documentation](https://code.claude.com/docs/en/slash-commands)
- [Claude Agent SDK — Slash Commands in the SDK](https://platform.claude.com/docs/en/agent-sdk/slash-commands)
- [Claude Agent SDK — Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Anthropic — How to implement tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Anthropic — Advanced tool use engineering blog](https://www.anthropic.com/engineering/advanced-tool-use)
- [Piebald-AI — Claude Code System Prompts (reverse-engineered)](https://github.com/Piebald-AI/claude-code-system-prompts)
- [OpenAI Agents SDK — Tools documentation](https://openai.github.io/openai-agents-python/tools/)
- [OpenAI — Function calling documentation](https://platform.openai.com/docs/guides/function-calling)
- [LangChain — Agents documentation](https://docs.langchain.com/oss/python/langchain/agents)
- [Lee Han Chung — Claude Agent Skills: A First Principles Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Medium — create_react_agent vs create_tool_calling_agent](https://medium.com/@anil.goyal0057/understanding-langchain-agents-create-react-agent-vs-create-tool-calling-agent-e977a9dfe31e)
- [Agenta.ai — Guide to structured outputs and function calling](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [GitHub NeMo-Agent-Toolkit Issue #1308 — ReAct should send tool schemas](https://github.com/NVIDIA/NeMo-Agent-Toolkit/issues/1308)
- [Medium — How Tools Are Called in AI Agents (2025)](https://medium.com/@sayalisureshkumbhar/how-tools-are-called-in-ai-agents-complete-2025-guide-with-examples-42dcdfe6ba38)
