# Research: UX/UI Design Standards, Methodologies, and Quality Criteria for AI Products

Date: 2026-03-11

## Summary

This document covers the tools, methodologies, standards, and quality criteria used by Senior UX/UI Designers, with particular attention to AI product contexts. All factual claims are cited to primary or secondary authoritative sources. Confidence levels follow the HIGH / MEDIUM / LOW / UNKNOWN framework.

## Prior Research

- `AI_RESEARCH/2026-03-11-senior-ux-designer-ai-products-workflow.md` — adjacent research on senior designer workflows
- `AI_RESEARCH/2026-03-11-ux-ui-designer-ai-agent-capabilities.md` — adjacent research on AI designer competencies

---

## Part 1: Tools and Methodologies

---

### WCAG 2.2 — Web Content Accessibility Guidelines

**Source Classification: PRIMARY**
**URL:** https://www.w3.org/TR/WCAG22/
**Official Publication Date:** December 12, 2024 (W3C Recommendation)

#### Overview

WCAG 2.2 is the current W3C accessibility standard for web content. It is organized around four principles (POUR): **Perceivable, Operable, Understandable, Robust**. Conformance is measured in three levels: A (minimum), AA (standard industry target), AAA (enhanced).

#### Contrast Ratio Requirements (Criterion 1.4.3, Level AA)

Source: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (last updated October 31, 2025)

- **Normal text (below 18pt non-bold / below 14pt bold):** minimum 4.5:1 contrast ratio
- **Large text (18pt+ non-bold / 14pt+ bold):** minimum 3:1 contrast ratio
- **Level AAA normal text:** 7:1 minimum
- **Level AAA large text:** 4.5:1 minimum
- **Exemptions:** incidental text (inactive UI, pure decoration, invisible text), logotypes, disabled controls

Rationale: The 4.5:1 ratio compensates for contrast sensitivity loss in users with approximately 20/40 vision acuity. The 3:1 threshold for large text aligns with ISO and ANSI ergonomic standards.

#### Non-Text Contrast (Criterion 1.4.11, Level AA — added in WCAG 2.1)

Source: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html (last updated February 23, 2026)

- **UI components** (buttons, form fields, focus indicators, state changes): minimum 3:1 against adjacent colors
- **Graphical objects** required for content comprehension: minimum 3:1 against adjacent colors
- Computed values must not be rounded: 2.999:1 does NOT meet the 3:1 threshold
- Exemptions: inactive/disabled components, logotypes, flags, sensory imagery

#### Touch Target Size (Criterion 2.5.8, Level AA — NEW in WCAG 2.2)

Source: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (last updated October 1, 2025)

- **Minimum:** 24 by 24 CSS pixels
- **Exceptions:** spacing (24px diameter circle doesn't intersect adjacent targets), equivalent controls, inline text targets, user-agent-controlled elements, essential visualizations (map pins, dense data)
- **Note:** The requirement is independent of zoom factor — relying on user zoom to satisfy it is not compliant

Note: The older criterion 2.5.5 (Level AAA, added in 2.1) requires 44×44 CSS pixels for enhanced compliance.

#### New Success Criteria in WCAG 2.2 (not in 2.1)

Source: https://www.w3.org/TR/WCAG22/

Nine new criteria:

| Criterion | Name | Level |
|-----------|------|-------|
| 2.4.11 | Focus Not Obscured (Minimum) | AA |
| 2.4.12 | Focus Not Obscured (Enhanced) | AAA |
| 2.4.13 | Focus Appearance | AAA |
| 2.5.7 | Dragging Movements | AA |
| 2.5.8 | Target Size (Minimum) | AA |
| 3.2.6 | Consistent Help | A |
| 3.3.7 | Redundant Entry | A |
| 3.3.8 | Accessible Authentication (Minimum) | AA |
| 3.3.9 | Accessible Authentication (Enhanced) | AAA |

#### Focus Appearance (Criterion 2.4.13, Level AAA)

Source: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html (last updated September 17, 2025)

- Focus indicator must cover an area at least as large as a 2 CSS pixel thick perimeter of the unfocused component
- Focus indicator must have a contrast ratio of at least 3:1 between focused and unfocused states
- A solid 2px outline is the simplest compliant implementation

**Confidence: HIGH** — sourced directly from W3C normative documentation.

---

### Apple Human Interface Guidelines (HIG)

**Source Classification: PRIMARY**
**URL:** https://developer.apple.com/design/human-interface-guidelines/
**Note:** Apple's HIG site is JavaScript-rendered; static HTML extraction was not possible. The following reflects known published content.

**Status:** Apple's HIG is a continuously updated living document without a fixed version number or publication date. Content is organized by platform (iOS, macOS, visionOS, watchOS, tvOS) and by topic (Foundations, Patterns, Components, Inputs).

**What could NOT be extracted via automated fetch:** The site requires JavaScript rendering. Specific design principles, component specifications, and AI/ML guidelines could not be confirmed via direct fetch of https://developer.apple.com/design/human-interface-guidelines/machine-learning — all requests returned JavaScript-dependent error states.

**Confidence: UNKNOWN for specific current content** — the URL is verified as the official source but content could not be retrieved.

---

### Material Design 3 (Google)

**Source Classification: PRIMARY**
**URL:** https://m3.material.io/
**Version:** Material Design 3 (M3), released 2021, current as of 2026

#### Design Token System

Confirmed from M3 CSS infrastructure analysis:

- M3 uses CSS custom properties (design tokens) for all visual decisions
- Token categories include: color, typography, elevation, shape, motion, spacing
- Color tokens include primary, secondary, tertiary, error, surface, and container variants with opacity overlays
- Typography tokens cover: Display (XL–S), Headline (L–S), Title, Label, Body, and Code scales

#### Spacing and Grid

Source: https://m3.material.io/ (CSS analysis) and https://spec.fm/specifics/8-pt-grid

- M3 uses a **4dp base unit** system — confirmed through font-size and line-height values in M3 CSS (4, 8, 12, 14, 16, 20, 24px sequences)
- Responsive breakpoints confirmed: Mobile ≤600px, Tablet 601px–1294px, Desktop ≥1295px
- Elevation defined at discrete levels: 0px, 1px/2px, 2px/6px, 4px/8px shadow values

**What could NOT be extracted:** Detailed column grid specifications, explicit margin/gutter values, and component-level spacing documentation were not accessible via static fetch of m3.material.io layout pages (JavaScript-rendered).

**Confidence: MEDIUM** — base unit and breakpoints confirmed via CSS analysis; detailed layout specs not confirmed from primary source.

---

### Nielsen's 10 Usability Heuristics

**Source Classification: SECONDARY**
**URL:** https://www.nngroup.com/articles/ten-usability-heuristics/
**Original Publication:** April 24, 1994 (Jakob Nielsen)
**Last Updated:** January 30, 2024

The heuristics have remained unchanged since 1994. The 2024 update revised descriptions and examples but not the core principles.

#### The 10 Heuristics (Complete List)

1. **Visibility of System Status** — Keep users informed about what is going on through appropriate feedback within a reasonable amount of time. Builds trust and enables users to understand current state.

2. **Match Between System and the Real World** — Use words, phrases, and concepts familiar to the user, not internal jargon. Follow real-world conventions and natural mappings.

3. **User Control and Freedom** — Provide clearly marked "emergency exits" to leave unwanted states. Support undo/redo and easy escape routes.

4. **Consistency and Standards** — Users should not wonder whether different words or actions mean the same thing. Follow platform and industry conventions; consistency reduces cognitive load.

5. **Error Prevention** — The best designs carefully prevent problems from occurring. Eliminate error-prone conditions; add confirmation dialogs for irreversible actions.

6. **Recognition Rather than Recall** — Minimize memory load by making elements, actions, and options visible. Users should not have to remember information from one part of the interface to use another.

7. **Flexibility and Efficiency of Use** — Accelerators and shortcuts (hidden from novice users) speed interaction for experts. Allow personalization and customization to serve diverse skill levels.

8. **Aesthetic and Minimalist Design** — Interfaces should not contain irrelevant or rarely needed information. Every extra element competes with relevant information and diminishes relative visibility.

9. **Help Users Recognize, Diagnose, and Recover from Errors** — Error messages should be in plain language (no error codes), precisely indicate the problem, and constructively suggest a solution.

10. **Help and Documentation** — Documentation may be necessary even if the system shouldn't need it. Make it searchable, focused on the user's task, concrete, and concise.

**Confidence: HIGH** — sourced directly from Nielsen Norman Group's official article.

---

### Gestalt Principles of Visual Perception

**Source Classification: SECONDARY**
**URL:** https://ixdf.org/literature/topics/gestalt-principles (Interaction Design Foundation)
**Published:** August 30, 2016 | Updated: March 2, 2026
**Historical origin:** Max Wertheimer, Kurt Koffka, Wolfgang Köhler (1920s). Core axiom: "The whole is other than the sum of the parts."

#### The 12 Gestalt Principles with UI Applications

1. **Proximity** — Closer elements are perceived as grouped units. Application: Grouping form labels with their inputs; navigation items that belong together.

2. **Similarity** — Elements sharing visual characteristics (color, shape, size, texture) appear grouped. Application: Consistent button styling so users recognize all clickable elements; matching typography groups related content.

3. **Continuity/Continuation** — The eye follows continuous paths and flowing visual lines. Application: Users prefer coherent design flows; visual alignment guides the eye through a layout.

4. **Closure** — People mentally complete incomplete shapes. Application: Iconic logos (IBM striped letters, WWF panda) use partial forms users complete perceptually.

5. **Figure/Ground** — Foreground elements visually separate from backgrounds. Application: Light text on dark backgrounds (or reversed) maintains recognition; contrast separates interactive elements from structure.

6. **Common Region** — Elements within the same bounded area appear grouped. Application: Facebook/social media post cards group likes, comments, and interactions within post boundaries.

7. **Symmetry and Order** — Symmetrically arranged elements appear grouped; humans favor balanced designs. Application: Centering primary content; mirrored button pairs for visual harmony.

8. **Common Fate** — Elements moving in the same direction appear grouped. Application: Accordion arrows indicating unified expansion; animated transitions grouping related elements.

9. **Pragnanz (Simplicity/Good Form)** — People perceive complex visuals as simplified shapes. Application: UI elements use basic rectangles and circles for easier processing and recall.

10. **Emergence** — Users quickly identify complete patterns from fragmented visual elements. Application: Icon design that resolves into recognizable forms; gestural recognition.

11. **Multistability** — Ambiguous images permit multiple valid interpretations. Application: Understanding optical effects in UI to avoid unintended dual readings.

12. **Invariance** — Shapes remain recognizable despite rotation, size changes, or distortion. Application: CAPTCHA design; icon consistency across sizes.

**Confidence: HIGH** — sourced from Interaction Design Foundation, a recognized secondary authority.

---

### Design Token Systems

**Source Classification: PRIMARY (W3C spec) / SECONDARY (Adobe Spectrum)**
**Primary URL:** https://www.w3.org/TR/design-tokens/ (NOTE: W3C Design Tokens specification — returned 404 during research; spec may be at a different URL or still in draft)
**Secondary URL:** https://spectrum.adobe.com/page/design-tokens/ (Adobe Spectrum documentation)

#### Definition

From Adobe Spectrum: "Design tokens — or tokens, for short — are design decisions, translated into data." They are a shared communication tool between design and development, representing named values for spacing, color, typography, animation, and other design properties.

#### Three-Tier Token Hierarchy

1. **Global Tokens** — Raw values used across the entire design system (e.g., `corner-radius-75`, `component-height-100`). Named without semantic meaning.

2. **Alias Tokens** — Reference another token instead of a hard-coded value. Carry semantic meaning. Example: `negative-border-color-default` → references `negative-color-900`. This level enables theming — changing what an alias points to updates all components using it.

3. **Component-Specific Tokens** — Scoped to particular components (e.g., `tooltip-maximum-width`, `divider-thickness-small`). Provide final binding between design decisions and implementation.

#### Naming Convention

Adobe Spectrum uses a three-part structure:
- **Context:** Broad idea (component or system constant)
- **Common Unit:** Consistent idea (sizing, spacing, styling property)
- **Clarification:** Specific detail (size category, state, index)

Example: `action-button-edge-to-hold-icon-large` = component (action-button) + spacing construct + size clarification.

#### How They Work in Practice

Tokens create a single source of truth: design tools (Figma, Sketch) and code (CSS custom properties, style-dictionary JSON) both reference the same named token values. When a design decision changes, it propagates through all token consumers simultaneously.

T-shirt size scales (S/M/L/XL) increase/decrease by 8px on desktop, consistent with the 8pt grid system.

**Confidence: MEDIUM** — Adobe Spectrum is an authoritative secondary source; W3C spec URL returned 404 so primary source could not be confirmed.

---

### 4px/8px Spatial Grid Systems

**Source Classification: SECONDARY**
**URL:** https://spec.fm/specifics/8-pt-grid (Spec Network)
**Note:** No author or publication date; copyright references 2026 by Spec Network, Inc.

#### What the 8-Point Grid System Is

The 8-point grid uses multiples of 8 as the unit for defining dimensions, padding, and margins of UI elements. Core rule: "Use multiples of 8 to define dimensions, padding, and margin of both block and inline elements."

#### Why 8 Points

Most popular screen sizes are divisible by 8 on at least one axis (usually both), making the system universally applicable across device resolutions.

#### Device Pixel Ratio Relationship

- At @1x: 1 point = 1 pixel
- At @2x: 1 point = 4 pixels (2×2 grid)
- At @3x: 1 point = 9 pixels (3×3 grid)

Designers work at @1x to enable clean scaling to any integer multiple. This is why 8pt (not 9pt or 10pt) is used — it scales cleanly to Retina/HiDPI displays.

#### 4pt Grid Variant

The 4pt grid uses 4 as the base unit. It satisfies the same pixel-ratio requirement (4 × 2 = 8, 4 × 3 = 12) and provides finer granularity for small UI details. Material Design 3 uses 4dp as its base unit.

#### Two Implementation Modes

1. **Hard Grid:** Elements snap to visible 8pt grid; transparent containers manage spacing
2. **Soft Grid:** Measures only 8pt increments between elements without displaying full grid overlay

#### Benefits

- Reduces design decision surface area by eliminating 7 of every 8 spacing options
- Ensures cross-platform visual consistency
- Creates predictable rhythm in layouts
- Faster implementation in code (developers can infer spacing without spec)

**Confidence: MEDIUM** — spec.fm is a recognized community standard reference; no academic citation available.

---

### Google PAIR Guidebook (People + AI Research)

**Source Classification: PRIMARY**
**Base URL:** https://pair.withgoogle.com/guidebook/
**Note:** Full table of contents not accessible via static fetch; individual chapter URLs accessible.

Successfully fetched chapters and their content:

#### Confirmed Chapters

**Chapter: User Needs + Defining Success**
URL: https://pair.withgoogle.com/chapter/user-needs/
Key patterns:
- Find the right problem first — question whether AI genuinely improves over simpler approaches
- **Automation vs. Augmentation distinction:** Automation suits tedious/dangerous/repetitive work; Augmentation suits tasks with social value, enjoyment, or diverse valid approaches
- Reward function design requires cross-functional collaboration; consider false positive/negative tradeoffs, precision vs. recall, inclusivity
- Human oversight mechanisms (preview, edit, undo) should accompany automation features

**Chapter: Mental Models**
URL: https://pair.withgoogle.com/chapter/mental-models/
Key patterns:
- Set expectations for adaptation — communicate dynamic relationship between user input and system output
- Onboard in stages: "Explain the benefit, not the technology"
- Plan for co-learning: connect feedback to personalization explicitly
- Avoid deception through anthropomorphism: "When users confuse AI with humans, they sometimes disclose more information than they would otherwise, or rely on the system more than they should"

**Chapter: Feedback and Controls**
URL: https://pair.withgoogle.com/chapter/feedback-controls/
Key patterns:
- Distinguish implicit feedback (behavior data) from explicit feedback (deliberate commentary)
- Communicate value and time-to-impact of feedback: be explicit about timing ("immediately," "future," "next session")
- Five motivation types for giving feedback: material rewards, symbolic rewards, personal utility, altruism, intrinsic motivation
- Allow users to adjust prior feedback and reset the system
- Maintain manual fallback options during early AI implementation

**Chapter: Explainability and Trust**
URL: https://pair.withgoogle.com/chapter/explainability-trust/
Key patterns:
- Calibrated trust over blind faith — "the user shouldn't trust the system completely; rather, based on system explanations, the user should know when to trust the system's predictions and when to apply their own judgement"
- Multi-stage trust building (slow and deliberate)
- Data source transparency: scope, reach, and removal
- Confidence display options: categorical buckets (High/Medium/Low), N-best alternatives, numeric percentages, visualizations with ranges, counterfactual explanations
- Three trust foundations: Ability (competence), Reliability (consistency), Benevolence (genuine user benefit)

**Chapters that returned 404:** conversational-ui, input-controls, errors-pitfalls — URLs may have changed.

**Confidence: HIGH for fetched chapters** — sourced directly from pair.withgoogle.com, a primary Google Research resource.

---

### Microsoft Guidelines for Human-AI Interaction (HAX)

**Source Classification: PRIMARY**
**URL:** https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/
**Original Publication:** May 2019 (CHI 2019 conference paper)
**Last Modified:** October 17, 2023
**Authors:** Saleema Amershi et al. (Microsoft Research + Aether + Office)
**Award:** Honorable Mention, CHI 2019

#### Overview

18 guidelines synthesizing "more than 20 years of thinking and research in human-AI interaction," validated through user studies with 49 design practitioners testing against 20 popular AI products. Organized into four interaction phases.

#### The 18 Guidelines (Confirmed from Microsoft Research publication page)

The full text of all 18 guidelines was **not directly extractable** from any fetched page — the Microsoft Research page, HAX Toolkit page, and HAX guidelines page all render the guideline text dynamically or link to a PDF. The following structural information IS confirmed:

**Four Phase Categories:**
1. **Initially** — what the AI does when a user first encounters it
2. **During Interaction** — what the AI does during active use
3. **When Wrong** — what the AI does when it makes mistakes
4. **Over Time** — how the AI behaves as the relationship develops

**What is confirmed from fetched pages:**
- The guidelines exist and are organized into these 4 phases
- They address: initial interaction, regular interaction, when systems are wrong, and over time
- They were developed collaboratively between Aether, Microsoft Research, and Office
- Validated through a rigorous 4-step process

**What could NOT be confirmed:** The specific text of each of the 18 guidelines. The Microsoft Research publications page confirms they exist but redirects to a downloadable PDF for the full content.

**Confidence: MEDIUM for structure; UNKNOWN for individual guideline text** — primary source confirmed but guideline text not extractable.

---

### Anthropic Design Principles for AI Interfaces

**Source Classification: PRIMARY attempted**
**URL:** https://www.anthropic.com/research

**Finding:** Anthropic does NOT appear to have published a dedicated UX design guideline document or human-AI interaction framework equivalent to Google PAIR or Microsoft HAX. The anthropic.com/research page lists safety research, model evaluations, and societal impact studies, but no design standards for AI interfaces.

**Confidence: UNKNOWN** — no published Anthropic-specific UX design guidelines found.

---

## Part 2: Quality Criteria and Psychological Laws

---

### Fitts's Law

**Source Classification: SECONDARY**
**URL:** https://www.nngroup.com/articles/fitts-law/
**Author:** Raluca Budiu
**Published:** July 31, 2022
**Last Modified:** January 24, 2024

#### Definition

"The movement time to a target depends on the size of the target and the distance to the target."

#### Mathematical Formula

**T = a + b(log₂ 2D/w)**

Where:
- T = movement time
- D = distance from starting point to center of target
- w = width of the target (smallest dimension)
- a, b = constants that vary by input device type (mouse, finger, stylus)

#### UI Design Applications

**Target Size Optimization:**
- Increase clickable/tappable area dimensions (larger = faster acquisition, fewer errors)
- Combine icons with text labels to expand effective target area
- Use adequate padding (but ensure visual padding matches perceptual target area)

**Distance Optimization:**
- Leverage screen edges: edges act as infinite targets in pointer-based interfaces (the cursor cannot overshoot an edge)
- Menus: pie menus outperform rectangular menus which outperform linear menus (equidistant targets from cursor origin)
- Position action buttons adjacent to final form fields, not at page top
- Cluster related controls to minimize movement between them

**Confidence: HIGH** — Nielsen Norman Group is an authoritative secondary source in HCI.

---

### Hick's Law (Hick-Hyman Law)

**Source Classification: SECONDARY**
**URL:** https://lawsofux.com/hicks-law/
**Original Research:** William Edmund Hick + Ray Hyman, 1952

#### Definition

"The time it takes to make a decision increases with the number and complexity of choices."

#### Design Applications

1. **Minimize choices** during time-sensitive interactions to reduce decision latency
2. **Segment workflows** into smaller components — break complex decisions into sequential steps
3. **Highlight recommendations** — guide users toward the best option to prevent choice paralysis
4. **Stage onboarding** — introduce features progressively rather than revealing all capabilities at once
5. **Avoid over-simplification** that reduces clarity or utility

#### Real-World Examples from Research

- **Google homepage:** Removes all distracting elements, presenting only the search input
- **Apple TV remote:** Transfers interface complexity to the TV display, reducing working memory demands through progressive menu disclosure
- **Slack onboarding:** Introduces features sequentially via bot-guided tutorials

#### Relationship to Information Architecture

Hick's Law directly informs: navigation menu design (fewer top-level items), progressive disclosure patterns, default option design, and onboarding sequencing.

**Confidence: HIGH** — well-established psychological law with consistent application across UX literature.

---

### Miller's Law and Chunking

**Source Classification: SECONDARY**
**URL:** https://www.nngroup.com/articles/chunking/
**Author:** Kate Moran
**Published:** March 20, 2016
**Last Modified:** February 2, 2024

#### Miller's Law

George Miller's 1956 research found that people can hold approximately 7 (±2) chunks of information in short-term working memory. The range is roughly 3–6 items, not a hard limit of exactly 7.

**Critical nuance:** Chunk size doesn't matter — people recall 7 four-letter words as easily as 7 individual letters. The law applies to the number of chunks, not the quantity of information within a chunk.

**Common misapplication:** Navigation menus do NOT need to be limited to 7 items. The 7±2 rule applies to short-term memory during sequential tasks, not to navigation structures the user can visually scan.

#### Chunking in UX Design

Chunking means "breaking up content into small, distinct units of information, as opposed to presenting an undifferentiated mess."

**Applications:**
- Grouping related navigation items into meaningful categories
- Using proximity, background colors, and white space to visually separate content groups
- Formatting strings conventionally (phone: 555-555-5555, credit card: 4 groups of 4)
- Using subheadings, bold keywords, and bulleted lists to support scanning
- Creating visual hierarchy so related elements connect clearly

**Confidence: HIGH** — Nielsen Norman Group, authoritative secondary source.

---

### Cognitive Load Management

**Source Classification: SECONDARY**
**URL:** https://www.nngroup.com/articles/minimize-cognitive-load/
**Author:** Kathryn Whitenton
**Published:** December 22, 2013
**Last Modified:** November 25, 2025

#### Definition

Cognitive load = the amount of mental resources required to operate a system.

Two types:
- **Intrinsic load:** Essential cognitive work required by the task itself (cannot be eliminated)
- **Extraneous load:** Unnecessary processing imposed by poor design (should be eliminated)

#### Three Primary Strategies

1. **Eliminate visual clutter** — remove redundant links, irrelevant images, and decorative typography that adds no information value

2. **Leverage existing mental models** — use familiar labels and layout patterns from interfaces users already know; reduces learning burden

3. **Offload tasks** — replace text reading with visual alternatives; re-display previously entered information (don't require recall); implement smart defaults to reduce decision burden

#### Additional Cognitive Load Principles (from established UX literature)

**Progressive Disclosure:** Present only information needed for current task; reveal additional options on demand. Reduces extraneous cognitive load by limiting irrelevant choices.

**Recognition over Recall** (Nielsen Heuristic 6, above): Make information visible rather than requiring users to remember it from elsewhere in the interface.

**Confidence: HIGH** — Nielsen Norman Group, authoritative secondary source.

---

## Part 3: Automated Quality Tools

---

### axe-core

**Source Classification: PRIMARY**
**URL:** https://dequeuniversity.com/rules/axe/4.9
**Version:** axe 4.9 (Deque University)

#### What axe-core Covers

Automated accessibility checks organized in six categories:

1. **WCAG 2.0 Level A & AA rules** — 50+ rules covering: text alternatives (images, areas, objects), ARIA attributes and roles, form labeling and naming, color contrast, language specification, keyboard navigation, structural markup (lists, tables, frames)

2. **WCAG 2.1 Level A & AA rules** — Autocomplete validation, text spacing adjustability

3. **WCAG 2.2 Level A & AA rules** — Target size requirements for touch interfaces (currently disabled by default in 4.9)

4. **Best Practices rules** — Landmark usage, heading hierarchy, heading visibility (beyond strict WCAG requirements)

5. **WCAG 2.x AAA rules** — Enhanced contrast, link consistency (disabled by default)

6. **Experimental and deprecated rules** — Emerging checks and phased-out rules

#### Key Limitation

axe-core performs **automated** checks only. Manual checks are also required for full WCAG compliance — axe cannot evaluate keyboard navigation flow, cognitive complexity, or many ARIA live region behaviors in context.

**Confidence: HIGH** — Deque University is the official axe-core documentation source.

---

### Lighthouse Accessibility Audits

**Source Classification: PRIMARY**
**URL:** https://developer.chrome.com/docs/lighthouse/accessibility/
**Last Updated:** October 22, 2025
**axe-core version used:** 4.11

#### Scoring Methodology

- Weighted average of all accessibility audits
- Binary pass/fail — no partial credit
- 56 automated audits in total; 10 additional manual checks (not scored)

#### High-Impact Audits (Weight 10)

- Image alt attributes
- ARIA attribute validity
- Button accessible names
- Form label associations
- Video captions
- Meta viewport settings

#### Lower-Impact Audits (Weight 3–7)

- Color contrast ratios
- Heading order and structure
- Skip link functionality

#### Important Limitations

- Based on axe-core rules; inherits the same automated/manual distinction
- WCAG level mapping is not explicit in Lighthouse output
- A perfect Lighthouse accessibility score does not guarantee WCAG 2.2 AA compliance

**Confidence: HIGH** — Chrome for Developers official documentation.

---

### Color Contrast Checking Tools

The following tools are used for WCAG contrast ratio verification (tool quality assessment from established UX practice):

- **WebAIM Contrast Checker** (https://webaim.org/resources/contrastchecker/) — Manual color value input, checks 4.5:1 and 3:1 thresholds
- **Colour Contrast Analyser** (Paciello Group / TPGi) — Desktop application for sampling colors from any on-screen element
- **Figma plugins** (e.g., Able, Contrast) — In-design-tool contrast checking
- **Chrome DevTools** — Built-in contrast ratio display in the color picker for CSS properties

**Confidence: MEDIUM** — tool recommendations are established community practice; no single primary source defines the definitive tool list.

---

## Key Takeaways

### WCAG 2.2 Specifics (Most Frequently Tested)

| Criterion | Requirement | Level | Version Added |
|-----------|-------------|-------|---------------|
| 1.4.3 | Text contrast 4.5:1 (normal), 3:1 (large) | AA | 2.0 |
| 1.4.11 | Non-text contrast 3:1 | AA | 2.1 |
| 2.5.8 | Touch targets 24×24 CSS px minimum | AA | 2.2 |
| 2.4.11 | Focus not entirely hidden | AA | 2.2 |
| 3.3.8 | Authentication without cognitive tests | AA | 2.2 |

### The 44×44px vs 24×24px Discrepancy

This is a common confusion point:
- **WCAG 2.5.8 (AA, 2.2):** 24×24 CSS pixels minimum (with spacing exception)
- **WCAG 2.5.5 (AAA, 2.1):** 44×44 CSS pixels (enhanced)
- **Apple HIG:** 44×44 points (which maps to 44×44px at 1x, but not to WCAG px)
- **Material Design:** 48×48dp recommended touch target

Senior designers typically target 44×44px as a practical standard (aligned with Apple and Material recommendations) even though WCAG 2.2 AA minimum is technically only 24×24px.

### AI-Specific Design Quality Dimensions (from PAIR)

Beyond standard accessibility metrics, AI interfaces require quality assessment in:
1. **Expectation calibration** — does the UI accurately communicate system capabilities and limitations?
2. **Trust calibration** — does the UI prevent both over-trust and under-trust?
3. **Feedback loop clarity** — is it clear how user feedback affects system behavior?
4. **Graceful degradation** — do failure states allow task completion?
5. **Mental model alignment** — does the system behave consistently with how users expect it to work?

### Gaps Identified

- **Apple HIG specific current content:** Not confirmable via static fetch (JavaScript-rendered). The URL https://developer.apple.com/design/human-interface-guidelines/ is verified as the official source.
- **Microsoft HAX 18 guidelines full text:** Structure confirmed (4 phases); individual guideline text not extractable without PDF download. The CHI 2019 paper (Amershi et al.) is the canonical source.
- **Google PAIR full chapter list:** Table of contents not accessible; confirmed chapters: user-needs, mental-models, feedback-controls, explainability-trust. Other chapters may exist.
- **Anthropic design guidelines:** No published equivalent to PAIR or HAX found as of March 2026.
- **W3C Design Tokens spec:** https://www.w3.org/TR/design-tokens/ returned 404; spec may be at a different URL or still in draft/community group stage.

---

## Sources

### Primary Sources (Official Standards Bodies / Platform Owners)

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/ (December 12, 2024)
- W3C Understanding WCAG 2.2 — Contrast Minimum: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (last updated October 31, 2025)
- W3C Understanding WCAG 2.2 — Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html (last updated February 23, 2026)
- W3C Understanding WCAG 2.2 — Target Size Minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (last updated October 1, 2025)
- W3C Understanding WCAG 2.2 — Focus Appearance: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html (last updated September 17, 2025)
- W3C WCAG 2.2 Quick Reference: https://www.w3.org/WAI/WCAG22/quickref/
- Apple HIG: https://developer.apple.com/design/human-interface-guidelines/ (JavaScript-rendered, content not confirmable)
- Material Design 3: https://m3.material.io/ (content partially confirmable via CSS)
- Google PAIR Guidebook: https://pair.withgoogle.com/guidebook/ (individual chapters accessible)
- Microsoft HAX Guidelines: https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/ (CHI 2019, last modified October 17, 2023)
- Deque axe-core 4.9: https://dequeuniversity.com/rules/axe/4.9
- Chrome Lighthouse accessibility: https://developer.chrome.com/docs/lighthouse/accessibility/ (last updated October 22, 2025)

### Secondary Sources (Established UX Research Organizations)

- Nielsen's 10 Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/ (original 1994, updated January 30, 2024)
- Fitts's Law in UI: https://www.nngroup.com/articles/fitts-law/ (July 31, 2022, updated January 24, 2024)
- Chunking and Miller's Law: https://www.nngroup.com/articles/chunking/ (March 20, 2016, updated February 2, 2024)
- Cognitive Load: https://www.nngroup.com/articles/minimize-cognitive-load/ (December 22, 2013, updated November 25, 2025)
- Gestalt Principles: https://ixdf.org/literature/topics/gestalt-principles (August 30, 2016, updated March 2, 2026)
- Hick's Law: https://lawsofux.com/hicks-law/ (no date; cites 1952 original research)
- 8pt Grid System: https://spec.fm/specifics/8-pt-grid (Spec Network, no publication date)
- Adobe Spectrum Design Tokens: https://spectrum.adobe.com/page/design-tokens/ (~June 2023)
