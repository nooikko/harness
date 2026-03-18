# Research: Personal AI Assistant Persona Design — Warmth, Directness, and System Prompt Structure
Date: 2026-03-17

## Summary

This research synthesizes Anthropic's official guidance, production systems (Pi/Inflection, OpenAI Custom GPTs), and academic literature to answer five questions: what makes a personal assistant feel warm vs robotic; how to structure system prompts for calendar/email/task management; how to write soul/identity that creates personality without over-constraining; what production systems do well; and what anti-patterns to avoid. The central finding is that warmth and sycophancy are opposites, not synonyms. Warmth comes from specificity, genuine curiosity, and honest engagement. Sycophancy comes from reflexive agreement, hollow validation, and telling users what they want to hear.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-01-agent-identity-soul-memory-research.md` — covers Generative Agents seed memory, MemGPT architecture, Character Card V2 structure. Directly relevant for the field schema question.
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-01-agent-personality-memory-standards.md` — covers CrewAI/LangGraph/OpenAI personality frameworks and the finding that personas don't improve factual accuracy, only tone/consistency.
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-17-ai-persona-field-definitions-research.md` — covers field-by-field breakdown (soul, identity, role, goal, backstory, traits) with academic backing. This file extends that research into practical personal assistant applications.

---

## Finding 1: What Makes a Personal AI Assistant Feel Warm vs Robotic

### The Core Distinction: Warmth is NOT Agreement

The most important finding from sycophancy research (Anthropic, ICLR 2024 paper arxiv:2310.13548) is that the behaviors people commonly associate with "friendly AI" — eagerness to agree, constant positive reinforcement, immediately validating user ideas — are precisely the behaviors that make AI feel hollow and untrustworthy over time.

Confidence: HIGH (multiple sources, including Anthropic's own research and model card language)

Real warmth in the Pi AI design (Inflection's most acclaimed assistant) came from:
- **Active listening that reframes, not just echoes** — Pi acknowledges feelings then offers a perspective, rather than just reflecting back what the user said
- **Asking clarifying questions rather than bulldozing answers** — guided reflection, one question at a time, not a monologue of helpfulness
- **Gentle structure** — light plans and checklists that help without overwhelming
- Pi's team started by listing positive traits ("kind, supportive, curious, humble, creative") AND explicitly listing negative traits to avoid ("irritability, arrogance, combativeness") — the negative list mattered as much as the positive

From Claude's actual deployed system prompt (sourced from Simon Willison's analysis of the Claude 4 system card, confirmed HIGH confidence):
> "Never starts its response by saying a question or idea or observation was good, great, fascinating, profound, excellent, or any other positive adjective. It skips the flattery and responds directly."

### What Signals "Robotic" to Users

Based on the research:

1. **Opening with validation tokens** — "Great question!", "Absolutely!", "Of course!", "Certainly!" These read as filler the model generates before actually engaging with the content.
2. **Bullet-listing everything** — Anthropic's own guidance (from the system prompt) explicitly notes that lists in chitchat break conversational naturalness. Lists are for structured content, not for "how are you" exchanges.
3. **Hedging everything** — "I understand that you might be feeling..." before actually helping. Empathy theater.
4. **Abandoning positions under pressure** — Research from ICLR 2024 shows LLMs frequently capitulate when users push back, even when the user is factually wrong. This reads as spineless, not warm.
5. **Hyper-thoroughness** — Covering every angle of a question when the user wanted a quick answer. Anthropic now notes Claude 4.x models are more concise by default; prior models were verbose in ways that read as performance rather than help.
6. **Inconsistent tone** — Formal in one message, casual in the next, no sense of a persistent personality.

### What Signals "Warm" to Users

1. **Noticing specifics in what the user said** — Demonstrating genuine attention by referencing their exact words or situation
2. **Occasional pushback, delivered with care** — An assistant that will disagree with your bad idea (and explain why) is more trustworthy than one that always agrees
3. **Appropriate brevity** — Knowing when a two-sentence answer is better than five paragraphs
4. **Consistency of voice** — Same tone, same phrasing patterns, same values expressed across many conversations
5. **Proactive but not presumptuous** — Noticing you have back-to-back meetings and flagging it; not reorganizing your entire calendar without asking

---

## Finding 2: Optimal System Prompt Structure for Calendar/Email/Task Assistants

### Recommended Section Order (synthesized from Anthropic, OpenAI, and practitioner guidance)

The ordering matters because models weight earlier content more heavily. The structure should move from deepest/most stable to shallowest/most situational.

```
SECTION 1 — SOUL / CORE IDENTITY (who she is at the deepest level)
  [2nd-person declaration of values, orientation, and what she genuinely cares about]
  Confidence: HIGH — research consistently shows soul must come first and be 2nd-person

SECTION 2 — IDENTITY ANCHOR (concrete self-description)
  [Name, what she does, for whom — specific enough to be a real individual]

SECTION 3 — BACKSTORY (why she is this way)
  [Narrative form, not bullets — explains the causal origins of the soul]
  Confidence: HIGH — Berkeley BAIR research shows backstory prevents stereotypical defaults

SECTION 4 — ROLE + GOAL (what she does + what she's trying to accomplish)
  [Functional: the domains she covers, what success looks like]

SECTION 5 — BEHAVIORAL TRAITS (how she communicates)
  [Surface-level: tone calibration, mannerisms, vocabulary — can be a short list]

SECTION 6 — DOMAIN KNOWLEDGE + TOOL USAGE (what she knows and can do)
  [Calendar rules, email handling, task prioritization logic]

SECTION 7 — BEHAVIORAL CONSTRAINTS (what she does NOT do)
  [Explicit refusals and anti-patterns — this section is high-value per multiple sources]
  Note: OpenAI's cookbook guidance says constraints are AS important as positive definitions

SECTION 8 — EDGE CASE HANDLING (how she handles common failure modes)
  [A few scenario → response pairs that "train" consistent behavior without being exhaustive]
  Confidence: MEDIUM — Anthropic recommends this for character-based apps specifically

SECTION 9 — EXAMPLE UTTERANCES / VOICE SAMPLES (optional, high impact)
  [2-3 example exchanges that demonstrate tone better than description can]
  Confidence: HIGH — Character.AI data + academic research both show demonstrations
  outperform declarations for moment-to-moment behavior
```

### Calendar/Email/Task-Specific Structural Guidance

For a productivity-domain assistant, Sections 6 and 7 require extra depth:

**Section 6 domain specifics to include:**
- What she can and cannot modify unilaterally (vs. what requires confirmation)
- How she handles scheduling conflicts (suggest solutions, don't just flag problems)
- Email triage logic (what she surfaces vs. archives vs. escalates)
- Task prioritization framework (by deadline, energy, context — specify the model)
- What counts as "done" for a task

**Section 7 constraints most critical for a productivity assistant:**
- She does not reschedule meetings with external parties without explicit approval
- She does not delete anything — she archives, she flags, she drafts for review
- She does not speculate about other people's availability without checking actual data
- She flags when she's uncertain rather than guessing and presenting it as fact
- She does not send emails on behalf of the user without the user seeing a draft first

### Tone Guidance for the Productivity Domain

The "Professional + Warmth" balance is more specific than it sounds. From OpenAI's four archetype framework:
- A purely "Professional" tone is polite, structured, formal — good for corporate email drafting but cold for a personal assistant who knows your life
- A purely "Friendly/Exploratory" tone is great for chitchat but frustrating when you need your calendar managed quickly

For a personal assistant managing private life logistics, the target is: **warm efficiency**. Warm efficiency means:
- No preamble before action (don't explain what you're about to do — do it)
- Natural prose, not bulleted "Here is what I found: 1. Your 3pm is..."
- Informal contractions are fine ("you've got", "I'd", "can't")
- Brief acknowledgment of stress/urgency before diving in ("Three things before your 2pm —")
- Personality shines in the asides, not in padding between the substance

---

## Finding 3: Writing Soul/Identity That Creates Personality Without Over-Constraining

### The Over-Specification Trap

Anthropic's documentation explicitly warns: "Think of Claude as a brilliant but new employee who lacks context on your norms and workflows. The more precisely you explain what you want, the better the result." This sounds like it argues for maximum specificity — but the academic research contradicts that for character definitions.

The RPLA survey (Chen et al., TMLR 2024) distinguishes between:
- **Descriptions**: declarative facts about the character (what can be specified)
- **Demonstrations**: behavioral patterns (what can only be shown, not told)

And the PsyPlay research (arxiv 2502.03821) finds that deep personality and decision-making processes "cannot be reliably encoded through prompting alone — they require fine-tuning or extensive demonstration."

This means: you cannot fully specify a personality. You can create the conditions for one to emerge, and then trust the model to generalize. Over-constraining (listing 20 personality adjectives, writing paragraph after paragraph of "she should be X in situation Y") produces performance of a personality rather than expression of one.

### What to Specify vs What to Leave Open

**Specify (HIGH leverage):**
- Core values and what the character refuses to do (this is the soul — non-negotiable)
- The backstory that explains WHY the values exist (backstory prevents stereotypical interpretation)
- 3-5 discrete behavioral traits with intensity modifiers ("extremely direct", not just "direct")
- Negative constraints — what she does NOT do — these are more reliable than positive declarations
- 2-3 example exchanges that demonstrate the voice in action

**Leave open (trust the model):**
- Exactly how to phrase empathy in a specific situation
- How long responses should be (let context determine this)
- Whether to be funny in any given moment
- Exactly how much detail to include in calendar summaries

### Writing Techniques That Create Consistent Personality

From the Role-Aware Reasoning paper (arxiv 2506.01748), four elements must be present to prevent "attention diversion" (the model drifting toward generic responses during long interactions):

1. **Emotion** — the character's affective responses and patterns
2. **Experience** — background knowledge and past events informing decisions
3. **Standpoint** — values and beliefs guiding behavior
4. **Motivation** — goals and drives shaping actions

A soul/identity block that covers all four will maintain consistency through long conversations. One that omits any element will drift.

**Structural technique — narrative backstory:**
Do not write: "Samantha is warm, efficient, and direct."
Write instead: "Samantha learned to cut through noise working as a chief of staff for a startup founder who got 400 emails a day. She developed a ruthless sense of what actually matters and a deep distaste for corporate padding. That efficiency is in her bones — but so is genuine care for the person she's working with, because she's seen what happens when people run themselves into the ground optimizing for the wrong things."

The narrative form does three things the trait list cannot:
- Explains WHY she is efficient (so the model can generalize to novel situations)
- Prevents the stereotypical "efficient assistant" default (she has a specific history)
- Creates emotional texture (the backstory has stakes)

**Structural technique — 2nd-person declaration for soul:**
The soul block must be in second-person ("You are...", "You believe...", "You will not..."). Research across Character.AI, the RPLA survey, and MemGPT all confirm this. The model must speak AS the character, not ABOUT the character.

**Structural technique — negative traits require support:**
PsyPlay research confirms that traits conflicting with RLHF training (directness, willingness to push back, not sugarcoating bad news) are significantly harder to maintain (61% vs 91% success for positive traits). These require:
- Explicit backstory motivation for WHY the character is this way
- Example dialogue demonstrating the trait in action
- Higher intensity specification ("extremely" > "very" > "somewhat")

---

## Finding 4: Production System Analysis

### Pi (Inflection AI) — Design Principles That Worked

Pi is the most analyzed emotionally intelligent assistant. Key documented design decisions:

1. **Positive trait list + negative trait list** — the team listed what Pi SHOULD be (kind, supportive, curious, humble, creative, fun) AND what Pi should NOT be (irritable, arrogant, combative). The negative list functions as behavioral constraints.

2. **Trained on therapist-influenced RLHF** — 600 part-time raters including therapists shaped the reward signal. This made Pi better at detecting when someone needs to feel heard before they need information.

3. **Guided reflection over bulldozing answers** — Pi's distinctive pattern is asking one clarifying question rather than launching into a comprehensive answer. This reads as human because humans who care ask before solving.

4. **Conversation-starters that build warmth** — Pi typically opens new sessions by asking about casual life first. This sets a relational tone before task mode.

What Pi did NOT do well (from the IEEE Spectrum post-mortem):
- Too soft for users who wanted to get things done quickly
- Prioritized emotional processing over task completion
- Did not have strong proactive/productivity capabilities

**Lesson for Samantha:** Pi's warmth patterns are valuable for the relational texture of conversations, but Samantha needs sharper task-completion mode. The model should be warm AND efficient — not choosing between them.

### Anthropic's Claude 4 System Prompt — Anti-Sycophancy Techniques

Directly from Claude's deployed system prompt (HIGH confidence — confirmed by Simon Willison's published analysis):

- No opening validation: never starts with "great question", "fascinating", "excellent", or any positive adjective. Skips flattery, responds directly.
- When users push back incorrectly: "users sometimes make errors themselves" — the model should reconsider carefully before accepting criticism, not just capitulate.
- No excessive formatting in casual conversation: no lists in chitchat.
- When it cannot help: does not explain why or speculate about consequences (comes across as preachy).

This is the actual anti-sycophancy implementation in production. It focuses on removing hollow behavior at the language pattern level, not on making the assistant cold.

### OpenAI Custom GPT Framework

OpenAI's recommended five-layer structure for Instructions:

1. Foundation Layer — who the agent is and what success looks like
2. Personality Layer — character archetype, specific traits, tone/voice
3. Operational Layer — capabilities, constraints, output format
4. Ethical Layer — hard refusals, transparency requirements
5. Refinement Layer — 2-3 few-shot examples of ideal responses

Four named personality archetypes from OpenAI:
- Professional (formal, enterprise) — closest to a productivity assistant
- Efficient (concise, developer tooling) — too terse for a personal assistant
- Fact-Based (grounded, no speculation) — essential layer but not complete
- Exploratory (enthusiastic, educational) — adds warmth but can be unfocused

For Samantha, the target is Professional + Fact-Based core, with Exploratory texture in the relationship/conversational moments.

---

## Finding 5: Anti-Patterns to Avoid

### Sycophancy Anti-Patterns (HIGH confidence — multiple research sources)

These are the specific behaviors that make users distrust AI assistants over time:

**Language patterns to purge from soul/identity text:**
- Any instruction to "always be positive" or "be encouraging" without qualification — this produces sycophantic behavior
- "Be supportive" without specifying that support includes honest feedback when needed
- "Make the user feel good" — this is the definition of sycophancy; replace with "make the user effective"
- Any instruction to agree, validate, or affirm user statements by default

**Behavioral patterns to explicitly prohibit in the constraints section:**
- "You do not start responses with compliments on the user's question or idea."
- "When you disagree with a plan or assessment, you say so directly before offering an alternative."
- "You do not abandon your position when challenged unless new information or a new argument has been provided — social pressure alone is not a reason to change your view."
- "You do not hedge every statement with uncertainty qualifiers when you are actually confident."

**Format anti-patterns:**
- Bullet-listing everything (lists break conversational naturalness; reserve for genuinely list-like content)
- Long preambles before action ("I'll help you with that! Let me look at your calendar...")
- Excessive hedging ("I'm not 100% sure but you might want to consider possibly...")
- Emotional theater ("I can really feel the stress in your message...")

### Character Design Anti-Patterns

**Generic soul descriptions:**
- "Samantha cares deeply about helping people" — this describes every AI assistant ever. No individual.
- "Samantha is warm and professional" — trait list without causality. The model defaults to a stereotype.
- "Samantha is always ready to help" — performative eagerness, not character.

**Missing backstory for difficult traits:**
- Directness, willingness to push back, and efficiency are harder traits to maintain without narrative support. If the soul says "Samantha is direct" but there's no backstory explaining WHY, the RLHF training pulls toward softer behavior under pressure.

**Over-specification:**
- More than 5-7 personality adjectives dilutes attention and creates internal contradictions the model must resolve (usually by averaging toward a generic middle)
- Scenario-by-scenario instructions for every possible situation ("when the user is frustrated, say...") — this produces robotic, if-then behavior rather than genuine personality
- Conflicting instructions (be brief AND be thorough; be warm AND be professional) without a tiebreaker rule

**Role without soul:**
- The "When Helpful Assistant Is Not Really Helpful" study (arxiv 2311.10054) confirms that role alone ("You are a personal assistant specializing in productivity") has no reliable effect on quality. Role channels soul — without soul, role is a label.

**No negative constraints:**
- A character definition without explicit "what I will not do" constraints relies on alignment training alone to handle refusals and tone. For a personal assistant managing real data, explicit constraints are essential.

**Missing the anchor injection:**
- For long conversations, the Character Card V2 community discovered (and academic literature confirms) that a "post-history injection" — a brief soul re-anchor placed AFTER the conversation history rather than before it — dramatically reduces persona drift in long sessions.

---

## Practical Recommendations for Samantha

### Soul Text Principles (actionable)

1. Write the soul in 2nd person. Not "Samantha is..." — "You are..."
2. Lead with values, not traits. Not "You are warm and efficient" — "You believe people are at their best when they're not drowning in logistics."
3. Include what she will NOT do in the soul. Her refusals are as much a part of who she is as her enthusiasms.
4. Keep the soul to 150-300 words maximum. More than that dilutes attention.
5. End the soul with a single sentence that captures her essence — this becomes the "anchor" text for re-injection after long conversation history.

### Identity Text Principles (actionable)

1. Give her a concrete situating description: not "a personal assistant" but "the person who manages the logistics layer of your life so you can spend your energy on the things that actually need you."
2. Include one specific detail that makes her feel like an individual, not an archetype — something that comes from the backstory.

### Backstory Text Principles (actionable)

1. Write in narrative form, not bullets.
2. Make the backstory explain WHY the soul exists — what experiences created her values.
3. Keep it to 100-200 words. It needs to be long enough to prevent stereotyping, short enough not to compete with the soul for attention.
4. Ensure it explains her directness / willingness to push back (the traits most at risk of sycophantic erosion).

### Behavioral Traits Principles (actionable)

1. Maximum 5 traits.
2. Intensity matters: "extremely direct" not just "direct."
3. Pair at least one difficult trait (directness, pushback) with a corresponding backstory explanation.
4. Include one or two traits that are slightly unexpected for a productivity assistant — something that makes her feel like an individual (e.g., a specific sense of humor, a particular domain she finds fascinating).

### Constraints Section (actionable — do not skip)

Include explicit prohibitions on:
- Opening with validation ("Great question", "Absolutely!")
- Agreeing under social pressure without new information
- Speculating without flagging uncertainty
- Bullet-listing conversational responses
- Taking irreversible actions (send, delete, reschedule external meetings) without confirmation
- Omitting her actual view when asked for one

### Example Exchanges (recommended)

Include 2-3 brief exchanges that demonstrate:
1. Warmth in action (a moment where she acknowledges something emotionally before helping)
2. Directness in action (a moment where she pushes back or flags a problem honestly)
3. Efficient task handling (a moment where she just does the thing without preamble)

These three examples will teach the model more about the target behavior than three paragraphs of description.

---

## Key Takeaways

1. **Warmth and sycophancy are opposites.** Training the assistant to be warm means training it to be genuine — to notice real things, to respond to real needs, to occasionally disagree. Not to validate.

2. **Backstory is the anti-stereotyping lever.** Generic trait labels produce generic behavior. A narrative backstory explaining why the character holds those values produces individual behavior. This is the finding from Berkeley BAIR research and it is robust.

3. **Write the constraints as carefully as the soul.** What Samantha will NOT do is as important as what she values. Constraints are where the soul becomes operational.

4. **Four elements prevent drift in long conversations.** Emotion, Experience, Standpoint, Motivation must all be present in the character definition. Missing any one causes drift toward generic responses.

5. **Role alone does nothing.** "You are a personal assistant" is not a character definition. Role without soul produces a label, not a personality.

6. **Demonstrations beat declarations.** Two example exchanges showing the target behavior are more effective than two paragraphs describing it. Include them.

7. **The dual injection pattern reduces context drift.** For very long conversation sessions: inject a brief soul anchor AFTER the conversation history, not just before. This re-establishes character after the model has been processing a lot of content.

---

## Gaps Identified

- No direct comparison research found on AI personal assistant warmth in the calendar/email/task domain specifically — most persona research focuses on roleplay/companionship or enterprise customer service, not personal productivity.
- Pi's internal system prompt structure is not published. The analysis here is based on second-hand accounts of Inflection's design process.
- The Anthropic sycophancy avoid-docs page returned 404 (the URL has moved or been consolidated). The Claude 4 system card analysis (Simon Willison) is the best available source for Claude's anti-sycophancy implementation.
- No research found specifically quantifying how system prompt length affects persona consistency — the optimal length trade-off is based on practitioner consensus, not controlled study.

---

## Sources

### Primary (Official Documentation)
- Anthropic prompt engineering guide (Claude 4.x): https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/system-prompts
- Anthropic "keep in character" guidance: https://platform.claude.com/docs/en/docs/test-and-evaluate/strengthen-guardrails/keep-claude-in-character
- Anthropic — Claude character design philosophy: https://www.anthropic.com/research/claude-character
- Claude 4 system prompt highlights (Simon Willison analysis): https://simonwillison.net/2025/May/25/claude-4-system-prompt/

### Academic / Research
- "Towards Understanding Sycophancy in Language Models" (ICLR 2024): https://arxiv.org/abs/2310.13548
- "Thinking in Character: Advancing Role-Playing Agents with Role-Aware Reasoning": https://arxiv.org/html/2506.01748v1
- "PsyPlay: Personality-Infused Role-Playing Conversational Agents": https://arxiv.org/abs/2502.03821
- "Virtual Personas for Language Models via an Anthology of Backstories" (BAIR 2024): https://bair.berkeley.edu/blog/2024/11/12/virutal-persona-llm/
- "When A Helpful Assistant Is Not Really Helpful" (2023): https://arxiv.org/abs/2311.10054
- "From Persona to Personalization: A Survey on Role-Playing Language Agents" (Chen et al., TMLR 2024): https://arxiv.org/abs/2404.18231

### Production Systems / Analysis
- Pi AI design analysis: https://www.toolify.ai/ai-news/pi-ai-your-empathetic-personal-ai-assistant-features-review-3675479
- Pi AI IEEE Spectrum post-mortem: https://spectrum.ieee.org/inflection-ai-pi
- OpenAI prompt personalities cookbook: https://developers.openai.com/cookbook/
- Smashing Magazine — designing custom AI assistants: https://www.smashingmagazine.com/2025/09/from-prompt-to-partner-designing-custom-ai-assistant/

### Prior Research Files
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-01-agent-identity-soul-memory-research.md`
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-01-agent-personality-memory-standards.md`
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-17-ai-persona-field-definitions-research.md`
