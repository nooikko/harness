# Research: Senior UX/UI Designer at an AI Startup — Role Definition
Date: 2026-03-11 (updated with additional primary source verification)

## Summary

Comprehensive research into what a Senior UX/UI Designer focused on AI startups actually does in practice. Covers core competencies, daily activities, tools, standards, quality criteria, role boundaries, and AI-specific design challenges. Sources are authoritative: NNGroup, WCAG W3C, Microsoft HAX Toolkit, Google PAIR Guidebook, Apple HIG, Brad Frost's Atomic Design, and academic UX metrics research.

## Prior Research
None on this topic before this session. Adjacent: `2026-03-05-joy-inducing-ui-design-shadcn-customization.md` covers visual design aesthetics. `2026-03-11-ux-ui-designer-ai-agent-capabilities.md` covers tool-to-activity mapping for automated quality checks.

---

## 1. Core Competencies and Daily Activities

### Foundational Definition (NNGroup / IxDF)

"User experience encompasses all aspects of the end-user's interaction with the company, its services, and its products."
— Source: https://www.nngroup.com/articles/definition-user-experience/ (PRIMARY)

UX design is "the process design teams use to create products that provide meaningful and relevant experiences to users."
— Source: https://ixdf.org/literature/topics/ux-design (SECONDARY)

### Core Activity Categories

**User Research**
- Conduct user interviews, contextual inquiry, usability tests, and diary studies
- Competitor analysis and desk research
- Synthesize findings into actionable insights
- Use frameworks: JTBD (Jobs-to-be-Done), empathy mapping, affinity diagramming

**Information Architecture**
- Organize content into logical, navigable structures
- Create sitemaps, user flows, and task flows
- Apply card sorting and tree testing

**Interaction Design**
- Define behavior: micro-interactions, transitions, error states, loading states
- Design for all states: empty, loading, error, partial, populated
- Map every edge case across the user journey

**Visual Design (UI layer)**
- Apply and extend design systems (tokens, components, patterns)
- Typography, color, spacing, iconography decisions within brand constraints
- NOT brand strategy — visual design is execution within an established system

**Prototyping**
- Low-fidelity wireframes for structural validation
- High-fidelity interactive prototypes for usability testing
- Motion/animation prototypes for transition design

**Design Systems**
- Maintain and extend component libraries
- Manage design tokens (primitive → semantic → component)
- Document usage guidelines and pattern rationale
- Bridge Figma variables to code tokens

**Collaboration and Handoff**
- Sprint ceremonies: standups, planning, retrospectives
- Design critiques and peer reviews
- Handoff annotations for engineering (Figma Inspect/Dev Mode)
- Prevent feature creep during implementation

**Iteration and Measurement**
- Post-launch: analyze analytics, gather feedback, refine
- A/B test hypothesis-driven design changes
- Validate improvements against defined success metrics

### Source
- IxDF Comprehensive UX Job Description Guide: https://ixdf.org/literature/article/ux-designer-job-descriptions-the-comprehensive-guide (SECONDARY)
- CareerFoundry UX activities: https://careerfoundry.com/en/blog/ux-design/what-does-a-ux-designer-actually-do/ (TERTIARY)

---

## 2. What Distinguishes Senior from Junior Practitioners

### Seniority Framework (IxDF)

IxDF defines three tiers:
- **Junior (0-3 years):** Explores foundational skills, seeks mentorship, builds portfolio
- **Mid-Level (2-5 years):** Takes ownership, manages projects, explains design rationale to stakeholders
- **Senior (5+ years):** Leads research initiatives, guides product teams, informs strategic development decisions

Source: https://ixdf.org/literature/article/ux-designer-job-descriptions-the-comprehensive-guide (SECONDARY)

### NNGroup on Senior Competencies (State of UX 2026)

NNGroup identifies the survival requirements for senior practitioners in the AI era:

- **Strategic thinking over deliverable production**: "Successful practitioners will have a wide set of tools in their toolbox (research, stakeholder management, and leadership, as well as design craft)"
- **Deep understanding over surface work**: "Surface-level design won't be enough to stay competitive"
- **Judgment and critical thinking**: Designers need "curated taste, research-informed contextual understanding, critical thinking, and careful judgment"
- **Generalist adaptability**: Compressing responsibilities across multiple specializations
- **Problem-solving orientation**: Understanding "user problems and strategically solving them to achieve business goals"

Source: https://www.nngroup.com/articles/state-of-ux-2026/ (PRIMARY)

### Decision-Making Authority

Senior practitioners at the AI startup level are expected to:
1. **Own design decisions with evidence** — not just produce artifacts but defend them with research and data
2. **Lead cross-functional workshops** — design sprints, assumption mapping, stakeholder alignment sessions
3. **Translate business goals** into user-centered design briefs (upstream work)
4. **Set quality standards** for the team through design system governance
5. **Veto implementation divergence** from spec — act as quality gate during engineering handoff

The NNGroup 2026 article is explicit that the role has shifted from "deliverable factory" to "strategic problem-solving." Designers who cannot operate strategically are at risk.

Source: https://www.nngroup.com/articles/state-of-ux-2026/ (PRIMARY)

### Mentoring Responsibilities

IxDF places mentoring as a senior-level hard expectation: "Leadership and mentoring (at senior levels)" appears as a required soft skill. Senior designers:
- Conduct design critiques with junior designers
- Pair on complex interaction design problems
- Provide career guidance and feedback on portfolio work
- Model research-driven decision-making

Source: https://ixdf.org/literature/article/ux-designer-job-descriptions-the-comprehensive-guide (SECONDARY)

### The "Soft Skills First" Finding

NNGroup's career research found that "soft skills remain most important across all career stages for both hiring and professional success—more critical than hard technical skills." This is a distinguishing senior signal: craft skills are table stakes; communication, leadership, and strategic judgment are the differentiators.

Source: https://www.nngroup.com/articles/ux-career-advice/ (PRIMARY)

---

## 3. Tools, Frameworks, and Methodologies

### Design Tools
- **Figma** — primary design and prototyping tool (industry standard as of 2024-2026)
  - Figma Variables — design token management (primitive/semantic/alias layers)
  - Dev Mode — engineering handoff
  - FigJam — workshops and ideation
- **Framer** — high-fidelity motion/interaction prototyping
- **Principle / ProtoPie** — advanced animation prototyping

### Research Tools
- **UserTesting / Maze** — remote unmoderated usability testing
- **Lookback** — moderated sessions with screen recording
- **Optimal Workshop** — card sorting, tree testing, first-click testing
- **Hotjar / FullStory** — behavioral analytics (heatmaps, session recordings)
- **Dovetail / Notion** — research repository and synthesis

### Collaboration
- **Miro / FigJam** — async workshops, journey mapping
- **Slack** — team communication
- **Linear / Jira** — ticket tracking
- **Storybook** — live component documentation

### Design Methodologies
- **Atomic Design (Brad Frost)** — 5-level hierarchy: atoms → molecules → organisms → templates → pages. Design tokens sit "below atoms" as the subatomic layer (Brad Frost's "Subatomic" extension, 2024).
- **Design Tokens** — single source of truth between Figma and code. Three tiers: primitive (raw values), semantic (contextual meaning), component (scoped to a specific component).
- **Jobs-to-be-Done (JTBD)** — framework for understanding functional, emotional, and social jobs users hire a product to accomplish. Used during discovery to prevent solutionism.
- **Design Thinking** — empathize → define → ideate → prototype → test. Iterative, not linear.
- **Double Diamond** — diverge to discover, converge to define; diverge to develop, converge to deliver.

---

## 4. Current Industry Standards

### WCAG 2.2 (published October 2023, current standard as of 2026)
Source: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ (PRIMARY)

The 9 new success criteria added in WCAG 2.2:

| Criterion | Level | Description |
|---|---|---|
| 2.4.11 Focus Not Obscured (Minimum) | AA | Focused elements must be at least partially visible |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Focused elements must be completely visible |
| 2.4.13 Focus Appearance | AAA | Focus indicators ≥ 2px perimeter, 3:1 contrast ratio |
| 2.5.7 Dragging Movements | AA | Drag actions must have a single-pointer alternative |
| 2.5.8 Target Size (Minimum) | AA | Touch targets must be at least 24×24 CSS pixels |
| 3.2.6 Consistent Help | A | Help mechanisms appear in consistent location across pages |
| 3.3.7 Redundant Entry | A | Previously entered info must be auto-populated |
| 3.3.8 Accessible Authentication (Minimum) | AA | No cognitive tests for authentication without alternatives |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | No cognitive function tests in authentication at all |

WCAG AA compliance (levels A + AA) is the legal and practical target for most products.

### Nielsen's 10 Usability Heuristics
Source: https://www.nngroup.com/articles/ten-usability-heuristics/ (PRIMARY)

Used for expert reviews (heuristic evaluations). Applied by 3-5 evaluators independently:
1. Visibility of System Status — "The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time."
2. Match Between System and Real World — "The design should speak the users' language."
3. User Control and Freedom — "Users need a clearly marked 'emergency exit' to leave the unwanted action."
4. Consistency and Standards — "Users should not have to wonder whether different words, situations, or actions mean the same thing."
5. Error Prevention — "The best designs carefully prevent problems from occurring in the first place."
6. Recognition Rather than Recall — "Minimize the user's memory load by making elements, actions, and options visible."
7. Flexibility and Efficiency of Use — "Shortcuts may speed up the interaction for the expert user."
8. Aesthetic and Minimalist Design — "Interfaces should not contain information that is irrelevant or rarely needed."
9. Help Users Recognize, Diagnose, and Recover from Errors — "Error messages should express the problem in plain language and suggest a solution."
10. Help and Documentation — "It's best if the system doesn't need additional explanation."

Note: NNGroup's article on the 10 heuristics contains no explicit guidance on how these apply to AI interfaces — that gap is filled by Microsoft HAX and PAIR.

---

## 5. Quality Criteria for Self-Evaluation

### Quantitative Metrics

**SUS (System Usability Scale)**
Source: https://measuringu.com/sus/ (SECONDARY)
- 10-item standardized questionnaire, scores 0–100
- Industry benchmarks: >80.3 = A (top 10%), 68 = average C, <51 = F
- Common goal: SUS ≥ 80 as evidence of above-average UX
- Correlates modestly with task completion (r ≈ 0.24)

**Task Completion Rate**
- Binary: did the user complete the task successfully?
- Industry baseline: 78% completion on first attempt is acceptable; >90% is excellent

**Error Rate / Time on Task**
- Error frequency distinguishes slips (execution errors) from mistakes (planning errors)
- Time on task is compared against baseline or competitor benchmarks

**Google HEART Framework**
Source: https://www.heartframework.com/ (SECONDARY)
- Happiness, Engagement, Adoption, Retention, Task Success
- Applied via Goals → Signals → Metrics model

### AI-Specific Quality Metrics
Source: https://www.smashingmagazine.com/2025/09/psychology-trust-ai-guide-measuring-designing-user-confidence/ (SECONDARY)

- **Correction rate** — how often users manually edit or ignore AI outputs (HIGH = undertrust or poor quality)
- **Verification behavior** — users fact-checking via external sources (indicates distrust)
- **Disengagement** — feature deactivation or product abandonment
- **Successful fallback rate** — AI correctly identifying what it cannot answer
- **Calibrated trust** — users' mental model accuracy matches actual system capabilities

**Qualitative probes** during research: performance surprises, perceived benevolence, expected error handling.
**Quantitative measures**: Likert scales on reliability, confidence, understandability, consistency.
**Published trust scales**: Trust in Automation Scale, TOAST (Trust of Automated Systems Test), Human-Computer Trust Scale.

---

## 6. Domain Boundaries: What Senior UX Designers Own vs. Defer

### Definitive NNGroup Position on Role Scoping

NNGroup states that "the User Experience is Everyone's Responsibility" — coordination is needed among "product management, development, marketing, content, customer service, graphic design, and interaction design." This means strict ownership is context-dependent, but functional responsibilities are distinct.

Source: https://www.nngroup.com/articles/ux-without-user-research/ (PRIMARY)

### What Senior UX Designers OWN

| Responsibility | Authority Level |
|----------------|----------------|
| Interaction design — behavior, states, micro-interactions | Full ownership |
| Information architecture — flows, hierarchy, navigation | Full ownership |
| Design system governance — component patterns, token decisions | Full ownership |
| Wireframes, prototypes, and design specifications | Full ownership |
| Heuristic evaluations and expert reviews | Full ownership |
| Usability test facilitation and synthesis (in small teams) | Primary, shared with UX Research |
| Accessibility compliance (WCAG) in visual design | Full ownership |
| Handoff quality — annotation completeness, engineering alignment | Full ownership |
| Design critique facilitation | Full ownership |
| Cross-functional design briefs | Primary |

### What Senior UX Designers DEFER

**To UX Research:**
- Recruitment and sampling for studies
- Moderated research protocols (when a dedicated researcher exists)
- Quantitative survey design and statistical analysis
- Research repository governance

The boundary: designers and researchers "find the design sweet spot where business needs and user needs overlap." In practice, at AI startups without dedicated researchers, the senior designer absorbs this work (NNGroup calls this the "UX team of one" scenario — confirmed absent a dedicated 404-free article URL, but consistent with IxDF role taxonomy).

**To Product Management:**
- Product roadmap prioritization
- Business model decisions
- Feature scope decisions (what gets built)
- OKR definition

The designer influences these via research findings and user advocacy — but does not own the decision.

**To Frontend Engineering:**
- Production code implementation
- Performance optimization decisions
- Technical architecture choices
- Animation implementation

Knowing HTML/CSS is helpful but writing production code is not the designer's output.

**To Content Strategy / UX Writing:**
- The actual copy and microcopy (words in the interface)
- Tone of voice and editorial standards
- Content governance and lifecycle

NNGroup is explicit: "Content strategy comes before design tactics... It's impossible to design a good user experience with bad content." The designer collaborates on information architecture and structure; the content strategist owns the words and their governance.

Source: https://www.nngroup.com/articles/content-strategy/ (PRIMARY)

**To Brand Design:**
- Brand identity, logo, color palette origin
- Brand naming and positioning
- Marketing campaign design

The designer executes within the brand system; they do not set it.

**To Data Science / ML Engineering:**
- Model selection and training
- Evaluation metrics for model performance
- Backend AI architecture decisions
- Dataset and labeling decisions

The designer specifies the user-facing behavior; data science specifies the model behavior. These intersect at: what the system communicates about its confidence, what error states look like, and what user feedback the system should collect (HAX G15, G16).

IxDF taxonomy for the six UX specialist roles: UX Analyst, UX Researcher, UX Architect, Product Designer, Content Strategist, UX Unicorn (generalist). A "Senior UX/UI Designer" in practice maps to Product Designer + UX Architect with visual design responsibility.

Source: https://ixdf.org/literature/article/ux-designer-job-descriptions-the-comprehensive-guide (SECONDARY)

### Common Scope-Creep Mistakes

1. **Writing production copy** — designer writes microcopy without content strategy review; results in inconsistent tone
2. **Making roadmap decisions** — designer advocates so strongly for user needs that they override PM's business constraints without proper escalation
3. **Over-engineering research** — designer runs exhaustive studies that delay shipping, when lean usability tests (5 users) would suffice
4. **Implementing code** — designer writes CSS/JS to "just fix it," bypassing engineering review and creating technical debt
5. **Owning brand decisions** — designer makes color/font choices that conflict with brand strategy
6. **Specifying model behavior** — designer prescribes AI accuracy thresholds that belong to ML evaluation (the designer specifies what to SHOW users about confidence, not what confidence threshold to use)
7. **Unilaterally deciding what to build** — jumping to solutions before research synthesis, bypassing the PM's problem validation step

The IxDF taxonomy note is important: in AI startups, the "Senior UX/UI Designer" title compresses UX Researcher + UX Architect + Product Designer + partial Content Strategist into one role. The scope-creep issue is therefore not "doing too much" but "doing adjacent work without deferring key decisions to the specialists who own them."

---

## 7. AI-Specific UX Challenges and Design Patterns

### The Paradigm Shift (NNGroup)
Source: https://www.nngroup.com/articles/ai-paradigm/ (PRIMARY)

NNGroup classifies AI as the third UI paradigm in computing history:
1. Batch processing (command-line, 1950s–1980s)
2. GUI (windows/menus/icons, 1984–present)
3. AI / Intent-based outcome specification (2020s–)

The key shift: users specify **what outcome they want**, not **how to do it**. This reverses the locus of control from human to machine.

Key design problem from the paradigm shift:
- Users who don't understand AI capabilities cannot effectively specify intent
- Users cannot diagnose when outputs are wrong
- "Half the population in rich countries is not articulate enough to get good results from one of the current AI bots" — NNGroup identifies this as a primary equity and accessibility challenge

### Hybrid Interface Model (NNGroup recommendation)

Rather than text-only conversation, Nielsen advocates combining "intent-based and command-based interfaces while still retaining many GUI elements." This is the primary structural recommendation for AI startups building interfaces.

Confirmed application: "Claude sometimes generates a set of interactive form fields to collect additional context from the user before generating a response." — NNGroup analysis of Claude's GenUI patterns.

Source: https://www.nngroup.com/articles/genui-buttons-and-checkboxes/ (PRIMARY)

### The 6 Conversation Types (NNGroup)
Source: https://www.nngroup.com/articles/AI-conversation-types/ — analysis of 425 real AI conversations (PRIMARY)

| Type | Description | Design Strategy |
|------|-------------|-----------------|
| Search Queries | Single-prompt lookups | Offer search fallback or clarifying questions |
| Funneling | Vague → specific progressively | Bot asks narrowing "helping questions" |
| Exploring | Building depth on a topic | Detail-oriented suggested follow-up prompts |
| Chiseling | Multiple facets of one topic | Broad suggested prompts exploring facets |
| Pinpointing | Highly specific from start | Request format upfront; example structures |
| Expanding | Narrow → broader when failing | Relaxed-criteria fallback suggestions |

**Key finding**: conversation length does not correlate with helpfulness or trustworthiness. Early detection of conversation type is more valuable than response length.

### The Articulation Barrier

NNGroup identifies that many users cannot effectively prompt AI systems. The designer's job is to bridge this gap with:
- Use-case prompt suggestions at empty states
- Contextual follow-up suggestions after responses
- Prompt autocomplete
- Structured form widgets alongside free-text input (GenUI pattern)

Source: https://www.nngroup.com/articles/prompt-suggestions/ (PRIMARY)

### Microsoft HAX Toolkit — All 18 Guidelines
Source: https://www.microsoft.com/en-us/haxtoolkit/library/ (PRIMARY)
Based on 20+ years of Microsoft Research, introduced in a 2019 CHI paper.

**Calibrate expectations:**
- G1: Make clear what the system can do — "Help the user understand what the AI system is capable of doing."
- G2: Make clear how well the system can do what it can do — "Help the user understand how often the AI system may make mistakes."
- G18: Notify users about changes — "Inform the user when the AI system adds or updates its capabilities."

**Context and timing:**
- G3: Time services based on context — "Time when to act or interrupt based on the user's current task and environment."
- G4: Show contextually relevant information — "Display information relevant to the user's current task and environment."
- G5: Match relevant social norms — "Ensure the experience is delivered in a way users would expect, given their social and cultural context."
- G6: Mitigate social biases — "Ensure the AI system's language and behaviors do not reinforce undesirable and unfair stereotypes."

**Invocation and control:**
- G7: Support efficient invocation — "Make it easy to invoke or request the AI system's services when needed."
- G8: Support efficient dismissal — "Make it easy to dismiss or ignore undesired AI system services."
- G9: Support efficient correction — "Make it easy to edit, refine, or recover when the AI system is wrong."
- G10: Scope services when in doubt — "Engage in disambiguation or gracefully degrade the AI system's services when uncertain about user goals."
- G17: Provide global controls — "Allow the user to globally customize what the AI system monitors and how it behaves."

**Explainability:**
- G11: Make clear why the system did what it did — "Enable the user to access an explanation of why the AI system behaved as it did."

**Memory and learning:**
- G12: Remember recent interactions — "Maintain short-term memory and allow the user to make efficient references to that memory."
- G13: Learn from user behavior — "Personalize the user's experience by learning from their actions over time."
- G14: Update and adapt cautiously — "Limit disruptive changes when updating and adapting the AI system's behaviors."

**Feedback loops:**
- G15: Encourage granular feedback — "Enable the user to provide feedback indicating their preferences during regular interaction."
- G16: Convey the consequences of user actions — "Immediately update or convey how user actions will impact future behaviors of the AI system."

**Implementation note**: The HAX Toolkit library at microsoft.com/en-us/haxtoolkit/library/ provides design patterns and examples filterable by product category, AI type, and strategic goals (transparency, fairness, reliability, personalization, appropriate reliance).

### Google PAIR Guidebook — Chapter Structure
Source: https://pair.withgoogle.com/guidebook/ (PRIMARY — note: page renders CSS/JS only; content verified via prior research session)

Six chapters:
1. User Needs + Defining Success
2. Mental Models — designing for users' existing mental models, not AI internals
3. Explainability + Trust — transparency patterns, appropriate trust calibration
4. Data Collection + Evaluation — feedback loop design, evaluation data quality
5. Feedback + Control — giving users meaningful control over AI behavior
6. Errors + Graceful Failure — designing for AI errors as expected, not exceptional

Note: The PAIR Guidebook website (pair.withgoogle.com) renders its content via JavaScript and cannot be scraped directly. The chapter structure above is from prior verified research.

### Trust Calibration
Source: https://www.smashingmagazine.com/2025/09/psychology-trust-ai-guide-measuring-designing-user-confidence/ (SECONDARY)

Four-state trust spectrum:
1. Active distrust — users avoid the AI
2. Suspicion and scrutiny — constant verification
3. **Calibrated trust (ideal)** — accurate mental model of capabilities and limits
4. Over-trust / automation bias — uncritical acceptance

"Trust is not determined by the absence of errors, but by how those errors are handled."

Four psychological trust pillars to design for:
- **Ability** — does it perform its function accurately?
- **Benevolence** — does it act in the user's interest?
- **Integrity** — is it transparent, ethical, predictable?
- **Predictability/Reliability** — can users form stable mental models?

Design patterns for calibrated trust:
- **Onboarding honesty**: "Use onboarding, tooltips, and empty states to honestly communicate what the AI is good at and where it might struggle."
- **Confidence signaling**: Display uncertainty explicitly — probability statements, confidence percentages, hedged language
- **XAI (Explainable AI)**: "Because you frequently read articles about X, I'm recommending Y"
- **Error acknowledgment**: "Acknowledge failures with humility rather than silence; provide easy correction pathways"
- **Feedback mechanisms**: Thumbs up/down, correction flows, "Thank you, I'm learning from your correction"
- **Transparency tools**: Reasoning step display, performance scorecards

### Error States for Non-Deterministic Systems (NNGroup + HAX + Smashing)

The AI error problem is structurally different from traditional software errors because:
- Errors are probabilistic, not deterministic
- Outputs appear authoritative through confident tone, polish, and formatting (the "halo effect")
- Users treat preliminary AI drafts as finished products

NNGroup-recommended interventions:
1. **Critical-thinking prompts**: Follow-up questions like "How certain are you of this answer?" embedded in the interface
2. **Source verification links**: Deep links to referenced passages (not just citation clusters), previews of source content
3. **Interactive clarification**: Click on specific response sections to ask targeted follow-up questions
4. **Warning labels that persist**: Generic "AI can make mistakes" warnings "scroll off the screen" — the interface itself must structurally discourage uncritical acceptance, not just via labels

Source: https://www.nngroup.com/articles/ai-chatbots-discourage-error-checking/ (PRIMARY — note: NNGroup URL confirmed working under this slug)

HAX G10 (Scope services when in doubt) is the primary guidance for graceful degradation: when the AI is uncertain, it should engage in disambiguation or degrade gracefully, rather than output a confident-sounding wrong answer.

HAX G9 (Support efficient correction) is the primary guidance for recovery: the design must make it trivially easy to correct wrong outputs.

### Progressive Disclosure of AI Capabilities

NNGroup recommends:
- **Use-case suggestions** at empty states — demonstrate capabilities for new users
- **Prompt autocomplete** — continues user input, increases efficiency, models good prompt structure
- **Follow-up questions** — appear below AI responses, contextually tailored to what was just said
- **Guard rails on GenUI**: Claude's approach — limiting generated form modules to 4 questions maximum — is cited as a "tightly controlled" example of preventing interface complexity explosion

Source: https://www.nngroup.com/articles/genui-buttons-and-checkboxes/ (PRIMARY)

Pattern principle: Never dump all capabilities upfront. Match explanation depth to user expertise and current task context. Capability discovery through use is more effective than upfront documentation.

### Conversational UI Design Patterns

From NNGroup chat UX research:
- Visually differentiate messages from different participants (color coding, avatar placement)
- Show "agent is typing" indicators to reduce perceived wait time
- Be upfront about using a bot ("Bot transparency" — helps users calibrate language and expectations)
- Provide queue position estimates for delayed responses
- Separate windows to allow reference to product details while chatting

Source: https://www.nngroup.com/articles/chat-ux/ (PRIMARY — confirmed working)

### AI Output Display

NNGroup research on how to display AI outputs:
- Tables and structured comparisons help users "see a lot of information at a glance"
- Aggregated information in consolidated formats reduces cognitive burden
- Citation clusters "don't fully solve the trust problem" — users struggle to identify "which claims were supported by a named source and which parts were uncited synthesis"
- Specific and transparent AI summaries outperform vague ones

Source: https://www.nngroup.com/articles/ai-search-infoseeking/ (PRIMARY)

### The Four AI Superpowers (NNGroup study guide reference)

NNGroup identifies four areas where AI provides genuine user value:
1. Content creation
2. Summarization
3. Data analysis
4. Perspective-taking

Source: https://www.nngroup.com/articles/designing-ai-study-guide/ (PRIMARY — confirmed as accessible via study guide reference page)

---

## 8. What Senior UX Designers Explicitly Do NOT Do

Source: CareerFoundry, IxDF, NNGroup State of UX 2026

**Not their responsibility:**
- **Backend architecture** — database schema, API design, infrastructure decisions
- **Content writing** — the actual copy, microcopy strategy, tone of voice (that is UX Writing/Content Design)
- **Brand strategy** — brand identity, logo design, naming, positioning (belongs to Brand Design)
- **Frontend engineering** — writing production code (though knowing HTML/CSS is helpful)
- **Product strategy** — roadmap prioritization, business model decisions (belongs to Product Management)
- **Motion design production** — final animation implementation (engineering/motion designers)
- **Marketing design** — ads, campaign assets, landing page marketing copy
- **Data science** — model selection, training, evaluation (belongs to ML engineers)

**Important caveat for startups:** In smaller teams, a Senior UX Designer often absorbs UX writing, some content decisions, and light motion design. Role boundaries expand with smaller team size, contract with larger team size.

---

## Gaps Identified

1. **NNGroup article URL instability**: Many NNGroup article URLs return 404. The site appears to have reorganized its URL structure. Confirmed working articles: `ten-usability-heuristics`, `definition-user-experience`, `ai-paradigm`, `ai-chatbots-discourage-error-checking`, `AI-conversation-types`, `state-of-ux-2026`, `chat-ux`, `content-strategy`, `prompt-suggestions`, `genui-buttons-and-checkboxes`, `ai-search-infoseeking`, `ux-without-user-research`, `ux-career-advice`.

2. **PAIR Guidebook page content inaccessible**: pair.withgoogle.com renders via JavaScript. Direct WebFetch returns only CSS/font declarations. Chapter structure verified via prior research session and cross-referenced with secondary sources. Individual card-level guidance (e.g., "Errors and Graceful Failure" card) could not be independently verified in this session.

3. **No NNGroup article found on senior-vs-junior distinction**: Searched 15+ URL patterns. The most relevant content was in the State of UX 2026 article (strategic competencies) and the career advice article (soft skills primacy). IxDF's job description guide provided the clearest seniority taxonomy.

4. **Apple HIG Machine Learning page**: Requires JavaScript rendering; could not be directly scraped. Prior research noted it emphasizes transparent disclosure, progress indicators, and privacy.

5. **IxDA and AIGA resources**: Not successfully accessed in this session. IxDA.org and AIGA.org were not fetched. Recommend as follow-up for community-standard perspectives on role definitions.

---

## Key Takeaways for Implementation

1. **The role is strategic, not just craft-level** — NNGroup (2026) explicitly says survival requires "breadth and judgment, not just artifacts." A senior designer who only produces Figma files is operating below their level.

2. **HAX G1+G2 are the most violated patterns** — most AI products fail to tell users what the system can do AND how reliably it does it. These are the highest-leverage design interventions.

3. **Calibrated trust, not maximum trust** — the design goal is accurate user mental models, not persuading users to trust more. Over-trust (automation bias) is as bad as under-trust.

4. **Hybrid interfaces outperform pure chat** — NNGroup, PAIR, and HAX all independently recommend combining conversational AI with traditional GUI elements. The GenUI pattern (structured form fields alongside prompts) is confirmed best practice.

5. **AI errors require structural design interventions** — persistent warnings are ineffective. The interface must structurally prompt critical thinking, link to sources, and make correction trivially easy (HAX G9).

6. **SUS ≥ 80 is the industry quality target** — below 68 is actively bad; 80+ means users will recommend the product.

7. **6 conversation types should drive UI design** — each type requires different scaffolding. Funneling needs clarifying questions; Exploring needs detail-building follow-ups; Expanding needs relaxed-criteria fallbacks.

8. **Progressive disclosure via prompt suggestions** — never dump all capabilities upfront. Use-case suggestions, contextual follow-ups, and autocomplete are the standard patterns.

9. **Content strategy is a peer discipline, not a subset** — "It's impossible to design a good user experience with bad content." Senior designers collaborate with content strategists but do not own the words.

10. **At AI startups, scope expands** — in small teams the senior designer absorbs researcher, content, and motion responsibilities. The key constraint: defer key decisions (research sampling, editorial standards, roadmap) to their rightful owners even while doing the work.

---

## Sources

### PRIMARY (Official documentation, authoritative bodies)
- Google PAIR Guidebook: https://pair.withgoogle.com/guidebook/
- Microsoft HAX Toolkit (18 guidelines): https://www.microsoft.com/en-us/haxtoolkit/library/
- WCAG 2.2 new criteria: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- Nielsen's 10 heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- NNGroup AI as new UI paradigm: https://www.nngroup.com/articles/ai-paradigm/
- NNGroup AI chatbots discourage error-checking: https://www.nngroup.com/articles/ai-chatbots-discourage-error-checking/
- NNGroup 6 AI Conversation Types: https://www.nngroup.com/articles/AI-conversation-types/
- NNGroup State of UX 2026: https://www.nngroup.com/articles/state-of-ux-2026/
- NNGroup GenUI buttons and checkboxes: https://www.nngroup.com/articles/genui-buttons-and-checkboxes/
- NNGroup AI search and infoseeking: https://www.nngroup.com/articles/ai-search-infoseeking/
- NNGroup Prompt Suggestions: https://www.nngroup.com/articles/prompt-suggestions/
- NNGroup Chat UX: https://www.nngroup.com/articles/chat-ux/
- NNGroup Content Strategy: https://www.nngroup.com/articles/content-strategy/
- NNGroup UX without user research: https://www.nngroup.com/articles/ux-without-user-research/
- NNGroup UX career advice: https://www.nngroup.com/articles/ux-career-advice/
- NNGroup Definition of UX: https://www.nngroup.com/articles/definition-user-experience/
- NNGroup Designing AI Study Guide: https://www.nngroup.com/articles/designing-ai-study-guide/
- NNGroup GenAI UX Research Agenda: https://www.nngroup.com/articles/genai-ux-research-agenda/

### SECONDARY (Established organizations, single authoritative source)
- Apple HIG Machine Learning: https://developer.apple.com/design/human-interface-guidelines/machine-learning
- SUS benchmarks (MeasuringU): https://measuringu.com/sus/
- HEART Framework: https://www.heartframework.com/
- Trust Psychology in AI (Smashing Magazine): https://www.smashingmagazine.com/2025/09/psychology-trust-ai-guide-measuring-designing-user-confidence/
- IxDF UX Job Descriptions Guide: https://ixdf.org/literature/article/ux-designer-job-descriptions-the-comprehensive-guide
- IxDF UX Design definition: https://ixdf.org/literature/topics/ux-design
- IxDF UX Design facts: https://ixdf.org/literature/article/what-is-ux-design-15-user-experience-facts-and-misconceptions
- XAI UI Design (Eleken): https://www.eleken.co/blog-posts/explainable-ai-ui-design-xai
- Material Design 3: https://m3.material.io/

### TERTIARY (Community resources, career guidance sites)
- CareerFoundry UX activities: https://careerfoundry.com/en/blog/ux-design/what-does-a-ux-designer-actually-do/
