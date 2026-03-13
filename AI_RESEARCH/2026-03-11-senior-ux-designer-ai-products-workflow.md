# Research: Senior UX/UI Designer Workflow for AI Products
Date: 2026-03-11

## Summary

Comprehensive sourced research into the standard operating procedures, deliverables, decision frameworks, collaboration model, anti-patterns, and AI-specific design patterns used by senior UX/UI designers working on AI products. Sources: NNGroup, Smashing Magazine, Google PAIR Guidebook, Microsoft HAX Toolkit.

## Prior Research
None directly applicable. Related: `2026-03-05-joy-inducing-ui-design-shadcn-customization.md`, `2026-03-01-agent-identity-soul-memory-research.md`.

---

## 1. Standard Operating Procedure (Workflow Phases)

Source: NNGroup, Smashing Magazine (see sources section)

Senior designers at AI startups follow a broadly consistent process that diverges from traditional product design in two key places: the pre-build validation gate (is AI actually needed?) and the post-launch trust calibration loop.

### Phase 0 — Problem Framing & AI Necessity Audit
Before any design work begins, the senior designer drives an explicit question: does this product require AI, or would it be enhanced by it? This is not optional; "Powered By AI" is not a value proposition.

- Define the user problem independent of the technology
- Assess AI's four functional superpowers: content creation, summarization, data analysis, perspective-taking
- Use a CSD Matrix (Certainties / Suppositions / Doubts) to surface team assumptions
- Produce: Problem statement, feasibility/desirability/viability scorecard, antipersona (who could misuse this)

### Phase 1 — Discovery & User Research
- User interviews, contextual observation, stakeholder interviews
- Empathy maps, journey maps, ecosystem maps, service blueprints
- Jobs-to-be-done framing: what "job" does the user hire this product to do?
- Mental model interviews to understand users' existing beliefs about how the AI works (critical for trust design)
- Produce: Research plan, interview guides, screener, affinity diagram, persona (qualitative or statistical), user stories

### Phase 2 — Information Architecture & User Flows
- Site maps for information hierarchy
- User flows (ideal set of steps to complete a task)
- Wireflows (wireframe + flowchart hybrid) for app-like interactions
- Hierarchical task analysis diagrams for complex multi-step sequences
- Scenario maps for persona-based ideation
- Produce: Site map, user flow diagrams, wireflows, HTA diagrams

### Phase 3 — Wireframing
- Low-fidelity skeletal outlines representing structure only
- Paper prototypes for rapid ideation and sketch tests
- Note: NNGroup research shows wireframes are the most frequently produced deliverable (71% "often") but are primarily internal artifacts — rarely shared externally without conversion to interactive prototypes
- For AI interfaces, wireframes must include: empty states, error states, loading/thinking states, low-confidence fallback states, onboarding/trust-building states
- Produce: Static wireframes, paper prototypes

### Phase 4 — Visual Design & Design System Work
- High-fidelity mockups with full visual design (color, typography, imagery)
- Design tokens (color, spacing, typography, motion as primitive values)
- 8-point grid system for spatial consistency
- Component library with variant specifications
- Style guide: visual references, design principles, implementation guidelines
- Pattern library: documented reusable UI patterns
- Mood boards for visual direction exploration
- Produce: Mockups, design tokens, component library, style guide, pattern library, mood board

### Phase 5 — Prototyping
- Interactive prototypes are the most effective deliverable across ALL stakeholder audiences (internal management, external clients, developers)
- They are the only deliverable equally effective with all three audiences (NNGroup)
- Prototype specifications: annotations with font size, line spacing, interaction detail
- For AI products: prototype should include confidence state variations, explanation interface states, autonomy dial interactions
- Produce: Interactive prototype, prototype specification doc

### Phase 6 — Usability Testing & Trust Calibration
- Usability tests focused on task completion and error recovery
- Specific to AI: trust calibration studies — is user trust appropriately calibrated (neither over-trust nor active distrust)?
- Measure correction rate, verification behavior, and disengagement signals
- Behavioral signals to observe: how often do users override AI suggestions? Do they seek external verification?
- Usability report synthesizing findings, insights, and recommendations
- Produce: Usability report, analytics report, trust measurement data

### Phase 7 — Iteration
- Update wireframes, mockups, and prototypes based on test findings
- Track open issues against design system components
- Validate accessibility compliance against WCAG before handoff

### Phase 8 — Design Handoff
- Figma handoff file with named components, applied styles, and developer-readable annotations
- Assets exported in correct format (SVG for icons, WebP for images)
- Design tokens documented for engineering consumption
- Component specs: interactive states, spacing, typography, accessibility labels
- Produce: Annotated Figma file, asset exports, component spec doc, accessibility checklist

### Phase 9 — Post-Launch Monitoring & Trust Loop
- Unique to AI products: ongoing trust recalibration
- Monitor behavioral signals: correction rate, verification behavior, feature abandonment
- Use analytics reports and dashboard data to track if users are in the "calibrated trust" zone
- Feed findings back into design iterations

---

## 2. Deliverables Produced

Source: NNGroup UX Deliverables Glossary (https://www.nngroup.com/articles/ux-deliverables-glossary/)
Source: NNGroup Common UX Deliverables (https://www.nngroup.com/articles/common-ux-deliverables/)

### Most Frequently Produced (NNGroup Survey Data)
1. Static wireframes — 71% produce "often"
2. Interactive prototypes
3. Flowcharts
4. Site maps
5. Usability/analytics reports
6. Style guides and pattern libraries — 61%

### Full Deliverable Taxonomy by Category

**Research Deliverables**
- Research plan
- Interview guide + screener
- Empathy map
- Affinity diagram
- Persona (qualitative, statistical, or proto-persona)
- Antipersona
- Archetype
- JTBD framework documentation
- Survey + analytics report
- Usability report

**Architecture & Flow Deliverables**
- Site map
- User flow
- Wireflow
- Hierarchical task analysis (HTA) diagram
- User story map
- Service blueprint
- Ecosystem map
- Experience map / journey map
- Chronological map
- Process map
- Scenario map

**Visual & Design Deliverables**
- Wireframe (static, low-fidelity)
- Paper prototype
- Mockup (static, high-fidelity)
- Mood board
- Storyboard
- Interactive prototype
- Prototype specification

**System & Specification Deliverables**
- Design system
- Style guide
- Component library / pattern library
- Design tokens
- Asset map
- Accessibility audit

**AI-Specific Deliverables (Emerging)**
- Promptframe: "a design deliverable that documents content goals and requirements for generative-AI prompts based on a wireframe's layout" (NNGroup, 2024)
- Trust calibration study report
- Confidence display specification
- Explanation interface spec (which XAI pattern to use, when, for which user segment)
- Autonomy dial specification (per-task-type permission levels)
- Empty state matrix (for ML models in training, cold start, no data states)

**Planning & Strategy Deliverables**
- CSD matrix
- UX roadmap
- Field roadmap / specialty roadmap
- Impact-effort matrix
- RICE / MoSCoW / Kano prioritization
- RACI matrix
- Research repository

---

## 3. Decision Frameworks

Source: NNGroup (multiple articles), Google PAIR Guidebook, Microsoft HAX Toolkit

### Accessibility
- **WCAG 2.1 / 2.2 compliance levels**: A (minimum), AA (standard for most products), AAA (enhanced)
- For AI interfaces specifically: ensure AI-generated content is readable by screen readers; confidence indicators must not rely on color alone (WCAG 1.4.1 use of color)
- NNGroup distinguishes accessibility (disabilities focus) from inclusive design (broader spectrum of human diversity)

### Visual Perception & Layout
- **Gestalt principles**: proximity, similarity, continuity, closure, figure/ground — govern how users group and perceive interface elements
- **8-point grid system**: all spacing and sizing values are multiples of 8px (or 4px for fine-grained control); ensures visual rhythm and consistency across components
- **Design tokens**: primitive design values (colors, spacing, typography, motion) stored as named variables; enable theming and systematic consistency

### Interaction Design
- **Fitts's Law**: target acquisition time increases with distance and decreases with target size; governs button sizing, CTA placement, touch target minimums (44x44px per Apple HIG; 48x48dp per Material)
- **Hick's Law**: decision time increases logarithmically with number of choices; justifies progressive disclosure, reduced option sets, smart defaults
- **Miller's Law**: working memory holds 7±2 chunks; governs chunking of information in forms, navigation, and AI output displays

### Cognitive Load Theory
- NNGroup defines cognitive load as "the total amount of mental processing power needed to use your site"
- Three types: intrinsic (task complexity), extraneous (bad design), germane (learning/schema-building)
- Design goal: minimize extraneous load; AI interfaces must especially avoid overloading users with explanations (see "Goldilocks Zone" principle)
- Four principles from NNGroup for forms: structure, transparency, clarity, support

### AI-Specific Decision Frameworks

**Google PAIR Framework (pair.withgoogle.com)**
- Chapter structure covers: user needs, mental models, explainability/trust, data collection, feedback loops, errors
- Core question before building: does this product require AI or would it be enhanced by it?
- Explanation principle: "Focus on sharing information users need to make decisions, not technical accuracy"
- Progressive automation principle: increase autonomy only when trust is high or error risk is low

**Microsoft HAX Toolkit (microsoft.com/en-us/haxtoolkit)**
- 18 evidence-based guidelines organized across 4 interaction zones:
  1. **Before interaction**: set expectations, explain capabilities and limitations
  2. **During interaction**: make clear what the AI can and cannot do in context
  3. **When wrong**: support correction, explain failure, maintain user trust
  4. **Over time**: adapt behavior, remember preferences, improve with use
- HAX Design Library: patterns are numbered to inherit their guideline number (G1 patterns implement Guideline 1)
- Patterns follow: Problem → Solution → When to use → How to use → User benefits → Common pitfalls

**Trust Spectrum Framework (Smashing Magazine)**
- Four trust states: Active Distrust → Suspicion & Scrutiny → Calibrated Trust (goal) → Over-trust
- Design goal is calibrated trust, NOT maximum trust
- Over-trust leads to automation bias; active distrust leads to abandonment
- Measurement: Likert scales for reliability, confidence, predictability; behavioral signals for correction rate, verification behavior, disengagement

---

## 4. Collaboration Model: What Designers Hand Off vs. Own

Source: NNGroup RACI article (https://www.nngroup.com/articles/ux-roles-responsibilities/)
Source: NNGroup PM/UX overlap research (https://www.nngroup.com/articles/pm-ux-different-views-of-responsibilities/)

### UX OWNS (Responsible + Accountable)
- All user research activities (interviews, contextual observation, usability tests)
- All mapping activities (journey maps, empathy maps, service blueprints)
- Ideation and concept generation
- Prototyping
- Interaction design specifications
- Accessibility review and audit
- Design system evolution

### UX SHARES (Responsible, PM Accountable)
- Visioning and product strategy (UX is Consulted)
- Feature prioritization (UX Consulted via impact-effort or RICE input)
- Release planning (PM Accountable, UX Consulted)
- QA testing (Engineering Responsible, UX Informed — reviews before sign-off)
- Demos and stakeholder presentations

### PM OWNS (UX Consulted or Informed)
- Goal setting and roadmaps
- Business requirements
- Release timing and launch decisions
- Success metrics definition (UX provides UX-specific metrics)

### ENGINEERING OWNS (UX Consulted at start, Informed at end)
- Technical architecture and implementation
- Performance optimization
- QA execution
- Accessibility implementation (UX specifies requirements; engineering implements)

### Handoff Artifacts (What UX hands to Engineering)
Per Smashing Magazine (https://www.smashingmagazine.com/2023/05/designing-better-design-handoff-file-figma/):
- Annotated Figma file with named components and applied styles
- Exported assets in correct formats (SVG, WebP, PNG)
- Design tokens for engineering consumption
- Interactive prototype as behavioral reference
- Component specs: states, spacing, typography, accessibility labels
- The Inspect feature in Figma shows component/style names directly to developers

### The Anti-Pattern: Pure Handoff Culture
NNGroup explicitly warns against "handoffs of deliverables from one team to the next" and recommends "design-as-process culture instead of design-as-service." Senior designers should stay engaged through implementation, not throw artifacts over a wall.

### AI Product-Specific Collaboration
For AI products, design must collaborate with data scientists and ML engineers to define:
- What model confidence thresholds map to which UX states
- What inputs feed personalization (to label them in UI — "Because you...")
- What fallback behaviors look like when model confidence is below threshold
- What data the model collects and how to communicate this transparently to users

---

## 5. Anti-Patterns in AI Product Design

Sources: Smashing Magazine (multiple), NNGroup (multiple), Google PAIR, Microsoft HAX

### Over-Automation
- **Definition**: Giving the AI too much autonomous control without user oversight mechanisms
- **Impact**: Users cannot correct errors; one mistake destroys trust permanently
- **Fix**: Implement Autonomy Dial (Observe & Suggest → Plan & Propose → Act with Confirmation → Act Autonomously); gate higher autonomy behind trust-building; ensure undo capability exists for every action (Smashing Magazine, agentic AI patterns article)

### Lack of User Control
- **Definition**: No feedback mechanisms, override options, or correction pathways
- **Impact**: Users feel powerless; automation bias or total abandonment
- **Fix**: Prominent feedback buttons, easy correction (natural language: "No, I meant X"), edit capabilities, clear opt-out (Smashing Magazine, trust psychology article)

### Opacity of AI Decisions
- **Definition**: AI outputs with no explanation of reasoning, factors, or confidence
- **Impact**: Users cannot calibrate trust; suspicious mental models form (pregnancy ad example from NNGroup ML article — user suspected creepy data collection rather than understanding actual targeting)
- **Fix**: "Because" statement pattern; source citations; confidence displays (categorical Low/Medium/High rather than raw percentages); interactive "What if?" exploration (Smashing Magazine XAI article, Google PAIR explainability chapter)

### Notification Fatigue
- **Definition**: AI system triggers too many alerts, suggestions, or interruptions
- **Impact**: Users ignore all notifications including important ones; feature abandonment
- **Fix**: Scope AI features narrowly; use progressive automation (increase only when trust is high); reserve proactive interruptions for high-stakes scenarios; design explicit escalation pathway with 5-15% target frequency (Smashing Magazine, agentic AI patterns)

### Uncanny Valley in Conversational UI
- **Definition**: AI that sounds almost but not quite human; unexpected humanization
- **Impact**: Mismatched expectations; broken trust when limitations appear
- **Fix**: NNGroup recommends "factual, neutral language" over anthropomorphic framing; replace "I searched the internet" with "Answer based on: [link]"; avoid first-person reasoning displays that imply more consciousness than exists (NNGroup, explainable AI article)

### Forcing Conversation Where GUI Excels
- **Definition**: Using chat as the only interaction modality for tasks "easier to do than explain"
- **Impact**: 30-60 seconds of user friction for simple parameter adjustments; usability tests show users get lost editing/reviewing
- **Fix**: Hybrid interfaces — pair text input with sliders, checkboxes, carousels, image selectors; direct manipulation for visual tasks (Adobe Photoshop Generative Fill example); treat conversation as one modality, not the universal solution (Smashing Magazine, beyond conversational interfaces)

### Blank Canvas Problem
- **Definition**: Conversational interface with only a text field and no affordances
- **Impact**: Discoverability failure — users don't know what to ask; recreates writer's block in the interface
- **Fix**: Suggested prompts, prompt builders, query scaffolding, capability preview in onboarding (NNGroup, prompt assistance research)

### Confident Hallucination
- **Definition**: AI presents false information with high confidence, no disclaimers
- **Impact**: Automation bias; users accept low-confidence hallucinations; trust destruction when discovered
- **Fix**: Prominent disclaimers paired with actionable guidance ("Double-check responses"); source citations inline; avoid step-by-step reasoning displays that imply faithfulness (NNGroup, explainable AI article)

### Trustwashing
- **Definition**: Designing to manipulate users into trusting a flawed, biased, or harmful system through the appearance of transparency
- **Impact**: Ethical betrayal; damages long-term brand trust when limitations emerge
- **Fix**: Genuine transparency including publishing negative findings; independent evaluation; clear accountability mechanisms; diverse stakeholder engagement (Smashing Magazine, trust psychology article)

### Duplicate Content & Session-Specific Personalization
- **Definition**: ML system recommends same item across categories; UI layout changes between sessions
- **Impact**: Users cannot form stable mental models; increased interaction costs without benefit
- **Fix**: Deduplicate across recommendation surfaces; maintain consistent learnable layouts; make personalization logic visible (NNGroup, ML UX article)

---

## 6. AI-Specific Design Patterns

Sources: Google PAIR Guidebook, Microsoft HAX Toolkit, Smashing Magazine (multiple articles), NNGroup

### Confidence Indicators
- **Problem**: Users need to know when to trust vs. verify AI outputs
- **Pattern options** (from Google PAIR explainability chapter):
  - Categorical (Low/Medium/High): safest default; team defines cutoffs; each category has clear recommended action
  - N-best alternatives: show multiple plausible outputs; encourages user judgment; builds mental models of system limits
  - Numeric percentages: highest misinterpretation risk; only use with expert audiences
  - Data visualizations (error bars, shaded ranges): best for domain experts
  - Example-based: show training examples similar to current decision; accessible without probability literacy
  - Interactive "What if?": let users manipulate inputs to discover system boundaries
- **Rule**: If the confidence display won't change user behavior, omit it

### Explanation Interfaces (XAI)
Four practical patterns from Smashing Magazine (XAI article):
1. **"Because" Statement**: "Because you listen to psychedelic rock, I recommended X" — single most impactful factor in plain language
2. **"What-If" Interactive**: User manipulates variables and sees how output changes; builds mental model through exploration
3. **Highlight Reel**: Visually connects explanation to source content via highlighting/annotation; transparent reasoning display
4. **Push-and-Pull Visual**: Color-coded chart showing factors that enhanced vs. hindered a decision; makes complex tradeoffs intuitive

NNGroup adds (explainable AI article):
5. **Source Citations**: Inline citation chips adjacent to claims; clickable previews; meaningful labels; intentional verification friction to encourage critical evaluation
6. **Disclaimers**: Clear plain-language limitations paired with actionable guidance; prominent placement (not footer); not vague ("AI-generated, for reference only")

### Human-in-the-Loop Patterns
From Smashing Magazine (agentic AI patterns):
1. **Intent Preview**: Before agent acts, show plain-language summary of planned actions; options: Proceed / Edit / Handle Myself; critical for irreversible actions; target >85% acceptance rate without edits
2. **Autonomy Dial**: Per-task-type progressive authorization; four levels: Observe & Suggest → Plan & Propose → Act with Confirmation → Act Autonomously; monitor "setting churn" as trust volatility signal
3. **Escalation Pathway**: Agent acknowledges limits, asks clarifying questions, flags high-stakes/ambiguous tasks for human review; target 5-15% escalation frequency, >90% recovery success rate

### Action Audit & Undo
- **Problem**: Agent takes actions users cannot reverse or review
- **Pattern**: Persistent chronological action log with time-limited undo windows; clear status indicators; transparent communication about irreversible actions
- **Metric**: <5% reversion rate; high reversion rate signals the autonomous task should be disabled
- Source: Smashing Magazine (agentic AI patterns)

### Graceful Degradation
- **Problem**: ML model has insufficient data, is in training, or encounters edge cases
- **Patterns**:
  - Empty states: honest communication of AI strengths and weaknesses during cold start or no-data states; pair with onboarding and tooltips (NNGroup)
  - "I don't know" as a feature: explicitly design the fallback experience for uncertainty; frame it as honest limitation, not failure (NNGroup)
  - Preserve consistent layouts across sessions even when personalization has no data (NNGroup, ML UX article)
  - Fallback to non-AI functionality: always have a non-AI path the user can take

### Trust Calibration Lifecycle
From Google PAIR (explainability/trust chapter):
1. **Establish trust (pre-use/onboarding)**: Communicate capabilities AND limitations early; sandbox experience for low-commitment exploration; leverage trusted third-party credibility
2. **Grow trust (early use)**: Explicit privacy/security settings; user preference specification; error correction; communicate that system improves with feedback
3. **Maintain trust (ongoing)**: Request permissions contextually with explanation; progressively increase automation in validated steps; remind users when context shifts
4. **Regain trust (error recovery)**: Signal recovery plan in advance; provide immediate remediation + prevention; allow shift from auto to manual control in high-risk scenarios

### Data Transparency Pattern
From Google PAIR (explainability/trust chapter) — explain data use across three dimensions:
1. **Scope**: what data is collected and which parts serve which purposes
2. **Reach**: is this personalized to one user or based on aggregated data?
3. **Removal**: can the user delete or reset the data being used?

### Hybrid Interface Pattern
- **Problem**: Chat-only interfaces force users to "explain" tasks that are easier to perform directly
- **Pattern**: Combine conversational input with direct manipulation controls (sliders, dropdowns, canvas interaction, image carousels); make AI capabilities visible through affordances, not just prompts
- **Examples from sources**: Adobe Photoshop Generative Fill (lasso + prompt); Midjourney GUI options; Flora AI visual node system (Smashing Magazine, AI interfaces article)

### Input Scaffolding
- **Problem**: Users face articulation barrier — cannot express intent clearly in freeform text
- **Patterns** (Smashing Magazine, conversational AI and AI patterns articles):
  - Pre-populated suggested prompts with enriched detail
  - Query builders with guided parameter selection
  - Interactive refinement: sliders, checkboxes, image carousels for intent expression
  - Multiple interpretation options presented for user selection
  - Voice input as alternative to text

### Output Presentation
- **Problem**: Plain text AI responses don't drive users toward insights
- **Patterns** (Smashing Magazine, AI interfaces article):
  - Forced ranking to prevent choice paralysis (suggest best options)
  - Style lenses (present results along dimensions: sad→happy, concrete→abstract)
  - Multiple format support: tables, JSON, visualizations, structured data
  - Contextual rendering: maps for location data, dashboards for metrics

---

## Key Takeaways

1. Senior AI UX designers spend disproportionate time on **trust architecture** — designing for appropriate (calibrated) trust, not maximum trust
2. The **promptframe** is an emerging AI-specific deliverable type (NNGroup, 2024) — documents content goals for generative AI prompts tied to wireframe layouts
3. **Confidence displays require user testing before launch** — one display format rarely works across all user populations (PAIR)
4. **Chat-only is an anti-pattern** for most AI tasks — hybrid GUI+conversation interfaces consistently outperform pure chat
5. **Handoff should be collaborative, not transactional** — NNGroup explicitly recommends staying engaged through implementation
6. **Mental model interviews** are a research method unique to AI products — essential for understanding what users believe the AI is doing before you can design explanations
7. The Microsoft HAX **18 guidelines** are organized by interaction zone (before/during/wrong/over time) and represent the most actionable practitioner framework with design library support

---

## Sources

- NNGroup UX Deliverables Glossary: https://www.nngroup.com/articles/ux-deliverables-glossary/
- NNGroup Common UX Deliverables Research: https://www.nngroup.com/articles/common-ux-deliverables/
- NNGroup AI UX Getting Started: https://www.nngroup.com/articles/ai-ux-getting-started/
- NNGroup Designing AI Products Study Guide: https://www.nngroup.com/articles/designing-ai-study-guide/
- NNGroup Explainable AI in Chat Interfaces: https://www.nngroup.com/articles/explainable-ai/
- NNGroup Machine Learning UX (User Control): https://www.nngroup.com/articles/machine-learning-ux/
- NNGroup UX Roles & Responsibilities (RACI): https://www.nngroup.com/articles/ux-roles-responsibilities/
- NNGroup PM and UX Different Views: https://www.nngroup.com/articles/pm-ux-different-views-of-responsibilities/
- NNGroup Future-Proof Designer: https://www.nngroup.com/articles/future-proof-designer/
- NNGroup UX Reset 2025: https://www.nngroup.com/articles/ux-reset-2025/
- Google PAIR Guidebook: https://pair.withgoogle.com/guidebook/
- Google PAIR Explainability & Trust Chapter: https://pair.withgoogle.com/chapter/explainability-trust/
- Microsoft HAX Toolkit: https://www.microsoft.com/en-us/haxtoolkit/
- Microsoft HAX Guidelines: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- Microsoft HAX Design Patterns: https://www.microsoft.com/en-us/haxtoolkit/design-patterns/
- Smashing Magazine: Designing Agentic AI (Feb 2026): https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/
- Smashing Magazine: Design Patterns for AI Interfaces (Jul 2025): https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/
- Smashing Magazine: Psychology of Trust in AI (Sep 2025): https://www.smashingmagazine.com/2025/09/psychology-trust-ai-guide-measuring-designing-user-confidence/
- Smashing Magazine: Beyond the Black Box / XAI (Dec 2025): https://www.smashingmagazine.com/2025/12/beyond-black-box-practical-xai-ux-practitioners/
- Smashing Magazine: Beyond Conversational Interfaces (Feb 2024): https://www.smashingmagazine.com/2024/02/designing-ai-beyond-conversational-interfaces/
- Smashing Magazine: Effective Conversational AI Experiences (Jul 2024): https://www.smashingmagazine.com/2024/07/how-design-effective-conversational-ai-experiences-guide/
- Smashing Magazine: Design Handoff in Figma (May 2023): https://www.smashingmagazine.com/2023/05/designing-better-design-handoff-file-figma/
- Smashing Magazine: UX/Product Designer Career Paths (Jan 2026): https://www.smashingmagazine.com/2026/01/ux-product-designer-career-paths/
- Smashing Magazine: How UX Professionals Can Lead AI Strategy (Dec 2025): https://www.smashingmagazine.com/2025/12/how-ux-professionals-can-lead-ai-strategy/
