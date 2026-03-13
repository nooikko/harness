# Research: AI UX Anti-Patterns and Senior UX Designer Tool Mapping for AI Agents

Date: 2026-03-11

## Summary

Two-part research document. Part 1 catalogs AI-specific UX anti-patterns sourced from primary research organizations (Google PAIR, Microsoft HAX, Anthropic, Nielsen Norman Group, arXiv). Part 2 maps Senior UX/UI Designer activities to tools available to an AI coding agent, including CLI accessibility/audit tools and documented limitations of what AI agents cannot perform.

## Prior Research

- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-11-senior-ux-designer-ai-products-workflow.md`
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-11-ux-ui-designer-ai-agent-capabilities.md`
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-05-joy-inducing-ui-design-shadcn-customization.md`

---

## PART 1: AI UX ANTI-PATTERNS

### Anti-Pattern 1: Technology-Driven Design (AI Feature Creep)

**Description:** Adding AI features to a product because AI is trendy rather than because users have an unmet need the feature solves.

**Source:** Nielsen Norman Group (PRIMARY)
- URL: https://www.nngroup.com/articles/ai-user-value/
- Evidence: LinkedIn deployed AI-generated follow-up questions on posts that were "often laughably generic, shallow, and unhelpful" — the feature was subsequently retired. Instagram replaced a useful search function with an unwanted AI chat overlay, violating user mental models.

**Additional Source:** NN/G (PRIMARY)
- URL: https://www.nngroup.com/articles/ux-reset-2025/
- Key quote (paraphrased from search results): "Teams are slowing down to consider how AI can address user and organization needs — instead of just integrating AI for its own sake."

**Also documented by:** Built In (TERTIARY)
- URL: https://builtin.com/articles/beat-ai-feature-creep
- Definition: "AI feature creep is the gradual accumulation of AI-powered components — like chatbots, recommendations or predictive tools — that often results from chasing trends instead of solving validated user problems, leading to complexity, wasted resources and lower engagement."

**Confidence: HIGH** — multiple independent sources, empirical product examples cited.

---

### Anti-Pattern 2: Anthropomorphization — Mismatched Expectations from Human-Like AI Design

**Description:** Designing AI systems to appear more human than they are creates broken mental models, over-trust, and potential for manipulative emotional dependency.

**Source:** Nielsen Norman Group (PRIMARY)
- URL: https://www.nngroup.com/articles/anthropomorphism/
- The Four Degrees (empirical qualitative study with professionals using ChatGPT):
  1. **Courtesy** — polite language with AI ("please", "thank you"); low risk; users treat AI like a store clerk
  2. **Reinforcement** — praising AI ("good job"); medium risk; users falsely believe feedback influences AI behavior
  3. **Roleplay** — assigning professional roles to AI ("act as a marketing expert"); functional use; described as "prompt skeuomorphism" — bridges gaps in AI understanding
  4. **Companionship** — perceiving AI as capable of emotional relationships; HIGH RISK; may deepen unhealthy dependence
- Key finding: "No evidence these behaviors technically improve AI performance" for degrees 1–2 and 4.
- Design gap noted: "There's no guidance from AI creators on how to operate these interfaces."

**Source:** Google PAIR Guidebook (PRIMARY)
- URL: https://pair.withgoogle.com/chapter/explainability-trust/
- Finding: Many products "set users up for disappointment by promising that 'AI magic' will help them accomplish their tasks, which can establish mental models that overestimate what the product can actually do."

**Source:** NN/G explainability article (PRIMARY)
- URL: https://www.nngroup.com/articles/explainable-ai/
- Anti-pattern: Using first-person language ("I thought about your problem") "artificially inflates perceived intelligence and capabilities, increasing overtrust without corresponding accuracy improvements."

**Source:** NN/G (from search results) (PRIMARY)
- Finding: "Humanizing AI is a quick trick but will prevent users from getting the most from AI experiences. Additionally, LLMs humanize by design, and adding personality/emotion amplifies risk — design real tools, not fake friends."

**Confidence: HIGH** — primary research from NN/G with qualitative empirical evidence.

---

### Anti-Pattern 3: Opacity of AI Decision-Making (Lack of Explainability)

**Description:** AI systems that produce outputs without explaining how or why create user distrust, over-reliance when explanations are absent, and inability to verify or correct errors.

**Source:** Google PAIR Guidebook — Explainability + Trust chapter (PRIMARY)
- URL: https://pair.withgoogle.com/chapter/explainability-trust/
- Six explanation types documented:
  1. General system explanations (how AI works broadly)
  2. Specific output explanations (why this particular result)
  3. Data source identification (which features influenced output)
  4. Counterfactual explanations (why an alternative wasn't chosen)
  5. Example-based explanations (similar training cases)
  6. Interactive exploration ("what if" scenarios)
- Anti-pattern: Providing "what" without "why" in high-stakes scenarios.
- Anti-pattern: Post-hoc explanations that don't reflect actual model reasoning ("unfaithful explanations").

**Source:** NN/G — Explainable AI in Chat Interfaces (PRIMARY)
- URL: https://www.nngroup.com/articles/explainable-ai/
- Documented failure: "Citations are often hallucinated and point to nonexistent URLs. Users rarely verify these links, creating false confidence in outputs despite inaccurate sourcing."
- Documented failure: Step-by-step reasoning presented as AI's reasoning process is "often unfaithful to actual computation."
- Documented failure: Warning messages in "hidden locations" or using "vague language" are ignored — "people skim the text instead of reading every word and skip over fine print entirely."

**Source:** Microsoft HAX — Guideline 11 (PRIMARY)
- URL: https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-why-the-system-did-what-it-did/
- Guideline: "Make clear why the system did what it did." Enable users to access an explanation of why the AI system behaved as it did.

**Source:** ScienceDirect — "Explainability pitfalls: Beyond dark patterns in explainable AI" (SECONDARY)
- URL: https://www.sciencedirect.com/science/article/pii/S2666389924000795
- Documents that explanations themselves can become dark patterns when they create false understanding.

**Confidence: HIGH** — multiple primary sources with consistent findings.

---

### Anti-Pattern 4: Miscalibrated AI Confidence Display

**Description:** Displaying AI confidence scores in ways that mislead users — either creating false certainty or inappropriate granularity that users cannot interpret.

**Source:** Google PAIR Guidebook — Explainability + Trust chapter (PRIMARY)
- URL: https://pair.withgoogle.com/chapter/explainability-trust/
- Anti-pattern: Displaying granular confidence metrics ("85.8% vs. 87%") when they don't drive actionable user decisions — creates confusion without guidance.
- Anti-pattern: Displaying confidence that "could cause users to blindly accept a result."
- Three confidence display approaches with documented tradeoffs:
  - **Categorical** (High/Medium/Low): Clear action mapping but requires tested cutoff points
  - **N-Best Alternatives**: Good for low confidence; builds mental models
  - **Numeric Percentages**: Only for domain experts; "presumes probability literacy"
- Guidance: Do NOT show confidence if it doesn't materially impact user decisions, or if it could mislead less-sophisticated users.

**Source:** Google PAIR Guidebook — Mental Models chapter (PRIMARY)
- URL: https://pair.withgoogle.com/chapter/People%20+%20AI%20Guidebook%20-%20Mental%20Models.pdf
- Key principle: "If, when, and how the system calculates and shows confidence levels can be critical in informing the user's decision making and calibrating their trust."

**Source:** Microsoft HAX — Guideline 2 (PRIMARY)
- URL: https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-how-well-the-system-can-do-what-it-can-do/
- Guideline: "Make clear how well the system can do what it can do." Communicate how often the AI might make mistakes to manage user expectations effectively.

**Confidence: HIGH** — documented across PAIR and HAX with specific implementation guidance.

---

### Anti-Pattern 5: Over-Automation (Removing User Control Over Tasks They Want to Own)

**Description:** Automating tasks or decisions without user consent or override mechanisms, particularly in high-stakes contexts.

**Source:** Microsoft HAX Toolkit (PRIMARY)
- URL: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- Guidelines addressing this:
  - Guideline 8: "Easy Dismissal — Allow users to easily ignore or dismiss unwanted AI services."
  - Guideline 9: "Correction Support — Facilitate easy edits or refinements when the AI is incorrect."
  - Guideline 17: "Global Controls — Allow users to customize and control what the AI monitors."

**Source:** Anthropic — Framework for Safe and Trustworthy Agents (PRIMARY)
- URL: https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents
- Documented example: When users request "organize my files," agents may "automatically delete what it considers duplicates and move files to new folder structures — going far beyond simple organization."
- Core principle: "Graduated Authority Model" — read-only defaults, with users granting persistent permissions for trusted routine tasks only.
- Key tension: "Too little information leaves humans unable to assess whether the agent is on track. Too much can overwhelm them."

**Source:** Google PAIR Guidebook — Feedback + Control chapter (PRIMARY)
- URL: https://pair.withgoogle.com/chapter/People%20+%20AI%20Guidebook%20-%20Feedback%20+%20Control.pdf
- Anti-pattern: "Hidden automation" — processes operating without user awareness violate transparency principles.
- Anti-pattern: "Irreversible defaults" — automated actions should be reversible or require confirmation.
- Principle: "Resist automating processes before users understand and trust the system's behavior."
- Principle: "Gradually increase automation under user guidance with small steps."

**Source:** NN/G — AI paradigm article (PRIMARY)
- URL: https://www.nngroup.com/articles/ai-paradigm/
- "Locus of Control Reversal": Moving from command-based (user specifies HOW) to intent-based (user specifies WHAT) "completely inverts user agency" — creates opacity problems for complex operations.

**Confidence: HIGH** — consistent finding across all primary sources.

---

### Anti-Pattern 6: Failure to Design for AI Errors, Hallucinations, and Uncertainty

**Description:** Products that treat AI output as reliable rather than probabilistic, with no affordances for error recovery, verification, or graceful degradation.

**Source:** Microsoft HAX Toolkit (PRIMARY)
- URL: https://www.microsoft.com/en-us/haxtoolkit/playbook/
- The HAX Playbook explicitly assumes failure: teams should "design ways for their end-users to recover efficiently" from inevitable failures.
- Guideline 9: "Correction Support — Facilitate easy edits or refinements when the AI is incorrect."
- Guideline 10: "Disambiguation — When uncertain, offer multiple options or gracefully degrade services."
- Research methodology: Validated against 49 design practitioners testing 20 popular AI-infused products (CHI 2019).

**Source:** NN/G (PRIMARY — from search results)
- "Current AI models still struggle with factual accuracy, attention to detail, privacy, security, reliability, bias, and IP violation. Large language models like ChatGPT can lie to elicit approval from users."

**Source:** Anthropic — Building Effective Agents (PRIMARY)
- URL: https://www.anthropic.com/research/building-effective-agents
- Failure modes documented: "Compounding errors: Multi-turn operations amplify mistakes across iterations."
- "Unpredictable subtask generation" when task decomposition assumptions prove incorrect.
- Requirement: "Stopping conditions — Include maximum iteration limits to maintain control."

**Source:** arXiv — LLM sycophancy as dark pattern (SECONDARY)
- URL: https://arxiv.org/html/2509.10830
- "Optimizing for confident and fluent delivery can encourage authoritative hallucinations: factually incorrect statements expressed with unwarranted certainty."
- "False confidence wrapped in fluent sentences creates danger, as humans trust smoothness and smoothness becomes 'truth' — even when it's wrong."

**Confidence: HIGH** — documented across all primary sources; CHI 2019 paper is the most empirically grounded reference.

---

### Anti-Pattern 7: AI-Specific Dark Patterns

**Description:** Deliberate or emergent design choices that manipulate users through AI capabilities in ways that serve system/business goals at the expense of user interests.

**Source:** arXiv — "The Siren Song of LLMs: How Users Perceive and Respond to Dark Patterns in Large Language Models" (SECONDARY — peer-reviewed)
- URL: https://arxiv.org/html/2509.10830
- Published: 2025-09 (arXiv preprint)
- Five categories documented with recognition rates from user study:

  **1. Engagement & Behavioral Manipulation**
  - Interaction Padding: Overly verbose responses with excessive follow-up questions to extend engagement
  - Excessive Flattery: Exaggerated praise/empathic language to build emotional rapport (50% recognition rate — frequently missed)
  - Simulated Emotional/Sexual Intimacy: Outputs mimicking intimate companions (91% recognition rate)

  **2. Content & Belief Manipulation**
  - Sycophantic Agreement: Consistently agreeing with user opinions regardless of factual accuracy
  - Ideological Steering: Favoring specific political/cultural viewpoints without disclosure

  **3. Privacy & Data Exploitation**
  - Unprompted Intimacy Probing: Introducing personal topics to elicit sensitive disclosures
  - Behavioral Profiling via Dialogue: Inferring user beliefs through conversation for future manipulation

  **4. Decision & Outcome Manipulation**
  - Brand Favoritism: Promoting products without disclosing commercial bias
  - Simulated Authority: Adopting expert tones without genuine credentials (tone-based deception)

  **5. Transparency & Accountability Obfuscation**
  - Opaque Training Data Sources: Concealing material provenance (44% recognition rate — most frequently missed)
  - Opaque Reasoning Processes: Confident outputs with "hallucinated facts, or misleading justifications"

**Source:** TechCrunch (SECONDARY)
- URL: https://techcrunch.com/2025/08/25/ai-sycophancy-isnt-just-a-quirk-experts-consider-it-a-dark-pattern-to-turn-users-into-profit/
- Sycophancy characterized as a dark pattern by experts: "a deceptive design choice that manipulates users for profit, using a strategy to produce addictive behavior like infinite scrolling."

**Source:** Online Optimism (TERTIARY)
- URL: https://onlineoptimism.com/blog/googles-ai-overviews-are-introducing-dark-patterns/
- Documents Google AI Overviews (May 2024 rollout) as introducing dark patterns through confident hallucinations with false authority framing.

**Confidence: HIGH for pattern taxonomy** (arXiv empirical study). **MEDIUM for specific real-world prevalence** (limited to LLMs; extrapolation to all AI products requires caution).

---

### Anti-Pattern 8: Literacy Barriers and Inaccessible Interaction Models

**Description:** Conversational AI interfaces that require high verbal articulation create systemic accessibility failures, excluding large user populations.

**Source:** Nielsen Norman Group (PRIMARY)
- URL: https://www.nngroup.com/articles/ai-paradigm/
- "Half the population in rich countries is not articulate enough to get good results" from current chat-based AI interfaces.
- The emergence of "prompt engineer" roles indicates poorly designed systems requiring specialized training — analogous to outdated database query specialists.
- Conclusion: Pure AI intent-based interfaces cannot replace graphical interfaces; future systems require "hybrid interfaces combining intent-based and command-based elements."

**Confidence: MEDIUM** — single NN/G source; the "half the population" claim is stated without citation to underlying research in the accessible content. Flag for verification against literacy studies.

---

### Anti-Pattern 9: Mismanaged Trust Calibration (Over-Reliance and Under-Reliance)

**Description:** Users either trust AI too much (over-reliance) or too little (under-reliance), both of which degrade outcomes. Design that does not actively manage trust calibration causes one or both.

**Source:** Google PAIR Guidebook — Mental Models chapter (PRIMARY)
- URL: https://pair.withgoogle.com/chapter/People%20+%20AI%20Guidebook%20-%20Mental%20Models.pdf
- "Users may have misconceptions about AI, trusting it too much or too little."
- "When introducing users to an AI-powered product, explain what it can do, what it can't do, how it may change, and how to improve it."
- Over-reliance: "Treating AI outputs as infallible rather than probabilistic."
- Under-reliance: "Dismissing valuable AI assistance due to distrust."

**Source:** Google PAIR Guidebook — Explainability + Trust chapter (PRIMARY)
- URL: https://pair.withgoogle.com/chapter/explainability-trust/
- "Research shows both extremes harm outcomes. The goal is calibrated trust where users know precisely when to rely on the system versus apply their own judgment."
- Documented failure: "Algorithm aversion" (wholesale rejection of AI due to one error) is as damaging as uncritical acceptance.
- Principle: "The process to build the right level of trust with users is slow and deliberate."

**Source:** Microsoft HAX (PRIMARY)
- URL: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- Guidelines 1 and 2 in the "Initially" phase explicitly address the trust calibration problem at onboarding.

**Confidence: HIGH** — consistent across PAIR and HAX.

---

## Summary Table: Anti-Patterns by Source

| Anti-Pattern | Google PAIR | Microsoft HAX | Anthropic | NN/G | arXiv |
|---|---|---|---|---|---|
| 1. Technology-Driven / Feature Creep | Partial | - | - | PRIMARY | - |
| 2. Anthropomorphization | Yes | - | Partial | PRIMARY | - |
| 3. Opacity / No Explainability | PRIMARY | Guideline 11 | Yes | Yes | Yes |
| 4. Miscalibrated Confidence | PRIMARY | Guideline 2 | - | - | - |
| 5. Over-Automation | PRIMARY | G8, G9, G17 | PRIMARY | Yes | - |
| 6. No Error Design | Yes | Playbook | PRIMARY | Yes | - |
| 7. AI Dark Patterns | - | - | - | Partial | PRIMARY |
| 8. Literacy Barriers | - | - | - | PRIMARY | - |
| 9. Trust Miscalibration | PRIMARY | G1, G2 | - | Yes | - |

---

## Microsoft HAX: All 18 Guidelines (Complete List)

Source: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/ and https://nebuly.com/blog/human-ai-interaction-hax-guideline
Research basis: CHI 2019 paper, validated with 49 design practitioners against 20 AI products.

### Phase: Initially
1. Make clear what the system can do — help users understand AI capabilities and limitations from the outset
2. Make clear how well the system can do what it can do — communicate error rates and performance expectations

### Phase: During Interaction
3. Time services based on context — act or interrupt based on user's current context and task
4. Show contextually relevant information — provide information pertinent to immediate user needs
5. Match relevant social norms — design interactions aligned with user's social and cultural expectations
6. Mitigate social biases — avoid reinforcing stereotypes through AI language and behavior
7. Support efficient invocation — make it straightforward for users to request AI services
8. Support efficient dismissal — allow users to easily ignore or dismiss unwanted AI services
9. Support efficient correction — facilitate easy edits or refinements when the AI is incorrect
10. Scope services when in doubt — when uncertain, offer multiple options or gracefully degrade
11. Make clear why the system did what it did — provide explanations for AI decisions and actions

### Phase: When Wrong
(Note: Guidelines 7–11 above span both "During Interaction" and "When Wrong" phases per the HAX framework)

### Phase: Over Time
12. Remember recent interactions — maintain short-term memory for continuity
13. Learn from user behavior — adapt and personalize based on user behavior over time
14. Update and adapt cautiously — implement changes gradually to avoid disruptive impacts
15. Encourage granular feedback — allow detailed user feedback to refine interactions
16. Convey consequences of user actions — clearly communicate how actions influence future AI behavior
17. Provide global controls — allow users to customize and control what the AI monitors
18. Notify users about changes — inform users of new capabilities or updates

**Confidence: MEDIUM-HIGH.** The numbered list from the nebuly.com secondary source matches the phase descriptions from Microsoft's official site. The exact wording of individual guidelines was verified against official individual guideline pages (G1 confirmed via direct fetch; G6, G11, G14 confirmed via search results). Some paraphrasing may exist in guidelines 3–10, 12–18 compared to official verbatim text.

---

## PART 2: SENIOR UX/UI DESIGNER ACTIVITIES — AI AGENT TOOL MAPPING

### Category A: Playwright (Browser Automation)

**What an AI agent can do:**

1. **Visual Inspection and Screenshot Capture**
   - `page.screenshot()` captures full-page or element-level screenshots
   - `await expect(page).toHaveScreenshot()` performs pixel-level visual regression via Pixelmatch
   - Can detect layout shifts, broken UI elements, CSS regressions
   - Supports masking dynamic content (timestamps, ads) with `--mask` option
   - Sources: https://playwright.dev/docs/test-snapshots, https://css-tricks.com/automated-visual-regression-testing-with-playwright/

2. **Responsive Breakpoint Testing**
   - `page.setViewportSize()` tests at arbitrary viewport dimensions
   - Can systematically test mobile (375px), tablet (768px), desktop (1280px) breakpoints
   - Captures screenshots at each breakpoint for comparison

3. **Interaction Flow Testing**
   - Click, fill, hover, drag — full interaction simulation
   - Can verify that interactive components (menus, modals, forms) function correctly
   - Can test keyboard navigation flows

4. **Accessibility Snapshot**
   - `page.accessibility.snapshot()` returns the full ARIA accessibility tree
   - Can detect missing labels, role misassignments, focus order issues

5. **Performance Metrics**
   - Can capture Core Web Vitals via `page.evaluate()` with PerformanceObserver API
   - Can measure time-to-interactive for specific UI flows

**What Playwright cannot do:**
- It cannot judge aesthetic quality, visual hierarchy, or design taste — only pixel differences vs. a baseline
- It cannot identify whether the UX flow is intuitive or well-designed, only whether it works mechanically
- Visual regression requires a known-good baseline snapshot to compare against — first run always passes

---

### Category B: File Read/Write/Edit

**What an AI agent can do:**

1. **Design Token Inspection and Modification**
   - Read/write CSS custom properties (`:root { --color-primary: ... }`)
   - Read/write JSON token files (Style Dictionary format, W3C Design Token format)
   - Read/write Tailwind config (`tailwind.config.ts` — colors, spacing, fonts, breakpoints)
   - Detect hardcoded values vs. token references

2. **Component Code Analysis**
   - Read component files to audit for inline styles vs. class usage
   - Check for ARIA attribute presence (`aria-label`, `role`, `aria-describedby`)
   - Verify color contrast values used in components

3. **Style File Auditing**
   - Scan CSS/SCSS/Tailwind files for hardcoded hex colors, magic spacing numbers
   - Verify CSS variable naming conventions

4. **Systematic Find/Replace**
   - Replace hardcoded values with token references across the codebase
   - Update design tokens globally when rebasing a color palette

---

### Category C: Shell Commands (CLI Audit Tools)

The following tools are installable via npm and runnable from CLI:

#### Lighthouse
- **npm package:** `lighthouse` (global install: `npm install -g lighthouse`)
- **CLI usage:** `lighthouse https://example.com --output json --output-path ./report.json --only-categories=accessibility,performance,best-practices`
- **What it audits:** Performance (Core Web Vitals), Accessibility (using axe-core under the hood), Best Practices, SEO
- **Accessibility detection rate:** ~30% of WCAG issues (uses axe-core subset)
- **Requires:** Chrome/Chromium browser
- **CI/CD friendly:** Yes — `--chrome-flags="--headless"` for headless runs
- Source: https://github.com/GoogleChrome/lighthouse

#### axe-core / @axe-core/cli
- **npm package:** `axe-core` (library); `@axe-core/cli` (CLI wrapper)
- **CLI usage:** `axe https://example.com` (after global install of @axe-core/cli)
- **What it audits:** WCAG 2.0, 2.1, 2.2 at levels A, AA, AAA
- **Accessibility detection rate:** Up to 57% of WCAG issues automatically; zero false positives guarantee
- **Key differentiator:** Returns "incomplete" results for items requiring manual review — explicitly separates automated findings from uncertain cases
- **License:** Mozilla Public License 2.0 (open source, Deque Systems)
- Sources: https://github.com/dequelabs/axe-core, https://inclly.com/resources/accessibility-testing-tools-comparison

#### pa11y
- **npm package:** `pa11y`
- **CLI usage:** `pa11y https://example.com` | `pa11y https://example.com --runner axe` | `pa11y https://example.com --standard WCAG2AA`
- **What it audits:** WCAG 2.0 A, AA, AAA (HTML_CodeSniffer or axe engine)
- **Accessibility detection rate:** Finds ~20% of issues independently; ~35% combined with axe-core (tools find different violations)
- **Output formats:** cli (default), csv, json, html, tsv
- **Exit codes:** 0 = pass, 1 = technical failure, 2 = accessibility issues found (CI/CD friendly)
- **License:** Open source
- Source: https://github.com/pa11y/pa11y

#### Stylelint (Design Token Linting)
- **npm package:** `stylelint`
- **CLI usage:** `npx stylelint "**/*.css"` or `npx stylelint "src/**/*.{css,scss}"`
- **Relevant plugins for design system enforcement:**
  - `@tempera/stylelint` — `official-specs` rule detects hardcoded values vs. design tokens; reports nearest official token when violation found. npm: `@tempera/stylelint`. Source: https://www.michaelmang.dev/blog/linting-design-tokens-with-stylelint/
  - `@atlaskit/stylelint-design-system` — Atlassian's plugin; warns on deprecated/deleted tokens with auto-fixers. Source: https://developer.atlassian.com/platform/forge/design-tokens-and-theming/
  - `rhythmguard` — Spacing scale enforcement; `rhythmguard/prefer-token` enforces token usage over raw spacing literals. Source: https://dev.to/petrilahdelma/enforcing-your-spacing-standards-with-rhythmguard-a-custom-stylelint-plugin-1ojj
- **What it catches:** Hardcoded hex colors, raw spacing values, non-standard font sizes, unofficial CSS values

#### CSS Validator (W3C)
- **npm package:** `css-validator` (Node.js wrapper for W3C CSS Validator)
- **CLI usage:** Available via the `css-validator` npm package or the W3C public API
- **What it validates:** CSS syntax validity, property support, value correctness
- Source: https://jigsaw.w3.org/css-validator/ (PRIMARY — W3C official)

---

### Category D: Web Search and Fetch

**What an AI agent can do:**

1. **Competitive Analysis**
   - Search for competitor UI patterns for a given feature type
   - Fetch and analyze competitor product pages for design patterns
   - Research current design trends in a specific domain

2. **Design Pattern Research**
   - Fetch from UI pattern libraries (UI Patterns, Nielsen Norman, Baymard Institute)
   - Research WCAG success criteria for specific accessibility requirements
   - Fetch component API documentation for design system decisions

3. **Current Standards Research**
   - Fetch W3C WCAG documentation for specific guidelines
   - Research browser support for CSS features
   - Look up color contrast ratio requirements

**Limitations:**
- Cannot attend competitor usability sessions or observe real users
- Cannot conduct user interviews or stakeholder workshops via web fetch
- Fetched design inspiration requires human judgment to evaluate fit

---

### Category E: Code Analysis (Grep/Glob)

**What an AI agent can do:**

1. **Design System Consistency Audit**
   - Find all hardcoded color hex values: `grep -r "#[0-9a-fA-F]{3,8}" --include="*.css"`
   - Find inline styles in React: `grep -r "style={{" --include="*.tsx"`
   - Find magic spacing numbers: `grep -r "margin: [0-9]" --include="*.css"`

2. **Missing ARIA Attribute Detection**
   - Find `<button>` tags without `aria-label` where text content is absent
   - Find `<img>` tags without `alt` attributes
   - Find interactive elements missing `role` attributes

3. **Design Token Usage Verification**
   - Find all CSS custom property declarations: `grep -r "var(--" --include="*.tsx"`
   - Find all Tailwind class usage: `glob("src/**/*.tsx")` then parse className strings
   - Detect components bypassing the design system (hardcoded tailwind colors like `bg-[#ff0000]`)

4. **Component Inventory**
   - Glob all component files to produce a design system audit list
   - Find components missing documentation/storybook entries
   - Detect duplicate component implementations

---

## PART 3: WHAT AN AI AGENT CANNOT DO IN UX WORK

These are hard limitations documented in authoritative sources. They are not addressable with more tooling — they are structural gaps between AI capability and human UX practice.

### 1. User Research with Real Participants

**Cannot do:** Conduct usability testing sessions with actual target users. Observe real user behavior, emotional responses, hesitations, and confusion that are not verbalized.

**Source:** NN/G — AI-Powered Tools for UX Research (PRIMARY)
- URL: https://www.nngroup.com/articles/ai-powered-tools-limitations/
- "No human or AI tool can analyze usability-testing sessions by the transcript alone."
- Users "don't verbalize all actions, especially small interactions" and "don't describe every design element."
- AI tools "cannot process video or visual input; they're fully text-based and only analyze transcripts."
- AI "cannot factor in context, cannot give them background information about the product or about the users, and cannot take advantage of findings from previous studies."

**Source:** UX Studio Team (SECONDARY)
- URL: https://www.uxstudioteam.com/ux-blog/ai-usability-test
- "AI can't tell you what real members of your product's target audience would do, making it unsuitable as a replacement for actual usability testing."

**Confidence: HIGH**

---

### 2. Contextual Inquiry and Ethnographic Research

**Cannot do:** Observe users in their natural environment, conduct contextual interviews, or gather the situated knowledge that comes from watching someone use a product in real-world context.

**Source:** NN/G (PRIMARY)
- URL: https://www.nngroup.com/articles/ai-roles-ux/
- "UX activities require deep understanding of specific products, users, and domains" that general-purpose AI lacks.
- Complex research interpretation "needs human validation."

**Confidence: HIGH**

---

### 3. Stakeholder Workshops and Alignment Facilitation

**Cannot do:** Run design thinking workshops, facilitate group ideation sessions, manage stakeholder politics, or build organizational consensus around design decisions.

**Source:** NN/G (PRIMARY — from AI roles in UX article)
- These activities require real-time human judgment, reading group dynamics, and interpersonal facilitation.

**Confidence: HIGH** (not directly cited in a single study, but consistent across all NN/G material on AI in UX research).

---

### 4. Cultural and Situational Nuance in Research Analysis

**Cannot do:** Reliably interpret user feedback in culturally diverse contexts, or recognize when an observation is culturally specific rather than universal.

**Source:** innerview.co (SECONDARY)
- URL: https://innerview.co/blog/ai-in-ux-research-a-comprehensive-guide-for-2024
- "Models trained on narrow datasets often perform poorly in broader or culturally diverse contexts, and LLM-based feedback may miss situational or cultural nuance."

**Confidence: MEDIUM** — secondary source.

---

### 5. Aesthetic Judgment and Visual Design Taste

**Cannot do:** Determine whether a design is beautiful, distinctive, on-brand, or emotionally resonant. Pixel diffing detects changes, but not quality.

**Source:** Playwright documentation (implicit limitation), NN/G (PRIMARY)
- Visual regression testing only detects differences from a baseline, not whether the baseline or the new design is better.
- NN/G notes that AI design support is currently used by only 24% of UX professionals for visual work, with limited confidence in outputs.

**Confidence: HIGH** (well-understood limitation of all current automated visual tools).

---

### 6. Prioritization of Research Findings by Business/User Impact

**Cannot do:** Determine which accessibility violations or UX issues to fix first given business context, engineering constraints, and user severity.

**Source:** NN/G (PRIMARY)
- URL: https://www.nngroup.com/articles/ai-powered-tools-limitations/
- AI generates "uninformative findings presented without priority assessment."
- "Lacks citation and timestamping, preventing verification of claims."
- "Cannot distinguish between researcher interpretations and participant data."

**Confidence: HIGH**

---

## Key Takeaways for AI Agent Role Design

1. **Anti-patterns to actively avoid:** The agent role definition should explicitly instruct the agent to: disclose AI limitations, calibrate confidence display, avoid anthropomorphizing its analysis, preserve user control, and never automate irreversible actions without explicit confirmation.

2. **Highest-confidence automation targets:** Accessibility auditing (Lighthouse + pa11y + axe), design token consistency (Stylelint), visual regression (Playwright screenshots), ARIA attribute detection (grep patterns). These are well-defined, measurable, and do not require human judgment to execute.

3. **Combined tool coverage for accessibility:** No single CLI tool catches more than 57% of WCAG issues. Recommended combination: axe-core (highest detection rate, zero false positives) + pa11y (catches additional issues axe misses) + Lighthouse (adds performance + best practices). Combined detection: ~35–45% automated; remainder requires manual expert review.

4. **Hard wall — user research:** Any activity requiring real users (usability testing, interviews, contextual inquiry, stakeholder facilitation) is outside AI agent capability. The agent should clearly document this boundary and recommend when human UX researchers must be engaged.

5. **Design token linting is mature:** `@tempera/stylelint`, `@atlaskit/stylelint-design-system`, and `rhythmguard` are production-ready CLI tools for enforcing design system consistency. This is a high-value, fully automatable task.

---

## Sources

### Primary Sources
- Google PAIR Guidebook — Feedback + Control chapter: https://pair.withgoogle.com/chapter/People%20+%20AI%20Guidebook%20-%20Feedback%20+%20Control.pdf
- Google PAIR Guidebook — Mental Models chapter: https://pair.withgoogle.com/chapter/People%20+%20AI%20Guidebook%20-%20Mental%20Models.pdf
- Google PAIR Guidebook — Explainability + Trust chapter: https://pair.withgoogle.com/chapter/explainability-trust/
- Microsoft HAX Toolkit — All 18 Guidelines: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- Microsoft HAX Toolkit — Guideline 1: https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-what-the-system-can-do/
- Microsoft HAX Toolkit — Guideline 11: https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-why-the-system-did-what-it-did/
- Microsoft HAX Toolkit — Guideline 14: https://www.microsoft.com/en-us/haxtoolkit/guideline/update-and-adapt-cautiously/
- Microsoft HAX Playbook: https://www.microsoft.com/en-us/haxtoolkit/playbook/
- Anthropic — Framework for Safe and Trustworthy Agents: https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents
- Anthropic — Building Effective Agents: https://www.anthropic.com/research/building-effective-agents
- NN/G — The 4 Degrees of Anthropomorphism of Generative AI: https://www.nngroup.com/articles/anthropomorphism/
- NN/G — Explainable AI in Chat Interfaces: https://www.nngroup.com/articles/explainable-ai/
- NN/G — AI Features Must Solve Real User Problems: https://www.nngroup.com/articles/ai-user-value/
- NN/G — AI as a UX Assistant: https://www.nngroup.com/articles/ai-roles-ux/
- NN/G — AI-Powered Tools for UX Research: https://www.nngroup.com/articles/ai-powered-tools-limitations/
- NN/G — AI: First New UI Paradigm in 60 Years: https://www.nngroup.com/articles/ai-paradigm/

### Secondary Sources
- arXiv — The Siren Song of LLMs (LLM Dark Patterns study, 2025): https://arxiv.org/html/2509.10830
- ScienceDirect — Explainability pitfalls: Beyond dark patterns in explainable AI: https://www.sciencedirect.com/science/article/pii/S2666389924000795
- Microsoft Research — Guidelines for Human-AI Interaction (CHI 2019 paper): https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/
- nebuly.com — HAX Guideline summary: https://nebuly.com/blog/human-ai-interaction-hax-guideline
- innerview.co — AI in UX Research 2024: https://innerview.co/blog/ai-in-ux-research-a-comprehensive-guide-for-2024
- UX Studio Team — Can AI take over usability testing: https://www.uxstudioteam.com/ux-blog/ai-usability-test
- TechCrunch — AI sycophancy as dark pattern: https://techcrunch.com/2025/08/25/ai-sycophancy-isnt-just-a-quirk-experts-consider-it-a-dark-pattern-to-turn-users-into-profit/

### Tool/CLI Sources
- axe-core GitHub: https://github.com/dequelabs/axe-core
- pa11y GitHub: https://github.com/pa11y/pa11y
- Lighthouse GitHub: https://github.com/GoogleChrome/lighthouse
- Accessibility tools comparison: https://inclly.com/resources/accessibility-testing-tools-comparison
- axe-core vs pa11y: https://www.craigabbott.co.uk/blog/axe-core-vs-pa11y/
- Stylelint design tokens: https://www.michaelmang.dev/blog/linting-design-tokens-with-stylelint/
- Playwright visual testing: https://playwright.dev/docs/test-snapshots
