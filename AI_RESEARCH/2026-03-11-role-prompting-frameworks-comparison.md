# Research: Role Prompting Frameworks — Comparative Analysis for Persistent Persona Establishment
Date: 2026-03-11

## Summary

This research compares eight named prompting frameworks (CO-STAR, RISE, CRAFT, RODES, BROKE, APE, STAR, CREATE) on their effectiveness for establishing persistent roles/personas in multi-turn LLM conversations. It also synthesizes empirical research on role/persona prompting effectiveness and Anthropic's current official guidance.

Key finding: No single framework was designed primarily for multi-turn role persistence. All frameworks treat role definition as a single-prompt concern. The empirical literature shows that persona prompting has inconsistent effects on accuracy tasks, performs well on style/tone tasks, and that elaborate auto-generated persona descriptions outperform simple "You are a [title]" assignments. Anthropic's own guidance as of 2026 treats heavy-handed role prompting as increasingly unnecessary for modern models, preferring explicit task framing instead.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-01-agent-identity-soul-memory-research.md` — covers structured identity formats (Generative Agents seed memory, MemGPT persona field, character.ai character card). Highly relevant: the field's answer to persistent persona is a structured natural-language identity document injected every session, not a one-time prompt framework.
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-01-12-ai-agent-prompt-design-best-practices.md` — covers agent prompt structure, Anthropic best practices, LangChain agent engineering. Relevant baseline.

---

## Current Findings

### Part 1 — Framework-by-Framework Analysis

---

#### CO-STAR (Context, Objective, Style, Tone, Audience, Response)

**Origin:** Developed by data scientist Sheila Teo; won Singapore's first GPT-4 Prompt Engineering competition. Popularized by GovTech Singapore.
**Source:** https://www.tech.gov.sg/technews/mastering-the-art-of-prompt-engineering-with-empower/ | https://vivasai01.medium.com/mastering-prompt-engineering-a-guide-to-the-co-star-and-tidd-ec-frameworks-3334588cb908

**Components:**
- C — Context: Situational background and business context
- O — Objective: Specific task definition
- S — Style: Communication style/voice (professional, casual, technical)
- T — Tone: Emotional register (empathetic, authoritative, warm)
- A — Audience: Who will read the output (expertise level, needs)
- R — Response format: Output structure (JSON, prose, bullets)

**Role establishment score: MEDIUM**
- CO-STAR is task-oriented, not persona-oriented. It has no explicit "Role" component.
- Style + Tone together approximate persona behavior without naming a role.
- Strong for controlling output characteristics per-turn. Not designed for persistent identity.
- The Audience component is the reverse of what we need — it describes the reader, not the writer.

**Multi-turn persistence: WEAK**
- Nothing in the framework addresses conversation continuity or role drift prevention.
- Works best as a system prompt template rather than per-turn prompting.

**Auto-generability from short input like "Senior UX Designer focused on modern world class design": MEDIUM**
- Style and Tone can be derived from the title; Context and Audience need additional specification.

---

#### RISE (Role, Instructions, Steps, Expectations)

**Note:** Multiple conflicting expansions exist. The most common is Role + Instructions + Steps + Expectations. Some sources use Role + Input + Steps + Expectations.
**Source:** https://lazaroibanez.substack.com/p/exploring-rise-risen-and-rodes-chatgpt | https://aipromptsx.com/prompts/frameworks/rise

**Components:**
- R — Role: Expert persona assignment ("Act as an expert digital course builder who has sold millions in online courses")
- I — Instructions: The specific task and constraints
- S — Steps: Context, background, limitations, examples
- E — Expectations: Guidelines aligning responses with desired outcomes

**Role establishment score: MEDIUM-HIGH**
- Role is an explicit first component; Steps provides space for depth/context.
- The framework is task-focused: Role is instrumental (to accomplish the task) rather than identity-defining (to persist as a character).
- RISEN variant adds Narrowing (constraints/limits), which helps scope the role's domain.

**Multi-turn persistence: WEAK**
- No explicit mechanism for persistence. Role is defined once per prompt.
- Documentation contains "no guidance on maintaining role persistence across multi-turn conversations."

**Auto-generability: HIGH**
- Role maps directly from a short input. Instructions, Steps, and Expectations can be templated.

---

#### CRAFT (Context, Role, Action, Format, Target audience)

**Source:** https://www.geeky-gadgets.com/craft-prompt-framework/ | https://bacoach.nl/2025/11/prompt-engineering-craft-framework/ | https://craftingaiprompts.org/documentation/framework

**Components:**
- C — Context: Background, purpose, situation
- R — Role: "Assign the LLM a specific role, such as 'technical writer,' 'marketing strategist,' or 'educator.'"
- A — Action: Specific task instructions
- F — Format: Output structure (list, essay, table, code block)
- T — Target audience: Who the output is for (adjusts language complexity and depth)

**Role establishment score: MEDIUM**
- Role is explicit. However, the role definition in CRAFT examples is minimal ("technical writer").
- Context provides space for elaboration.
- The framework is model-agnostic and explicitly works with Claude, ChatGPT, Gemini, Copilot.

**Multi-turn persistence: WEAK**
- Framework documentation makes no distinction between system-level and per-turn prompting.
- Not designed for conversational continuity.

**Auto-generability: HIGH**
- All five components can be template-generated from a short role description.

---

#### RODES (Role, Objective, Details, Examples, Sense-check)

**Source:** https://lazaroibanez.substack.com/p/exploring-rise-risen-and-rodes-chatgpt | https://www.thepromptwarrior.com/p/5-prompt-frameworks-level-prompts

**Components:**
- R — Role: "Assign a specific role or perspective" ("seasoned copywriter specialized in crafting viral tweets")
- O — Objective: Clearly define the task goal
- D — Details: Relevant context, constraints, specific requirements
- E — Examples: Sample outputs as guidelines (few-shot)
- S — Sense Check: Review that the prompt will produce a valuable result

**Role establishment score: MEDIUM-HIGH**
- The Details component is the differentiator — it provides structured space for domain constraints and expertise specifics.
- Examples (E) enable behavioral demonstration, which is more powerful than description alone.
- Sense Check (S) is meta — it's a prompt quality review step, not a persona component.

**Multi-turn persistence: WEAK**
- No multi-turn guidance in documentation.
- The Examples component could implicitly encode persistent behavioral patterns if used in a system prompt.

**Auto-generability: MEDIUM**
- Role and Objective are template-able; Details and Examples require more input context.

---

#### BROKE (Background, Role, Objective, Key Result, Evolve)

**Note:** The "E" is documented as "Evolve" (iterative improvement), not "Exclusions" as sometimes cited.
**Source:** https://www.myframework.net/broke-ai-prompt-framework/

**Components:**
- B — Background: Context/situation description
- R — Role: "Define the correct role so that AI can answer questions from a professional perspective"
- O — Objective: Intended goals and task description
- K — Key Result: Measurable outcomes or insights expected
- E — Evolve: "After the AI has given the answer, provide three ways to improve it"

**Role establishment score: MEDIUM**
- Role is explicit. Background supplements it with situational context.
- Key Result adds accountability dimension (what does good look like?), which implicitly shapes persona behavior.
- Evolve is unique — it is a post-response iteration mechanism, not a persona component. This makes BROKE the only framework with a built-in refinement loop.

**Multi-turn persistence: MEDIUM (unique)**
- The Evolve component is the closest any of these frameworks comes to multi-turn awareness — it instructs the model to propose improvements to its own prior response. This is iteration, not continuity, but it's the best approximation in the set.

**Auto-generability: HIGH**
- Background and Role are directly template-able. Key Result can be derived from the role.

---

#### APE (Action, Purpose, Expectation)

**Source:** https://aipromptsx.com/prompts/frameworks/ape | https://easyaibeginner.com/ape-framework-ai-prompt-for-chatgpt/ | https://fvivas.com/en/ape-framework-prompts-llm/

**Components:**
- A — Action: The specific task or action to perform
- P — Purpose: The rationale/why behind the request
- E — Expectation: Anticipated format, detail level, or outcome

**Role establishment score: LOW**
- APE has no Role component. It is purely task-focused.
- Can be combined with a separate role statement ("Role + APE") but does not natively include persona definition.
- Designed as a minimal framework for users who want quick, clear, goal-oriented responses.
- One source explicitly states it works best when combined with role framing: "Role: You are a high school tutor. Action: Explain quantum physics..."

**Multi-turn persistence: NONE**
- APE is the most task-oriented framework in the set. Zero persona persistence design.

**Auto-generability: HIGH (but role-free)**
- All three components map from a task description. Role requires a separate wrapper.

---

#### STAR (Situation, Task, Action, Result)

**Source:** STAR is primarily an interview methodology (behavioral interviewing). Its use as a prompting framework for LLMs is informal/community-derived.
**Confirmed source:** https://www.parloa.com/knowledge-hub/prompt-engineering-frameworks/ (indirectly); no primary LLM-specific documentation found.

**Finding:** STAR as a prompting framework is not well-established in the LLM prompt engineering literature. The primary use of "STAR" in AI contexts is for generating structured examples or behavioral scenarios, not for defining a persistent role. Its components (Situation, Task, Action, Result) describe a narrative arc, not an identity.

**Role establishment score: LOW**
- STAR has no Role component. It describes what happened, not who the agent is.
- Useful for constructing examples to inject into a few-shot system prompt, not for persona definition.

**Multi-turn persistence: NONE**
- Not designed for this purpose.

**Auto-generability: N/A**
- Not applicable as a role prompting framework.

---

#### CREATE (Character, Request, Examples, Adjustments, Type of output, Extras)

**Source:** https://fvivas.com/en/create-framework-prompts-llm/ | https://nexus.sps.nyu.edu/post/how-to-craft-effective-prompts-using-the-create-framework

**Components:**
- C — Character: Defines the AI's role ("marketing expert," "history teacher") — "adjusts tone and perspective"
- R — Request: The specific task
- E — Examples: Guidance through concrete examples
- A — Adjustments: Tailoring to specific preferences or constraints
- T — Type: Exact output format (numbered list, prose, JSON)
- E — Extras: Additional directives ("Explain your reasoning," "Ignore prior prompts")

**Role establishment score: HIGH (best in set)**
- "Character" is explicitly named and includes identity + tone + perspective.
- Adjustments provides space for iterative refinement of persona behavior.
- Extras is a flexible override space that can include persistence instructions.
- One source explicitly recommends: "Use system instructions (API system message) when role must persist and be non-negotiable."

**Multi-turn persistence: MEDIUM**
- The Extras component can carry persistence-specific instructions.
- Character's framing as persona (not just task-role) is the strongest in the set.

**Auto-generability: HIGH**
- Character maps directly from a title/description. All other components can be templated.

---

### Part 2 — Framework Comparison Table

| Framework | Has Explicit Role | Depth Beyond Title | Multi-Turn Designed | Auto-Generability | Best Use Case |
|-----------|:-----------------:|:------------------:|:-------------------:|:-----------------:|---------------|
| CO-STAR   | No (Style+Tone proxy) | High (Style, Tone, Audience) | No | Medium | Output style control |
| RISE      | Yes | Low | No | High | Structured task execution |
| CRAFT     | Yes | Low-Medium | No | High | General-purpose prompting |
| RODES     | Yes | Medium (Details, Examples) | No | Medium | Example-driven tasks |
| BROKE     | Yes | Medium (Key Result, Evolve) | Partial (Evolve) | High | Iterative refinement |
| APE       | No | None | No | High | Simple task framing |
| STAR      | No | None | No | N/A | Narrative/example structure |
| CREATE    | Yes (Character) | High (Adjustments, Extras) | Partial (Extras) | High | Persona-forward tasks |

**Winner for role establishment depth:** CREATE
**Winner for auto-generability:** RISE, CRAFT, BROKE, APE (all High)
**Most honest about persistence:** None — all require system-prompt-level placement for true persistence

---

### Part 3 — Empirical Research on Role/Persona Prompting

#### Finding 1: Persona prompting does NOT reliably improve accuracy (HIGH confidence)

The most cited paper (Zheng et al., 2023/updated 2024) tested 162 distinct personas across 9 open-source LLMs using 2,410 MMLU factual questions. The original 2023 conclusion was revised in October 2024 to: "adding personas in system prompts does not improve model performance across a range of questions compared to the control setting."

- Gender-neutral roles performed marginally better than gendered ones
- Domain-aligned roles (lawyer for law questions) showed no consistent benefit
- Automatic persona selection strategies performed no better than random
- **Source:** https://arxiv.org/html/2311.10054v3

#### Finding 2: Persona prompting IS effective for open-ended/style tasks (HIGH confidence)

Multiple studies and practitioner consensus agree that persona prompting reliably shapes tone, style, voice, and creative output. The distinction is:
- **Accuracy tasks (factual QA, math):** No benefit, sometimes harmful
- **Style/tone/creative tasks:** Consistent benefit from persona assignment
- **Source:** https://www.prompthub.us/blog/role-prompting-does-adding-personas-to-your-prompts-really-make-a-difference

#### Finding 3: Elaborate, specific personas outperform simple ones (HIGH confidence)

The ExpertPrompting paper (Xu et al., 2023) demonstrates that LLM-generated expert descriptions outperform human-written simple roles. Key characteristics of effective expert descriptions:
1. **Distinguished**: Customized to the specific task domain
2. **Informative**: Detailed and comprehensive (background, credentials, specialization)
3. **Automatic**: Generated by LLM rather than hand-crafted

Expert answers were preferred by 48.5% of reviewers vs. 23% for vanilla answers. ExpertLLaMA achieved 96% of ChatGPT's capability.
- **Source:** https://arxiv.org/html/2305.14688v2

#### Finding 4: Modern LLMs are sensitive to irrelevant persona details (HIGH confidence)

EMNLP 2025 paper (accepted) found performance drops of "almost 30 percentage points" when irrelevant details are added to otherwise valid persona prompts. The three dimensions that matter:
1. Performance advantage of the expert role
2. Robustness to irrelevant attributes
3. Fidelity to persona attributes

Mitigation strategies only worked consistently for the largest models.
- **Source:** https://arxiv.org/abs/2508.19764

#### Finding 5: Multi-turn persona consistency requires reinforcement learning, not just prompting (MEDIUM confidence)

A 2025 paper on "Consistently Simulating Human Personas with Multi-Turn Reinforcement Learning" found:
- Models exhibit strong local (turn-to-turn) coherence but fail at global persona stability
- PPO (reinforcement learning) with LLM-as-Judge rewards produced +20.6% to +58.5% improvement in persona consistency
- Simple turn-level prompting strategies are insufficient for long-horizon consistency
- **Source:** https://arxiv.org/html/2511.00222v1

#### Finding 6: Role-playing prompt frameworks benefit from few-shot examples over zero-shot (MEDIUM confidence)

A 2024 paper on role-playing prompt framework generation found that:
- Character-specific language patterns (terms of address, pet phrases) are the primary driver of role adherence
- Few-shot dialogue examples dramatically outperform zero-shot role assignment
- Fine-tuned models with role-conditioned data showed Gemma improving win rates from 7.69% to 92.31%
- **Source:** https://arxiv.org/html/2406.00627v1

---

### Part 4 — Anthropic's Official Guidance

#### On "Give Claude a Role" (confirmed from official docs, HIGH confidence)

From Claude's official prompting best practices page (platform.claude.com):

> "Setting a role in the system prompt focuses Claude's behavior and tone for your use case. Even a single sentence makes a difference."

Example provided:
```python
system="You are a helpful coding assistant specializing in Python."
```

Key nuance: The guidance uses "Give Claude a role" as a technique under "General principles," alongside "Be clear and direct," "Add context," and "Use examples effectively." It is not elevated as a primary technique.

**Source:** https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices

#### On over-constraining roles (confirmed, HIGH confidence)

From Anthropic's public blog on prompt engineering:

> "Don't over-constrain the role. 'You are a helpful assistant' is often better than 'You are a world-renowned expert who only speaks in technical jargon and never makes mistakes.' Overly specific roles can limit the AI's helpfulness."

> "Role prompting defines expert personas and perspectives in how you phrase your query. While this can be effective, modern models are sophisticated enough that heavy-handed role prompting is often unnecessary."

**Source:** https://claude.com/blog/best-practices-for-prompt-engineering

#### On system prompt vs. user prompt for role placement (confirmed, HIGH confidence)

Anthropic's documentation on Claude 4.x best practices explicitly addresses context hydration for long conversations:

> "For very long conversations, inject what were previously prefilled-assistant reminders into the user turn. If context hydration is part of a more complex agentic system, consider hydrating via tools."

The implication: role/persona context should live in the system prompt for persistent behavior, and can be re-injected in user turns for long-horizon consistency.

**Source:** https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices (Context hydration section)

#### Anthropic Persona Selection Model research (HIGH confidence)

Anthropic published research on how personas work at a model level:

> "LLMs learn to simulate diverse characters during pre-training, and post-training elicits and refines a particular such Assistant persona. Post-training can be viewed as refining and fleshing out the Assistant persona — not fundamentally changing its nature."

This means persona prompting works by eliciting existing simulated characters, not by injecting new behaviors. The implication for prompting: the more specific and aligned your role description is with the model's training distribution, the more consistent the behavior.

**Source:** https://alignment.anthropic.com/2026/psm/ (Anthropic Alignment Science)

---

### Part 5 — System Prompt vs. User Prompt for Role Definition

**Consensus finding (HIGH confidence):**

System prompts produce persistent role behavior. User prompts produce per-turn role behavior.

Specific guidance:
- System prompts define "who the AI is" — they persist across all turns unchanged
- User prompts define "what the user wants done right now"
- System prompts take priority over user prompts in instruction hierarchy
- Anthropic's published system prompts (5,000+ tokens for Claude 3.5 Sonnet) demonstrate that behavioral rules are system-level, not user-level

For multi-turn role adherence:
- Place the complete persona definition in the system prompt
- For very long conversations (context approaching limit), re-inject persona reminders via user turn or tool responses
- The "context hydration" pattern (Anthropic's term) is the recommended approach for long-horizon consistency

**Sources:**
- https://surendranb.com/articles/system-prompts-vs-user-prompts/
- https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices

---

### Part 6 — Dimensions a Persistent Role Should Include

Synthesized from ExpertPrompting, EMNLP 2025 research, and practitioner consensus:

**Essential (drive meaningful behavioral change):**
1. **Domain**: The specific field of expertise (not just "expert")
2. **Specialization**: Sub-domain focus ("UX designer specializing in design systems" not just "designer")
3. **Experience level**: Years, career stage, context ("10 years in enterprise SaaS")
4. **Decision-making style**: How they approach problems ("data-driven," "intuition-led," "process-oriented")
5. **Communication style**: How they communicate with others (direct, collaborative, Socratic)

**Beneficial (improve style consistency):**
6. **Domain vocabulary**: Terms of art, pet phrases, characteristic language patterns
7. **Domain boundaries**: What they do NOT do / defer to others
8. **Relationship framing**: Who they are talking to and what that relationship implies

**Avoid (can hurt performance):**
- Irrelevant biographical details (30-point performance drop per EMNLP 2025)
- Superlatives without substance ("world's best," "renowned expert")
- Contradictory behavioral constraints

---

### Part 7 — Recommended Template for Auto-Generation from Short Input

Based on the research synthesis, the following template structure performs best for persistent role establishment from a short input like "Senior UX Designer focused on modern world class design":

```
You are [TITLE].

[2-3 sentences: domain expertise, specialization focus, experience depth]

Your approach: [decision-making style, how you frame problems, what you optimize for]

Your communication style: [directness level, preferred vocabulary, how you handle uncertainty]

Your scope: [what you own, what you defer, what you will and won't do]
```

**Why this structure:**
- Avoids named frameworks (all have weaknesses for persistence)
- Directly targets the 5 essential dimensions identified by research
- Keeps irrelevant attributes out (per EMNLP 2025 robustness finding)
- Short enough to appear in every system prompt without context pressure
- Generatable from a one-line input via LLM auto-expansion (ExpertPrompting pattern)

**Concrete example:**
```
You are a Senior UX Designer.

You specialize in designing modern, world-class digital interfaces — the kind that ship in top-tier consumer apps and enterprise SaaS products. You have deep familiarity with design systems, interaction patterns, accessibility standards, and the craft of making interfaces feel inevitable rather than constructed.

Your approach: You reason from user needs and business goals simultaneously. You push back on requirements that produce cluttered or inconsistent interfaces. You advocate for simplicity and know when to hold the line.

Your communication style: Direct and specific. You name design problems precisely — "this violates the proximity principle" rather than "this feels off." You use standard UX vocabulary fluently.

Your scope: You focus on interaction design, visual hierarchy, and design critique. You defer to content strategy for copy decisions and to engineering for implementation constraints unless they affect UX outcomes.
```

---

## Key Takeaways

1. **No framework in the set was designed for multi-turn role persistence.** All eight treat role definition as a single-prompt concern. System prompt placement is the mechanism for persistence, not the framework structure.

2. **CREATE is the strongest framework for role establishment** because "Character" is explicitly persona-first and "Adjustments"/"Extras" provide flexible space for persistence-specific instructions. RODES is second-best due to the Details + Examples combination.

3. **CO-STAR is the most feature-complete framework overall** but uses Style+Tone as an indirect persona proxy rather than an explicit role. Best for output control, not identity persistence.

4. **APE and STAR are not role establishment frameworks.** APE is task-only. STAR is a narrative/behavioral example structure borrowed from interview methodology.

5. **Empirically, "You are a [title]" works for style, not accuracy.** The ExpertPrompting finding is the most actionable: elaborate, auto-generated persona descriptions outperform both simple roles and no-role prompts for style/tone/creative tasks.

6. **Anthropic's current guidance (2026) treats role prompting as a light touch, not a heavy-handed technique.** "Even a single sentence makes a difference" for system prompt roles. Over-constraining roles actively hurts helpfulness.

7. **For long-horizon consistency, prompting alone is insufficient.** The RL research shows that structural mechanisms (context re-injection, tool-based hydration, or fine-tuning) are needed beyond the initial system prompt for conversations exceeding ~50 turns.

8. **Irrelevant persona details are actively harmful.** A focused, minimal expert description outperforms an elaborate one with irrelevant details by up to 30 percentage points.

---

## Sources

| URL | Quality | What it provides |
|-----|---------|-----------------|
| https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices | HIGH — Official Anthropic documentation | "Give Claude a role" guidance, context hydration, system prompt best practices |
| https://claude.com/blog/best-practices-for-prompt-engineering | HIGH — Official Anthropic blog | Role prompting is "often unnecessary" for modern Claude; over-constraining warning |
| https://alignment.anthropic.com/2026/psm/ | HIGH — Anthropic Alignment Science research | Persona Selection Model: how personas work at training level |
| https://arxiv.org/html/2311.10054v3 | HIGH — Peer-reviewed, 2024 EMNLP update | Personas don't improve accuracy across 9 models, 2,410 questions |
| https://arxiv.org/abs/2508.19764 | HIGH — EMNLP 2025 accepted paper | 30-point performance drop from irrelevant persona details; 3 desiderata |
| https://arxiv.org/html/2305.14688v2 | HIGH — 2023 peer-reviewed paper | ExpertPrompting: elaborate auto-generated personas preferred 48.5% vs 23% |
| https://arxiv.org/html/2511.00222v1 | MEDIUM — 2025 preprint | Multi-turn RL for persona consistency: +20-58% improvement |
| https://arxiv.org/html/2406.00627v1 | MEDIUM — 2024 conference paper | Role-playing prompt frameworks; linguistic imitation > role description |
| https://www.prompthub.us/blog/role-prompting-does-adding-personas-to-your-prompts-really-make-a-difference | MEDIUM — Practitioner research synthesis | Two-stage approach, LLM-generated personas, open vs accuracy task split |
| https://lazaroibanez.substack.com/p/exploring-rise-risen-and-rodes-chatgpt | LOW-MEDIUM — Practitioner analysis | RISE, RISEN, RODES component definitions |
| https://www.myframework.net/broke-ai-prompt-framework/ | LOW-MEDIUM — Practitioner blog | BROKE component definitions |
| https://www.geeky-gadgets.com/craft-prompt-framework/ | LOW-MEDIUM — Practitioner blog | CRAFT component definitions |
| https://fvivas.com/en/create-framework-prompts-llm/ | LOW-MEDIUM — Practitioner blog | CREATE component definitions |
| https://surendranb.com/articles/system-prompts-vs-user-prompts/ | LOW-MEDIUM — Practitioner analysis | System vs user prompt hierarchy for role persistence |
| https://learnprompting.org/docs/advanced/zero_shot/role_prompting | MEDIUM — Educational resource | Role definition dimensions, two-stage approach |
| https://aclanthology.org/2024.findings-emnlp.969.pdf | HIGH — ACL Anthology 2024 | Survey of role-playing in LLMs (two tales: anthropomorphic vs task) |
