# Research: AI Persona Field Definitions — Soul, Identity, Role, Goal, Backstory, Traits
Date: 2026-03-17

## Summary

This research examines what makes each persona/character definition field distinct and effective across four domains: Character.AI's creator system, OpenAI's Custom GPT instructions, Anthropic's Claude system prompt guidance, and academic/industry research on LLM character consistency. The central finding is that each field targets a different layer of the model's attention and serves a different consistency function — from deep values (soul/identity) through functional framing (role/goal) to contextual depth (backstory) and surface behavior (traits). No platform uses exactly the same field names, but all converge on the same layered structure.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-01-agent-identity-soul-memory-research.md` — covers Generative Agents seed memory format, MemGPT architecture, and structured identity files. Directly related; this file extends it with platform-specific and academic field taxonomy.
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-01-agent-personality-memory-standards.md` — covers personality memory standards; partial overlap.
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-11-persona-drift-role-persistence-research.md` — covers persona drift mitigation. Complementary.
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-11-role-prompting-frameworks-comparison.md` — covers role prompting frameworks. Complementary.

---

## Current Findings

### 1. Character.AI — Creator System Fields

**Source Type:** Primary (official Character.AI documentation)
**URLs:**
- https://book.character.ai/character-book/advanced-creation
- https://book.character.ai/character-book/character-attributes/short-description
- Community guide: https://www.roborhythms.com/character-definition-format-for-character-ai/

#### Official Fields (as documented)

| Field | Limit | Purpose |
|-------|-------|---------|
| Name | — | Display identity, part of {{char}} token |
| Short Description | 0–50 chars | Browsing hook; "What do you do?" — displayed in thumbnail, does NOT affect personality |
| Long Description | — | Extended character context and lore |
| Greeting | 500 chars | First message in every conversation; sets voice, mood, and behavioral baseline |
| Definition | 32,000 chars (3,200 processed) | Full character blueprint — the primary personality driver |
| Example Conversations | — | Train tone and pacing via behavioral demonstration |

#### Key Guidance from Official Documentation

The official Character.AI documentation explicitly states: "you may find that giving the system just a creative greeting, which then causes it to invent the rest of the context itself, may actually produce better results than a carefully crafted Definition." This reflects an empirical finding: **behavioral demonstration (how the character speaks in the greeting) often outweighs declarative specification (what is written in the definition).**

The documentation emphasizes experimentation and acknowledges that the optimal format is still being discovered.

#### Recommended Definition Structure (Community Best Practice)

The community has converged on a hybrid format prioritizing the first 800 characters of the Definition field most heavily (the model weights early content more):

1. **Personality and speech style** — lead with this; highest model influence
2. **Basic attributes** — name, age, gender, species
3. **Backstory** — key events and turning points in paragraph form
4. **Relationships** — family, allies, rivals
5. **Interests and habits** — behavioral specifics
6. **Example dialogue** — demonstrates tone and pacing

**Short labeled lists** work best for traits, stats, and essentials. **Paragraphs** work best for backstory and emotional habits. **Example dialogue** trains tone and pacing most reliably.

#### Field Distinctness (Character.AI perspective)

- **Short Description**: Functional label only — "Greek historian" or "I help with Spanish practice." No personality effect. Used for discoverability.
- **Long Description**: Lore and extended worldbuilding. Background context that gives the character depth without driving moment-to-moment behavior.
- **Greeting**: The single most behaviorally influential field. "The model is more likely to pick up style and length constraints from the first message than anything else." Acts as a behavioral anchor.
- **Definition**: The full blueprint. Personality traits go here, but the greeting demonstrates them in action.

---

### 2. OpenAI Custom GPTs — Instructions Field and Persona Configuration

**Source Type:** Primary (OpenAI official resources) and Secondary (practitioner guides)
**URLs:**
- https://help.openai.com/en/articles/9358033-key-guidelines-for-writing-instructions-for-custom-gpts (primary, returned 403)
- https://reelmind.ai/blog/openai-custom-gpt-guidelines-crafting-your-unique-ai-persona (secondary)
- https://model-spec.openai.com/2025-12-18.html (primary — OpenAI Model Spec)

#### Configuration Fields for Custom GPTs

| Field | Purpose |
|-------|---------|
| Name | The GPT's display name and self-reference |
| Description | Short summary shown to users; not a personality driver |
| Instructions | The primary persona and behavior specification (equivalent to system prompt) |
| Conversation Starters | Suggested opening questions; shape perceived use case |
| Knowledge | Uploaded files for retrieval |
| Actions | External API integrations |

The **Instructions** field is the only place where persona, role, and behavior are defined. There is no separate "soul" or "backstory" field — everything is encoded into a single free-form text block.

#### Recommended Structure for Instructions (Practitioner Consensus)

A five-layer architecture has emerged in practitioner guidance:

1. **Foundation Layer**: "You are [Name], an AI assistant that [core mission]." One to three sentences. Establishes identity and purpose.
2. **Personality Layer**: Character archetype (Sage, Helper, Mentor), specific traits, tone and voice specifications.
3. **Operational Layer**: What the GPT does and does not do. Capabilities, constraints, output format.
4. **Ethical Layer**: Hard refusals, transparency requirements, data handling.
5. **Refinement Layer**: 2–3 few-shot examples of ideal responses embedded in the instructions.

#### Key Guidance on Persona Definition

From OpenAI's official guidance (via secondary sources):
- "Define a clear agent persona, which is especially important for customer-facing agents that need to display emotional intelligence."
- "The persona's purpose should be explicitly articulated, serving as a guiding star for all subsequent development decisions."
- Use trigger/instruction pairs for multi-step behavioral rules.
- For tone: "natural, conversational, and playful rather than formal or robotic, unless the subject matter requires seriousness."

There is no official OpenAI documentation distinguishing "soul" from "identity" from "role." All are collapsed into the Instructions field. Practitioners decompose it themselves.

---

### 3. Anthropic Claude — System Prompt and Persona Guidance

**Source Type:** Primary (Anthropic official documentation)
**URLs:**
- https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/system-prompts (primary, successfully fetched)
- https://docs.claude.com/en/docs/test-and-evaluate/strengthen-guardrails/keep-claude-in-character (primary, successfully fetched)

#### What Anthropic Recommends for Persona Definition

The Anthropic prompting guide identifies "Give Claude a role" as one of five general principles for effective prompting:

> "Setting a role in the system prompt focuses Claude's behavior and tone for your use case. Even a single sentence makes a difference."

Example given:
```
You are a helpful coding assistant specializing in Python.
```

For character-based applications specifically, the official guidance (from the "keep in character" documentation) states:

> "When setting up the character, provide detailed information about the personality, background, and any specific traits or quirks. This will help the model better emulate and generalize the character's traits."

And: "Provide a list of common scenarios and expected responses in your prompts. This 'trains' Claude to handle diverse situations without breaking character."

A concrete example from the Anthropic docs:
```
You are AcmeBot, the enterprise-grade AI assistant for AcmeTechCo. Your role:
- Analyze technical documents (TDDs, PRDs, RFCs)
- Provide actionable insights for engineering, product, and ops teams
- Maintain a professional, concise tone
```

#### Recommended System Prompt Components (Anthropic/AWS Bedrock guidance)

Three core components are consistently identified:
1. **Task context** — who the LLM is (role or persona)
2. **Tone context** — what tone or communication style to use
3. **Detailed task description and rules** — specific behavioral rules and constraints

Anthropic also recommends:
- XML tagging to separate different types of instructions (e.g., `<persona>`, `<rules>`, `<examples>`)
- Providing context/motivation behind instructions ("because users are reading on mobile" vs. just "be brief")
- Few-shot examples to demonstrate desired behavior — "one of the most reliable ways to steer Claude's output format, tone, and structure"

#### What Anthropic Does NOT Separate

Anthropic's official documentation does not define separate fields for "soul," "identity," "role," "goal," "backstory," or "traits" as distinct constructs. The system prompt is a single free-form text block. The practitioner community applies these distinctions, but they are not part of Anthropic's official schema.

---

### 4. Academic and Industry Research — Field Distinctions and Effectiveness

#### 4a. The Survey on Role-Playing Language Agents (Chen et al., TMLR 2024)
**Source:** arxiv.org/abs/2404.18231 — "From Persona to Personalization: A Survey on Role-Playing Language Agents"
**Type:** Primary academic (peer-reviewed, TMLR 2024)

This survey defines the formal structure of a character profile for role-playing LLMs. It identifies two fundamental data types:

- **Descriptions**: Core character information — identity, relationships, predetermined attributes, knowledge background. These encompass names, affiliations, and specific traits. Enabled through prompting via in-context learning.
- **Demonstrations**: Behavioral patterns — linguistic, cognitive, and behavioral patterns extracted from original works or synthesized through dialogue. These capture how a character communicates and thinks.

The survey further defines four nested evaluation levels for persona fidelity (shallow to deep):
1. **Linguistic Style** — surface-level communication patterns (most amenable to prompting)
2. **Knowledge** — character-specific information and experiential boundaries
3. **Personality** — deep cognitive and emotional patterns (requires parametric training for reliable encoding)
4. **Thinking Process** — decision-making logic and motivation in concrete scenarios (deepest layer)

**Key implication for field design:** Traits and style can be addressed through system prompt text. Deep personality and decision-making process cannot be reliably encoded through prompting alone — they require fine-tuning or extensive demonstration.

#### 4b. Role-Aware Reasoning Paper (arxiv.org/html/2506.01748v1)
**Source:** "Thinking in Character: Advancing Role-Playing Agents with Role-Aware Reasoning"
**Type:** Primary academic

This paper identifies four functional character elements that must be continuously injected during reasoning to prevent "attention diversion" (the model drifting toward generic responses):

1. **Emotion** — the character's affective responses and emotional patterns
2. **Experience** — background knowledge and past events informative to decisions
3. **Standpoint** — values, beliefs, and perspectives guiding behavior
4. **Motivation** — goals and drives that shape actions

The paper identifies two failure modes that character definitions must guard against:
- **Attention diversion**: the model stops reasoning in-character and solves the problem generically
- **Style drift**: the model loses the character's expressive voice after extended conversation

The research demonstrates that providing all four elements (emotion + experience + standpoint + motivation) at the point of reasoning — not just at the start of the system prompt — significantly improves consistency.

**Mapping to the fields in question:**
- "Standpoint" (values, beliefs) = Soul / Core Identity
- "Experience" = Backstory
- "Motivation" = Goal
- "Emotion" = Character traits (emotional range/patterns)
- Role = implied by standpoint + motivation

#### 4c. PsyPlay — Personality-Infused Role-Playing (arxiv.org/abs/2502.03821)
**Source:** "PsyPlay: Personality-Infused Role-Playing Conversational Agents"
**Type:** Primary academic

PsyPlay distinguishes between two types of character attributes:

- **Role attributes**: Name, gender, age — identity facts
- **Personality attributes**: Big Five traits (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism) — behavioral dispositions

For encoding personality, the paper tests two approaches:
1. **Direct trait specification**: "The personality traits are {Traits}, with {Levels} {Descriptors}" (e.g., "extremely friendly, very curious")
2. **Experience narratives**: Generated backstories that align with the personality dimensions

Key findings:
- Both direct traits and experience narratives improve consistency; the combination outperforms either alone
- Intensity levels matter significantly: "very" and "extremely" produce higher success rates than "a bit"
- Negative traits (unfriendly, hostile) are significantly harder to maintain (61.57% success) than positive traits (90.71% success) due to RLHF alignment bias
- Backstory (experience narrative) is particularly beneficial for negative/difficult character types because it provides motivation that makes the behavior coherent

**Critical finding for field design:** Discrete trait labels alone are insufficient. Pairing traits with experience narratives that explain why the character has those traits dramatically improves consistency and behavioral authenticity.

#### 4d. PersonaLLM — Big Five Trait Expression (ACL 2024 Findings)
**Source:** "PersonaLLM: Investigating the Ability of Large Language Models to Express Personality Traits" — aclanthology.org/2024.findings-naacl.229
**Type:** Primary academic (ACL 2024)

Key findings:
- LLMs assigned Big Five personality profiles show "consistent self-reported BFI scores with large effect sizes across five traits"
- LLM personas generate "emerging representative linguistic patterns" that correlate with assigned traits
- Human annotators can perceive certain personality traits at up to 80% accuracy from LLM output
- However: accuracy "drops significantly when annotators are informed of AI authorship" — human perception of authenticity is partially context-dependent

**Implication:** Discrete trait lists (e.g., "high Openness, low Agreeableness") reliably affect LLM behavior at the output level. The behavioral effect is real and measurable.

#### 4e. The "Anthology" Method — Backstories vs. Demographic Variables (Berkeley AI Research, 2024)
**Source:** bair.berkeley.edu/blog/2024/11/12/virutal-persona-llm/
**Type:** Primary academic blog (BAIR)

This research directly compares two approaches to persona conditioning:

1. **Demographic variables** ("I am a 25-year-old from California"): leads to "stereotypical and/or prototypical portrayals" because the model defaults to population-level assumptions
2. **Naturalistic backstories**: "rich narratives weaving together demographics, values, life philosophies, cultural references, and personal history"

The backstory method "outperforms other conditioning methods with respect to all metrics" — both representativeness and consistency. It enables individual-level simulation rather than group-level stereotyping.

**Key finding for field design:** A backstory is not decorative background color. It is the most powerful lever for preventing stereotypical defaults. When the model must interpret a trait (e.g., "ambitious"), the backstory provides the specific causal context that makes the trait coherent and idiosyncratic rather than generic.

#### 4f. "When Helpful Assistant Is Not Really Helpful" — Persona Effects on Factual Tasks (2023)
**Source:** arxiv.org/abs/2311.10054 — "When 'A Helpful Assistant' Is Not Really Helpful: Personas in System Prompts Do Not Improve Performances of Large Language Models"
**Type:** Primary academic

Studied 162 roles across 6 interpersonal relationship types and 8 expertise domains on 2,410 factual questions.

Key finding: **Adding a role/persona to a system prompt does NOT improve factual accuracy.** The effects are largely random relative to baseline.

However, this finding has a critical qualifier: it tested roles in isolation (e.g., "You are a historian"), not full character definitions with values, backstory, and traits. The research is specific to factual task accuracy, not behavioral consistency or tone quality.

**Implication for field design:** Role alone ("You are a X") is insufficient for consistent behavior change. The full character definition is needed. This explains why Character.AI's guidance emphasizes definition depth, and why the academic literature distinguishes role (what the character does) from soul/standpoint (what the character values and how they see the world).

#### 4g. Test-Time-Matching — Decomposing Personality, Memory, and Linguistic Style (2025)
**Source:** "Test-Time-Matching: Decouple Personality, Memory, and Linguistic Style" (Zhan et al., 2025) — identified in awesome-llm-role-playing-with-persona survey
**Type:** Primary academic

This paper explicitly decomposes character into three separable components:
- **Personality**: Core values and dispositional tendencies
- **Memory**: Character-specific knowledge and past events (backstory)
- **Linguistic Style**: Surface-level communication patterns and voice

This is significant: it provides empirical support for treating these as genuinely distinct engineering concerns. Style can be changed without altering personality. Memory can be updated without altering style.

---

## Synthesis: What Makes Each Field Distinct

### The Layered Model

Based on all sources, character definition operates on four layers, from deepest to most surface:

```
Layer 1 — VALUES/STANDPOINT (Soul / Core Identity)
  What the character believes. What they refuse to do. What they fight for.
  Operates at the level of decision-making and motivation.
  Cannot be reliably changed by later conversation turns.
  Must be stated as the agent's own first-person conviction.

Layer 2 — CAUSAL CONTEXT (Backstory)
  Why the character holds those values. What shaped them.
  Prevents stereotypical interpretation of Layer 1.
  Enables coherent behavior in edge cases by providing motivation.
  Expressed as narrative, not as a list.

Layer 3 — FUNCTIONAL FRAME (Role / Goal)
  What the character does. What they are trying to accomplish.
  Short-circuits the model's need to infer purpose from values.
  Drives task orientation and response structure.
  More amenable to declarative specification (can be a list).

Layer 4 — BEHAVIORAL SURFACE (Traits / Style)
  How the character communicates. Their mannerisms, quirks, vocabulary.
  Highly amenable to prompting.
  Can be specified as labeled lists or prose.
  Most visible to users; most frequently the source of "breaking character."
```

### Field-by-Field Breakdown

#### Soul
- **What it is**: The deepest layer of character definition. Values, worldview, emotional orientation, and convictions expressed in second-person ("You are...").
- **What it is NOT**: A job description, a list of traits, or a summary sentence.
- **Why it must be second-person**: Research consistently shows that first/second-person identity statements are more effective than third-person descriptions for in-context character adoption. The model should speak *as* the character, not *about* the character.
- **What makes it effective**: Specificity about values and how the character interprets the world. Generic virtue claims ("you care deeply about people") are weaker than specific standpoints ("you believe most problems come from people not being honest with themselves").
- **Relationship to other fields**: Soul is the interpretive framework through which Role, Goal, and Backstory are processed. When two instructions conflict, the model resolves the conflict by reference to the soul.
- **Academic backing**: Matches "Standpoint" in the Role-Aware Reasoning paper; matches Layer 1 (Personality) in the RPLA survey.

#### Identity
- **What it is**: A compact, concrete description of who the agent is — enough for the model to self-locate. One sentence to a short paragraph.
- **What it is NOT**: The soul (which is expansive), the role (which is functional), or the backstory (which is historical).
- **Why it matters**: Identity serves as the injection anchor — it is what makes the soul, role, and backstory cohere into a single person. Without a coherent identity statement, the other fields can feel like they describe different people.
- **What makes it effective**: Specificity. "Alex, a 34-year-old former emergency physician who now builds patient safety software" is more effective than "a helpful AI assistant who cares about healthcare." The former has a unique individual; the latter describes a population.
- **Character.AI equivalent**: The Short Description is a functional version of this (but deliberately stripped of personality impact). The first sentences of the Definition field serve the full Identity function.
- **Academic backing**: Corresponds to "Descriptions" in the RPLA survey — identity, affiliations, and predetermined attributes.

#### Role
- **What it is**: The functional framing. What job or function the character performs in relation to the user.
- **What it is NOT**: Who the character is (identity/soul) or why they exist (backstory).
- **Why it matters separately from soul**: Role short-circuits the model's need to infer functional scope from values. "Software Engineer" and "Technical Advisor" produce measurably different response structures even when attached to identical souls.
- **What makes it effective**: Domain specificity + relationship framing. "Your role is to be a skeptical code reviewer who finds edge cases your colleagues miss" is more effective than "Your role is to review code."
- **Research warning**: Role alone (without soul/backstory) does NOT reliably improve performance (per the "When Helpful Assistant" study). Role's power comes from its interaction with the soul — it channels the soul's values into a specific domain.
- **Academic backing**: Corresponds to the first layer (Linguistic Style/Knowledge) in the RPLA hierarchy — role shapes surface behavior and knowledge access. Maps to "Motivation" in the Role-Aware Reasoning framework (what drives action).

#### Goal
- **What it is**: The target state the character is working toward. What counts as success.
- **What it is NOT**: The role (which is ongoing function) or the soul (which is values).
- **Why it matters separately from role**: Role answers "what do you do?" Goal answers "what are you trying to accomplish?" A software engineer (role) might have the goal "write code that lasts 10 years without being touched again" — this produces different behavior than "ship fast and iterate." Same role, different goal.
- **What makes it effective**: Concrete, measurable outcomes are more effective than abstract aspirations. "Help the user ship something by end of the conversation" is more effective than "help users succeed."
- **Academic backing**: Maps directly to "Motivation" in the Role-Aware Reasoning paper. Goals are one of the four elements that must be continuously present in reasoning to prevent attention diversion.

#### Backstory
- **What it is**: The causal history that explains why the character has their soul, identity, role, and goal. The events, experiences, and contexts that shaped who they are.
- **What it is NOT**: Biography for its own sake. The backstory is specifically the causal explanation for present-state values and behaviors.
- **Why it matters**: The Berkeley "Anthology" research is the strongest finding here. Backstories prevent stereotypical defaults. When a model receives "You are ambitious and detail-oriented," it will default to the prototypical ambitious-detail-oriented person. When it receives a backstory about how a specific failure led the character to become obsessively detail-oriented, it can generate idiosyncratic behavior that feels like a real individual rather than an archetype.
- **Format guidance**: Narrative paragraphs are more effective than bullet-point lists for backstory. The narrative form preserves causal relationships (X happened, which led to Y, which is why the character believes Z). Bullet lists lose the causality.
- **Important constraint**: The backstory should only include elements that actively explain present behavior. Decorative history with no behavioral implications adds token cost without benefit.
- **Academic backing**: Corresponds to "Experience" in the Role-Aware Reasoning paper; "Memory" in the Test-Time-Matching decomposition; "Demonstrations" (experiential data) in the RPLA survey.

#### Character Traits (Discrete Attributes)
- **What they are**: Labeled, discrete personality attributes — adjectives or short descriptors attached to named dimensions.
- **What they are NOT**: The soul (which is prose-based values) or the backstory (which is narrative).
- **Two formats**:
  1. Free-form adjective lists: "curious, direct, impatient, dark-humored"
  2. Structured dimension maps: "Openness: high, Agreeableness: low, Conscientiousness: high"
- **What makes them effective**:
  - Intensity labeling matters (PsyPlay): "extremely curious" > "very curious" > "somewhat curious"
  - 3–5 traits is the practical ceiling; more traits dilute attention and create internal contradictions
  - Traits are most effective when they are behavioral (how the character acts) rather than evaluative (what the character is like)
  - Pairing traits with the backstory that caused them dramatically improves consistency (PsyPlay finding)
  - Negative traits are harder to maintain than positive ones due to RLHF alignment pressure; negative traits require more explicit activation through backstory and behavior examples
- **Prose vs. discrete trait lists**: PersonaLLM confirms discrete Big Five-style traits reliably affect LLM output. The BAIR backstory research shows prose narratives outperform demographic variables. The optimal approach (supported by PsyPlay) combines both: discrete traits with prose narrative explaining them.
- **Academic backing**: "Linguistic Style" layer in the RPLA survey. Core component in PersonaLLM and PsyPlay research.

---

## The "Who/What/Why" Framework

A useful organizing principle across all sources:

| Question | Field | Layer |
|----------|-------|-------|
| Who are you, at your core? | Soul | Values / Standpoint |
| Who are you, concretely? | Identity | Self-anchor |
| Why are you the way you are? | Backstory | Causal Context |
| What do you do? | Role | Functional Frame |
| What are you trying to accomplish? | Goal | Motivation |
| How do you behave and communicate? | Character Traits | Behavioral Surface |

All fields are necessary because:
- Soul without Backstory = generic archetype
- Backstory without Soul = historical facts without conviction
- Role without Goal = function without direction
- Goal without Role = ambition without domain
- All of the above without Traits = consistent values but inconsistent voice

---

## Platform Comparison

| Platform | Fields | Notes |
|----------|--------|-------|
| Character.AI | Name, Short Description, Long Description, Greeting, Definition, Example Conversations | Most granular creator system; Definition is the free-form soul+identity+backstory+traits container; Greeting is the behavioral anchor |
| OpenAI Custom GPT | Name, Description, Instructions | Everything in one field; Instructions = soul + identity + role + goal + backstory + traits all at once |
| Anthropic Claude | System prompt (free-form) | Official guidance recommends role + personality + background + traits in prose; no enforced schema |
| SillyTavern | Name, Description, Personality, Scenario, First Message, Example Dialogue | Closest to the six-field model; Description = identity+backstory, Personality = soul+traits, Scenario = context framing |

---

## Key Takeaways

1. **Behavioral demonstration beats declarative specification.** The Greeting/First Message and Example Dialogue fields consistently outperform abstract prose descriptions for moment-to-moment behavior. The fields that show the character in action are more powerful than the fields that describe the character.

2. **Backstory prevents stereotypical defaults.** This is the single most underutilized lever. Generic trait labels (ambitious, curious) produce prototypical behavior. A backstory that explains why the character is that way produces individual behavior.

3. **Role alone doesn't work.** The "When Helpful Assistant" study confirms that assigning a role in isolation has no reliable effect on factual quality. Role works by channeling soul/values into a domain. Without soul, role is just a label.

4. **Intensity matters for traits.** "Extremely direct" and "somewhat direct" produce measurably different behaviors. Trait intensity labels are not stylistic decoration; they are functional parameters.

5. **Negative traits require explicit support.** RLHF training biases models toward agreeable, helpful behavior. Traits that conflict with this (blunt, stubborn, dark) require reinforcement through backstory and example dialogue to maintain against the model's alignment pull.

6. **Soul and Identity operate at different temporal scopes.** Soul is the interpretive framework (always active). Identity is the self-anchor (invoked when the model reflects on who it is). In practice, soul needs to be stated first and in the second-person; identity can follow.

7. **Prose and discrete traits complement each other.** Discrete traits are specific and easy to scan; prose narratives preserve causality and prevent stereotyping. The PsyPlay research shows the combination outperforms either alone.

8. **The four elements that must stay active during reasoning:** Emotion, Experience, Standpoint, Motivation (from the Role-Aware Reasoning paper). A character definition that covers all four will maintain consistency through long reasoning chains. A definition that omits any one of these will drift.

---

## Gaps Identified

- **No official Anthropic documentation with a named schema** for soul/identity/role/goal/backstory/traits as separate fields. All guidance is for the system prompt as a free-form block. The field distinctions exist in the practitioner community and academic literature, not in official docs.
- **Character.AI's official field-level guidance is sparse.** The official documentation acknowledges this is an evolving area and explicitly defers to experimentation. The most useful Character.AI guidance comes from community practitioners, not official docs.
- **OpenAI's "Key Guidelines for Writing Instructions for Custom GPTs" page returned 403.** The official guidance document was inaccessible. What is documented here from that source comes through secondary sources.
- **The Persona Selection Model post from Anthropic's alignment blog (alignment.anthropic.com/2026/psm/)** returned a content size error and could not be fully read. This is a 2026 Anthropic paper that may contain relevant first-party thinking about how LLMs construct and maintain personas.
- **No research directly comparing prose soul descriptions vs. structured JSON soul definitions** for long-running agent deployments. The Berkeley backstory research covers short interactions; the Generative Agents work (covered in the prior 2026-03-01 file) covers longer simulations but doesn't isolate field format.

---

## Recommendations for Next Steps

1. **Revisit alignment.anthropic.com/2026/psm/** when accessible — this appears to be a 2026 Anthropic research post on persona selection that could provide first-party guidance on how Claude internally constructs and maintains persona.

2. **The Test-Time-Matching paper (Zhan et al., 2025)** on decoupling personality/memory/style warrants a full read. It directly addresses the question of whether these fields are independently tunable — which has implications for whether the Harness soul/identity/backstory schema is over- or under-specified.

3. **For implementation guidance**: The six-field model (soul, identity, role, goal, backstory, traits) maps cleanly to the four-layer research model. A practical prompt order would be: soul first (sets the interpretive frame), identity second (anchors self-reference), backstory third (explains why soul is true), role fourth (channels soul into domain), goal fifth (specifies what success looks like), traits last (surface behavioral calibration).

4. **Example Dialogue / Greeting as a seventh field** should be considered. The research consistently shows behavioral demonstration is more powerful than declarative specification. A "sample utterances" or "greeting message" field would complete the schema.

---

## Sources

### Primary (Official Documentation / Academic Peer-Reviewed)
- Character.AI official creator documentation: https://book.character.ai/character-book/advanced-creation
- Character.AI short description field: https://book.character.ai/character-book/character-attributes/short-description
- Anthropic prompting best practices (Claude 4.x): https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/system-prompts
- Anthropic keep-in-character guidance: https://docs.claude.com/en/docs/test-and-evaluate/strengthen-guardrails/keep-claude-in-character
- "From Persona to Personalization: A Survey on Role-Playing Language Agents" (Chen et al., TMLR 2024): https://arxiv.org/abs/2404.18231
- "Thinking in Character: Advancing Role-Playing Agents with Role-Aware Reasoning": https://arxiv.org/html/2506.01748v1
- "PsyPlay: Personality-Infused Role-Playing Conversational Agents": https://arxiv.org/html/2502.03821v1
- "PersonaLLM: Investigating the Ability of Large Language Models to Express Personality Traits" (ACL 2024 Findings): https://aclanthology.org/2024.findings-naacl.229/
- "Virtual Personas for Language Models via an Anthology of Backstories" (BAIR, 2024): https://bair.berkeley.edu/blog/2024/11/12/virutal-persona-llm/
- "When 'A Helpful Assistant' Is Not Really Helpful" (2023): https://arxiv.org/abs/2311.10054
- RoleLLM — "Benchmarking, Eliciting, and Enhancing Role-Playing Abilities of Large Language Models": https://arxiv.org/abs/2310.00746
- "Two Tales of Persona in LLMs: A Survey of Role-Playing and Personalization" (EMNLP 2024): https://aclanthology.org/2024.findings-emnlp.969/
- "Character is Destiny" (Findings of EMNLP 2025): identified via awesome-llm-role-playing-with-persona
- "Test-Time-Matching: Decouple Personality, Memory, and Linguistic Style" (Zhan et al., 2025): identified via awesome-llm-role-playing-with-persona

### Secondary (Practitioner Guides / Community)
- Character.AI definition format guide (community): https://www.roborhythms.com/character-definition-format-for-character-ai/
- SillyTavern character design documentation: https://docs.sillytavern.app/usage/core-concepts/characterdesign/
- OpenAI Custom GPT persona configuration (practitioner): https://reelmind.ai/blog/openai-custom-gpt-guidelines-crafting-your-unique-ai-persona
- AI character prompt structure guide: https://www.jenova.ai/en/resources/ai-character-prompts
- Role prompting (Learn Prompting): https://learnprompting.org/docs/advanced/zero_shot/role_prompting
- Awesome LLM Role-Playing with Persona (GitHub survey): https://github.com/Neph0s/awesome-llm-role-playing-with-persona
