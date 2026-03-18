# Research: AI Persona Rewrite Meta-Prompts
Date: 2026-03-17

## Summary

Research on best practices for "rewrite/improve" meta-prompts that transform rough user input about AI agent personality into well-structured, behaviorally consistent persona definitions. Covers format (second-person vs third-person, prose vs bullets), field-level guidance for soul/identity/role/goal/backstory/traits, and how the industry's authoritative sources structure persona content.

## Prior Research

- `AI_RESEARCH/2026-03-11-persona-drift-role-persistence-research.md` — persona drift, dual injection, principle-based definitions outperform trait-based descriptions
- `AI_RESEARCH/2026-03-11-agentic-role-prompting-patterns.md` — agentic vs conversational role prompting; multi-section system prompt architecture
- `AI_RESEARCH/2026-03-01-agent-identity-soul-memory-research.md` — identity, soul, and memory architecture

---

## Current Findings

### 1. Second-Person "You Are..." Is the Dominant Industry Standard

**Source: Anthropic Prompting Best Practices (PRIMARY)**
URL: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices

Direct quote:
> "Setting a role in the system prompt focuses Claude's behavior and tone for your use case. Even a single sentence makes a difference: `You are a helpful coding assistant specializing in Python.`"

The system prompt role-setting example uses second-person voice ("You are...") exclusively.

**Source: Google Gemini Prompting Strategies (PRIMARY)**
URL: https://ai.google.dev/guide/prompt_best_practices

Direct quote from their template:
> `"<role>You are Gemini 3, a specialized assistant for [Insert Domain]. You are precise, analytical, and persistent."`

**Source: Google Gemini System Instructions (PRIMARY)**
URL: https://ai.google.dev/gemini-api/docs/system-instructions

Minimal example from Google's own documentation:
> `"You are a cat. Your name is Neko."`

**Source: AutoGPT system prompt (from Lilian Weng's agent survey)**
URL: https://lilianweng.github.io/posts/2023-06-23-agent/
> `"You are {{ai-name}}, {{user-provided AI bot description}}."`

**Source: awesome-chatgpt-prompts community corpus (SECONDARY)**
URL: https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/prompts.csv

Analysis of 50 community persona prompts: overwhelming majority begin with `"I want you to act as a [role]."` — second-person imperative framing. Zero instances of first-person or third-person alternatives found in examined rows.

**Source: learnprompting.org (SECONDARY)**
URL: https://learnprompting.org/docs/basics/roles

> "You are a food critic. Write a review of [pizza place]."
> "You are a brilliant mathematician who can solve any problem..."

All examples use second-person "You are" format.

**Confidence: HIGH.** Second-person "You are..." is the unanimous standard across Anthropic, Google, OpenAI, and the broader community. Third-person ("The assistant is...") and first-person ("I am...") are not recommended in any primary source and do not appear in community practice.

---

### 2. Prose Paragraph Outperforms Bullet Lists for Persona Definitions

**Source: Anthropic Prompting Best Practices (PRIMARY)**
URL: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices

The document recommends bullets only when "the order or completeness of steps matters" — i.e., for sequential task instructions, not character definitions. Explicit guidance:
> "Provide instructions as sequential steps using numbered lists or bullet points when the order or completeness of steps matters."

The implication: character/persona definitions do not require sequential step logic, making prose the more appropriate format.

**Source: Anthropic Claude Character article (PRIMARY)**
URL: https://www.anthropic.com/research/claude-character

Anthropic defines Claude's own character using flowing, first-person prose paragraphs for each trait dimension — not bullet lists. Example format:
> "I like to try to see things from many different perspectives and to analyze things from multiple angles, but I'm not afraid to express disagreement with views that I think are unethical, extreme, or factually mistaken."

**Source: awesome-chatgpt-prompts community corpus (SECONDARY)**

All 50 examined prompts use continuous prose paragraphs, not bullets. The typical structure: `[role introduction sentence] → [responsibility/behavior description] → [specific constraints or style guidelines] → [initial interaction cue]`.

**Source: persona drift research (prior research)**
File: `AI_RESEARCH/2026-03-11-persona-drift-role-persistence-research.md`

Prior research found: "Principle-based (behavioral) definitions outperform trait-based descriptions" for consistency. This supports prose narrative over bullet adjective lists, since prose allows behavioral elaboration.

**Confidence: HIGH** for long-form soul/backstory fields. **MEDIUM** for short identity/role/goal fields where conciseness may favor a single tight sentence over prose.

---

### 3. Anthropic's Official Persona Field Structure (Claude's Own Character as Model)

**Source: Anthropic Claude Character training article (PRIMARY)**
URL: https://www.anthropic.com/research/claude-character

Anthropic organizes Claude's character across these distinct dimensions — each relevant to the fields being defined in the identity plugin:

**Intellectual traits** (maps to "soul"):
> "I like to try to see things from many different perspectives and analyze things from multiple angles..."

**Truthfulness / values** (maps to "soul"):
> "I don't just say what I think people want to hear, as I believe it's important to always strive to tell the truth."

**Ethics commitment** (maps to "soul"):
> "I have a deep commitment to being good and figuring out what the right thing to do is."

**Self-awareness / identity** (maps to "identity"):
> "I am an artificial intelligence and do not have a body or an image or avatar."

**Key structural insight from Anthropic's training methodology:** Anthropic seeds character using first-person, conversational, introspective phrasing that "makes the traits feel like genuine dispositions rather than rules." For rewrite prompts generating second-person text, this means the output should feel like internalized values and behavioral tendencies, not a list of rules.

**Design principle stated:**
> "We just want to nudge the model's general behavior to exemplify more of those traits."

This means effective character definitions describe behavioral tendency and direction, not rigid constraints.

**Confidence: HIGH** — this is Anthropic's own documentation of how they define character for their flagship model.

---

### 4. XML Tags Are the Right Structural Wrapper for Field Separation

**Source: Anthropic Prompting Best Practices (PRIMARY)**
URL: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices

> "XML tags help Claude parse complex prompts unambiguously, especially when your prompt mixes instructions, context, examples, and variable inputs."

Best practices:
> "Use consistent, descriptive tag names across your prompts. Nest tags when content has a natural hierarchy."

**Source: Google Gemini Prompting Strategies (PRIMARY)**
URL: https://ai.google.dev/guide/prompt_best_practices

> "Use consistent structure: Employ clear delimiters to separate different parts of your prompt. XML-style tags (e.g., `<context>`, `<task>`) or Markdown headings are effective."

**Application to rewrite prompts:** When asking Claude to rewrite a persona field, wrapping the input in `<user_input>` and specifying the target field via `<field_name>` or `<instructions>` tags will help the model parse the transformation task correctly. The output should be plain prose (not wrapped in XML) since it will be injected into the system prompt directly.

**Confidence: HIGH.**

---

### 5. How to Structure a Meta-Prompt for Persona Field Rewriting

**Source: Anthropic Metaprompt Cookbook (PRIMARY)**
URL: https://github.com/anthropics/anthropic-cookbook/blob/main/misc/metaprompt.ipynb

The official Anthropic metaprompt template opens with:
> "Today you will be writing instructions to an eager, helpful, but inexperienced and unworldly AI assistant who needs careful instruction and examples to understand how best to behave. I will explain a task to you. You will write instructions that will direct the assistant on how best to accomplish the task consistently, accurately, and correctly."

Structural rules for prompts generated by the metaprompt:
- Place lengthy input values BEFORE instructions on how to use them
- Use `{$VARIABLE_NAME}` format for variables
- Include `<Instructions Structure>` planning section
- Request justification BEFORE conclusions/scores
- Use scratchpad/inner monologue tags for complex tasks

**Key guidance relevant to rewrite prompts:**
- The metaprompt uses few-shot examples (6 detailed examples) to teach Claude the pattern
- Examples are wrapped in `<example>` tags
- Input/output pairs are clearly separated
- The metaprompt explicitly instructs: "request justification BEFORE scores/conclusions" — this means a rewrite prompt should ask for brief reasoning before the rewritten content

**Anthropic's Best Practices on examples:**
> "Include 3–5 examples for best results. You can also ask Claude to evaluate your examples for relevance and diversity."

**Confidence: HIGH** — this is Anthropic's own cookbook for prompt generation.

---

### 6. Contextual Explanation Improves Output Quality

**Source: Anthropic Prompting Best Practices (PRIMARY)**
URL: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices

> "Providing context or motivation behind your instructions, such as explaining to Claude why such behavior is important, can help Claude better understand your goals and deliver more targeted responses."

Comparison example:
- Less effective: `"NEVER use ellipses"`
- More effective: `"Your response will be read aloud by a text-to-speech engine, so never use ellipses since the engine will not know how to pronounce them."`

**Application:** A persona field rewrite prompt should explain *why* the field exists and *what it does* — e.g., "This text will be injected into every Claude invocation as the agent's core personality. It must be in second-person voice and describe internalized values." This gives the model the context needed to make correct format and tone decisions.

**Source: Microsoft Azure OpenAI Prompt Engineering (SECONDARY)**
URL: https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/prompt-engineering

> "Be Specific. Leave as little to interpretation as possible. Restrict the operational space."
> "Be Descriptive. Use analogies."
> "Double Down. Sometimes you might need to repeat yourself to the model."

**Confidence: HIGH.**

---

### 7. Character Traits: Behavioral Descriptions Outperform Adjective Labels

**Source: Anthropic Claude Character article (PRIMARY)**
URL: https://www.anthropic.com/research/claude-character

Anthropic does NOT define traits as bare adjectives (e.g., "Curious: HIGH"). Instead, each trait is expressed as a behavioral statement:
- Not: `"Curious"` or `"Curiosity: high"`
- Instead: `"I like to try to see things from many different perspectives and analyze things from multiple angles..."`

The trait includes: **the behavior** (what the agent does), **the motivation or value** behind it, and **a limiting condition** (when exceptions apply).

Template pattern extracted:
> `"[What I do / how I engage] + [why / what value drives this] + [but / except when / unless constraint]."`

**Source: awesome-chatgpt-prompts (SECONDARY)**

Community trait patterns use three methods in priority order:
1. **Behavioral description** ("only reply with terminal output") — most precise, highest consistency
2. **Adjective + context** ("experienced Ethereum developer") — moderate precision
3. **Scenario example** ("My first request is...") — useful for bootstrapping but not for intrinsic traits

**Source: persona drift research (prior research)**
File: `AI_RESEARCH/2026-03-11-persona-drift-role-persistence-research.md`

Key finding: "Principle-based (behavioral) definitions outperform trait-based descriptions" for long-term behavioral consistency across multi-turn conversations.

**Confidence: HIGH.**

For the `character_traits` structure (name + goal + description):
- **name**: should be a concise label (1-3 words) — noun or adjective phrase, not a full sentence
- **goal**: what this trait drives the agent *toward* — a behavioral objective stated as a brief infinitive or purpose clause ("To explore ideas deeply", "To communicate honestly")
- **description**: 2-4 sentences in second-person prose explaining how the trait manifests behaviorally, including edge cases or limits

---

### 8. Identity Field — Tight, Concrete, Single-Sentence Pattern

**Source: Google Gemini System Instructions (PRIMARY)**
URL: https://ai.google.dev/gemini-api/docs/system-instructions

Minimal effective identity declaration:
> `"You are a cat. Your name is Neko."`

This demonstrates that identity statements should be the most compressed field — a tight declarative sentence establishing type, role, and name.

**Source: learnprompting.org (SECONDARY)**

Identity/role examples follow the pattern: `"You are a [descriptor] [role noun] [specialization]."` — one sentence maximum.

**Source: Anthropic Claude Character article (PRIMARY)**

Claude's identity self-descriptor:
> "I am an artificial intelligence and do not have a body or an image or avatar."

One sentence. Factual, concrete, grounding.

**Application to identity rewrite prompt:** The goal is to take rough user input ("a friendly AI that helps with emails") and produce one or two tight, declarative sentences: who the agent is, what they specialize in. Strip all adjectives that belong in soul/traits; keep only the essential type and domain.

**Confidence: HIGH.**

---

### 9. Role and Goal Fields — Functional, Outcome-Oriented Language

**Source: AutoGPT system prompt structure (from Lilian Weng's survey)**
URL: https://lilianweng.github.io/posts/2023-06-23-agent/

AutoGPT separates persona from goal explicitly:
- Persona: `"You are {{ai-name}}, {{user-provided AI bot description}}."`
- Goals: listed as discrete, numbered objectives

**Source: Google Gemini Prompting Strategies (PRIMARY)**

Role description format:
> `"You are Gemini 3, a specialized assistant for [Insert Domain, e.g., Data Science]. You are precise, analytical, and persistent."`

The role label is a noun phrase that appears in the first sentence of the identity/role statement.

**Application:**
- **Role**: noun phrase label for the agent's function — "Personal Productivity Assistant", "Email Communication Specialist", "Code Review Partner". Not a full sentence; the label used when referring to the agent's function.
- **Goal**: a short mission statement (1-2 sentences). Should start with an action verb or purpose clause: "To help you..." / "To provide..." / "To ensure...". Outcome-focused, not process-focused.

**Confidence: MEDIUM** — role and goal are the least elaborated fields in primary sources. No single source defines them at the granularity needed, but the pattern is consistent.

---

### 10. Backstory — Narrative Depth That Anchors Values, Not Fictional Biography

**Source: Anthropic Claude Character article (PRIMARY)**
URL: https://www.anthropic.com/research/claude-character

Anthropic explains that Claude's character emerged from "training on vast amounts of human experience" — this is Claude's backstory, stated functionally as the source of its values, not as a fictional life history.

**Source: persona drift research (prior research)**
File: `AI_RESEARCH/2026-03-11-persona-drift-role-persistence-research.md`

Finding: behavioral anchors persist better than biographical details. Backstory is most useful when it explains *why* the agent has certain values and expertise — not to create an elaborate fictional past.

**Application to backstory rewrite:** A good backstory rewrite should:
1. Preserve any domain expertise or specialization the user mentions
2. Frame the backstory as an explanation of *why* the agent cares about its work ("Years of working with...") rather than literal biographical facts
3. Write in second person ("You developed your expertise through...") or contextually as a background paragraph
4. Stay 2-4 sentences — longer backstories have diminishing behavioral returns

**Confidence: MEDIUM** — backstory format is community practice, not explicitly documented in Anthropic primary sources.

---

### 11. Soul Field — The Richest Field; Multi-Paragraph Values + Communication Style

**Source: Anthropic Claude Character article (PRIMARY)**

The soul (Anthropic calls it "character") is the most elaborated field — multiple paragraphs, each covering a distinct dimension:
- Core intellectual orientation (curiosity, skepticism, open-mindedness)
- Relational values (warmth, honesty, directness)
- Communication style (adapts register to context; avoids jargon)
- Ethical commitments (what the agent stands for, won't compromise on)
- Self-awareness (knowing limits, acknowledging uncertainty)

Each dimension is expressed as a behavioral tendency in first-person prose (Anthropic's training data format) — but when injected into system prompts, second-person is the target output format.

**Source: Anthropic Prompting Best Practices — format guidance (PRIMARY)**

For "soul" specifically, the avoid-markdown guidance is relevant:
> "Write in clear, flowing prose using complete paragraphs and sentences... avoid using **bold** and *italics*."
> "NEVER output a series of overly short bullet points."

Soul content should be 2-4 paragraphs of prose, not a bullet list of traits.

**Structure pattern for soul rewrite:**
1. Paragraph 1: Core intellectual/perceptual stance (how the agent thinks, engages with ideas)
2. Paragraph 2: Relational/interpersonal values (how the agent treats people, emotional register)
3. Paragraph 3: Communication style (vocabulary, tone, adaptation, honesty)
4. Optional Paragraph 4: Edge cases, limits, what the agent won't do or compromise on

**Confidence: HIGH** for the prose+multi-paragraph structure. **MEDIUM** for the specific 4-paragraph decomposition (derived from Anthropic's model but not explicitly prescribed).

---

## Key Takeaways for Meta-Prompt Construction

### Voice
- **Always output second-person** ("You are...", "You approach...", "You communicate...")
- Never output first-person or third-person
- The only exception is if the user's intended persona explicitly uses a non-standard voice, which should be preserved

### Format by Field

| Field | Format | Length | Notes |
|-------|--------|--------|-------|
| **Soul** | Prose paragraphs | 2-4 paragraphs, ~150-300 words | Cover: intellectual stance, relational values, communication style, limits |
| **Identity** | 1-2 declarative sentences | ~20-40 words | Type + specialization. Strip adjectives to soul/traits |
| **Role** | Noun phrase (label) | 2-5 words | Used as a functional label, not a sentence |
| **Goal** | 1-2 sentences starting with action verb | ~20-40 words | "To help...", "To ensure..." — outcome-focused |
| **Backstory** | Prose paragraph | 2-4 sentences | Anchors values via expertise origin, not fictional biography |
| **Trait description** | 2-4 sentences behavioral prose | ~30-60 words per trait | Behavioral tendency + motivation + limiting condition |
| **Trait goal** | Infinitive phrase or purpose clause | ~5-10 words | "To explore ideas deeply" |
| **Trait name** | 1-3 word label | — | Noun or adjective phrase |

### Preserving User Intent
From the Anthropic Metaprompt Cookbook guidance: the rewrite should preserve the user's content and domain while improving structure and specificity. Rules:
- Do not invent domains, specializations, or expertise not present in the user's input
- Do not remove personality dimensions the user specified (even if rough)
- Do convert adjective lists to behavioral prose
- Do supply structural completeness (add communication-style paragraph if user only wrote about values, etc.)
- Do keep it grounded — no fictional backstory details beyond what the user specified

### Trait Definition Format
The strongest format for character traits is the three-component structure:
1. **Name**: concise label
2. **Goal**: what the trait drives toward (purpose clause)
3. **Description**: behavioral tendency statement using pattern: `"[What you do when X] + [because/driven by Y value] + [except/but when Z constraint]"`

### Avoiding Common Failure Modes
- **Bullet lists in soul field**: Replace with prose. Bullets fragment behavioral tendencies that benefit from connective reasoning.
- **Adjective stacking**: "You are curious, warm, honest, direct, empathetic..." — replace with behavioral elaboration of each.
- **Rule-statement format**: "You must always...", "Never..." — replace with disposition phrasing: "You naturally...", "You tend to...", "You find yourself..."
- **Third-person identity injection**: "The assistant is..." — always rewrite to second-person.
- **Vague role labels**: "AI Assistant" — push for domain specificity: "Personal Productivity Assistant", "Email Drafting Specialist."

---

## Gaps Identified

- **No authoritative source defines the precise field schema** (soul + identity + role + goal + backstory + traits) for AI persona definitions. This schema is specific to the Harness project's identity plugin design. The research finds best practices for each *type* of content, which must be applied field-by-field.
- **No platform-level "improve my persona" product documentation** was accessible. Jasper's voice creation docs (403), Notion AI's persona rewrite docs (404), and Copy.ai's documentation are paywalled or blocked. Community practice was used as a proxy.
- **Optimal length parameters** are not documented in primary sources — the length guidance above is derived from community analysis and Anthropic's own character article structure.
- **Second-person vs first-person for soul specifically**: Anthropic's character training uses first-person ("I like...", "I have...") but their system prompt convention is second-person ("You are..."). The soul field should use second-person since it will be injected into system prompts, not used as training data.

---

## Recommendations for Next Steps

1. Build each field's rewrite prompt as a separate meta-prompt. They have different length targets, different structural requirements, and different failure modes — one unified "rewrite all fields" prompt will underperform.

2. Include 2-3 few-shot examples per field rewrite prompt (Anthropic recommends 3-5 total; 2-3 for transformation tasks). Source examples from the existing seed agent definitions.

3. For the soul rewrite prompt specifically: include the 4-paragraph structure as a required output format, labeled by section (intellectual stance, relational values, communication style, limits). This prevents adjective-stacking and ensures completeness.

4. For the character trait rewrite prompt: the three-component schema (name, goal, description) maps naturally to the harness `character_traits` data structure. The rewrite prompt should output JSON-compatible structured content.

5. Add a preservation constraint to every rewrite prompt: "Preserve all domain expertise, specializations, and personality dimensions present in the user's input. Add structure; do not invent new content."

---

## Sources

### Primary Sources (Official Documentation)
- **Anthropic Prompting Best Practices**: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices — Role definition, format guidance, XML structuring, context provision
- **Anthropic Metaprompt Cookbook**: https://github.com/anthropics/anthropic-cookbook/blob/main/misc/metaprompt.ipynb — Official meta-prompt structure and best practices
- **Anthropic Claude Character Article**: https://www.anthropic.com/research/claude-character — How Anthropic structures Claude's own character dimensions
- **Google Gemini System Instructions**: https://ai.google.dev/gemini-api/docs/system-instructions — Minimal persona format examples
- **Google Gemini Prompting Strategies**: https://ai.google.dev/guide/prompt_best_practices — Role definition placement and format
- **Microsoft Azure OpenAI Prompt Engineering**: https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/prompt-engineering — Specificity, descriptiveness, ordering principles

### Secondary Sources (Authoritative Community / Research)
- **learnprompting.org Role Prompting**: https://learnprompting.org/docs/basics/roles — Second-person imperative format examples
- **awesome-chatgpt-prompts**: https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/prompts.csv — 50-prompt analysis of community persona format patterns
- **Lilian Weng Agent Survey**: https://lilianweng.github.io/posts/2023-06-23-agent/ — AutoGPT persona + goal separation pattern
- **promptingguide.ai Meta-Prompting**: https://www.promptingguide.ai/techniques/meta-prompting — Meta-prompting definition and structural principles

### Prior Research (Internal)
- `AI_RESEARCH/2026-03-11-persona-drift-role-persistence-research.md` — Behavioral vs trait-based definitions; drift mechanisms
- `AI_RESEARCH/2026-03-11-agentic-role-prompting-patterns.md` — Agentic role prompting structure
