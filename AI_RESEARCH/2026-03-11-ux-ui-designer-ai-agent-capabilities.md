# Research: UX/UI Designer Capabilities in Claude Code CLI

Date: 2026-03-11

## Summary

Maps how a Senior UX/UI Designer's work translates to Claude Code CLI tools and automated
quality-checking pipelines. Covers tool-to-activity mapping, automation opportunities,
standard output formats, and verification methods.

## Prior Research

None directly applicable. Reviewed:
- `AI_RESEARCH/2026-03-05-ui-standardization-audit.md` — internal audit of this codebase's UI
- `AI_RESEARCH/2026-03-05-joy-inducing-ui-design-shadcn-customization.md` — design system principles

## Current Findings

---

### 1. Tool-to-Activity Mapping

#### Playwright (Visual + Accessibility + Responsive)

| UX/UI Activity | Playwright Mechanism |
|----------------|---------------------|
| Screenshot capture | `page.screenshot({ path, fullPage: true })` |
| Visual regression | `expect(page).toHaveScreenshot('name.png', { maxDiffPixels: 100 })` |
| Baseline update | `npx playwright test --update-snapshots` |
| Responsive testing | `page.setViewportSize({ width, height })` then screenshot |
| Accessibility scan (full page) | `@axe-core/playwright`: `AxeBuilder.analyze()` |
| Accessibility scan (scoped) | `AxeBuilder.include('#component').analyze()` |
| WCAG level filter | `AxeBuilder.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])` |
| Suppress known issues | `AxeBuilder.exclude('.third-party').disableRules(['color-contrast'])` |
| Export scan as attachment | `testInfo.attach('a11y', { body: JSON.stringify(results) })` |
| Keyboard nav testing | `page.keyboard.press('Tab')` + `page.locator(':focus')` assertions |
| Dark mode testing | `page.emulateMedia({ colorScheme: 'dark' })` |

Visual regression snapshots are stored in `[testfile]-snapshots/[name]-[browser]-[platform].png`.
The `stylePath` option in `toHaveScreenshot` applies CSS to mask dynamic regions (timestamps, ads)
before comparison, improving test determinism.

Source: https://playwright.dev/docs/accessibility-testing
Source: https://playwright.dev/docs/test-snapshots
Source: https://github.com/abhinaba-ghosh/axe-playwright

#### Read / Grep / Glob (Code Archaeology)

| UX/UI Activity | Tool + Pattern |
|----------------|---------------|
| Find all CSS custom properties | `Grep("--[a-z][-a-z0-9]+\s*:", glob="**/*.css")` |
| Audit color token usage | `Grep("var\(--color-", glob="**/*.{tsx,css}")` |
| Find hardcoded colors (anti-pattern) | `Grep("#[0-9a-fA-F]{3,6}|rgb\(|hsl\(", glob="**/*.{tsx,css}")` |
| Find aria attributes | `Grep("aria-[a-z]+", glob="**/*.tsx")` |
| Find missing alt text | `Grep("<img(?![^>]*alt=)", glob="**/*.tsx")` |
| Find components by pattern | `Glob("**/components/**/*.tsx")` |
| Audit focus management | `Grep("tabIndex|onFocus|onBlur|:focus", glob="**/*.tsx")` |
| Check for role attributes | `Grep('role="[^"]+"', glob="**/*.tsx")` |
| Find design token file | `Glob("**/tokens.{json,css,ts}")` |
| Review component variants | `Read("/absolute/path/to/button.tsx")` |

#### Bash (Automated Audit Tools)

| UX/UI Activity | Bash Command |
|----------------|-------------|
| Run Lighthouse audit (JSON) | `npx lighthouse https://url --output json --output-path ./report.json --chrome-flags="--headless"` |
| Run Lighthouse (all categories) | `npx lighthouse https://url --only-categories=performance,accessibility,best-practices,seo` |
| Install axe CLI | `npm install -g @axe-core/cli` |
| Run axe CLI against URL | `axe https://url --exit` |
| CSS analysis (projectwallace) | `npx @projectwallace/css-analyzer < styles.css` |
| Bundle size analysis | `npx bundlephobia <package>` or `npx source-map-explorer dist/*.js` |
| Check color contrast | WebaIM contrast checker API: `curl "https://webaim.org/resources/contrastchecker/?fcolor=FFFFFF&bcolor=000000&api"` |
| Run Playwright accessibility tests | `npx playwright test --reporter=html` |
| Generate coverage report | `npx playwright test --reporter=line` |

Lighthouse CLI output JSON structure:
```json
{
  "categories": {
    "performance": { "score": 0.92, "title": "Performance" },
    "accessibility": { "score": 0.87, "title": "Accessibility" },
    "best-practices": { "score": 0.95, "title": "Best Practices" },
    "seo": { "score": 0.90, "title": "SEO" }
  },
  "audits": {
    "largest-contentful-paint": { "score": 0.9, "numericValue": 1500 },
    "cumulative-layout-shift": { "score": 1, "numericValue": 0.02 },
    "total-blocking-time": { "score": 0.87, "numericValue": 210 }
  }
}
```

#### Edit / Write (Implementation)

| UX/UI Activity | Tool Usage |
|----------------|-----------|
| Implement component from spec | `Write` new file at component path |
| Update CSS custom property | `Edit` tokens file (old value → new value) |
| Add ARIA attributes | `Edit` component file |
| Fix color contrast | `Edit` CSS variable or inline style |
| Create design token file | `Write` new `tokens.json` or `tokens.css` |
| Add focus styles | `Edit` CSS with `:focus-visible` selector |
| Fix heading hierarchy | `Edit` JSX to use semantic `h1`-`h6` ordering |
| Add skip navigation | `Edit` layout component |

#### WebFetch / WebSearch (Research)

| UX/UI Activity | Tool + Query |
|----------------|-------------|
| Check WCAG criterion | `WebFetch("https://www.w3.org/WAI/WCAG22/Understanding/...")` |
| Research component patterns | `WebSearch("accessible dropdown menu WCAG 2.2 pattern")` |
| Find ARIA authoring practices | `WebFetch("https://www.w3.org/WAI/ARIA/apg/patterns/")` |
| Check browser support | `WebSearch("CSS :focus-visible browser support")` |
| Research design token format | `WebFetch("https://design-tokens.github.io/community-group/format/")` |
| Find contrast ratio formula | `WebFetch("https://webaim.org/resources/contrastchecker/")` |

#### Agent / Sub-agent (Parallel Audits)

Parallel dispatch pattern — run all three audits simultaneously:
```
Agent 1: Accessibility audit (axe-playwright scan of all routes)
Agent 2: Performance audit (Lighthouse CI on key pages)
Agent 3: Design token consistency (Grep for hardcoded values + CSS analyzer)
```

This is the primary compound workflow. A single task that would take serial execution
20+ minutes can be dispatched as three parallel agents, each producing a structured
JSON report that the orchestrating agent synthesizes into a final remediation plan.

---

### 2. Automated Tools for UX/UI Quality Checking

#### axe-core / @axe-core/playwright

- **What it checks:** Color contrast, missing alt text, invalid ARIA roles, empty buttons/links,
  form label association, focus management, landmark regions, document structure, keyboard traps
- **Impact levels:** `critical`, `serious`, `moderate`, `minor`
- **WCAG tags:** `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, `best-practice`, `cat.forms`, `cat.color`, etc.
- **Violation object shape:**
  ```json
  {
    "id": "color-contrast",
    "impact": "serious",
    "description": "Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.x/color-contrast",
    "tags": ["wcag2aa", "wcag143", "cat.color"],
    "nodes": [{
      "html": "<span class='text-muted'>...</span>",
      "target": [".text-muted"],
      "impact": "serious",
      "any": [{ "id": "color-contrast", "message": "Element has insufficient color contrast..." }]
    }]
  }
  ```
- **Four result arrays:** `violations`, `passes`, `incomplete` (needs manual review), `inapplicable`
- **Key API:** `AxeBuilder.withTags(['wcag2aa']).include('#main').exclude('.skip').analyze()`

Source: https://raw.githubusercontent.com/dequelabs/axe-core/develop/doc/API.md
Source: https://playwright.dev/docs/accessibility-testing

#### Lighthouse (Performance + Accessibility + Best Practices + SEO)

- **Score scale:** 0-49 = Poor (red), 50-89 = Needs Improvement (orange), 90-100 = Good (green)
- **Performance metric weights (Lighthouse 10):**
  - Total Blocking Time: 30%
  - Largest Contentful Paint: 25%
  - Cumulative Layout Shift: 25%
  - First Contentful Paint: 10%
  - Speed Index: 10%
- **Target:** score >= 90 for "Good"
- **Run via Node:** `const { default: lighthouse } = await import('lighthouse'); const result = await lighthouse(url, { output: 'json' });`

Source: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring

#### Core Web Vitals Thresholds (web.dev)

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP (loading) | ≤ 2.5s | 2.5s – 4.0s | > 4.0s |
| INP (interactivity) | ≤ 200ms | 200ms – 500ms | > 500ms |
| CLS (visual stability) | ≤ 0.1 | 0.1 – 0.25 | > 0.25 |

**Measurement standard:** 75th percentile of page loads, segmented by device type.

Source: https://web.dev/articles/vitals

#### @projectwallace/css-analyzer

- **What it measures:** 150+ metrics across stylesheet lines, file size, at-rules (@media, @keyframes,
  @container, @supports), selectors (count, specificity, complexity), declarations, properties
  (standard, custom/tokens, vendor prefixes, !important count), values (colors, font families,
  font sizes, z-indexes, shadows, units)
- **Design system utility:** Token usage ratio (custom properties vs. hardcoded values), color
  uniqueness count, specificity distribution
- **Usage:**
  ```javascript
  import { analyze } from "@projectwallace/css-analyzer";
  const result = analyze(cssString);
  // result.__meta__.analyzeTime in ms
  // result.values.colors.total — total color declarations
  // result.properties.custom.total — custom property count
  ```

Source: https://github.com/projectwallace/css-analyzer

#### WCAG Color Contrast Thresholds

| Content Type | AA Minimum | AAA Enhanced |
|-------------|-----------|-------------|
| Normal text (< 18pt / < 14pt bold) | 4.5:1 | 7:1 |
| Large text (≥ 18pt or ≥ 14pt bold) | 3:1 | 4.5:1 |
| UI components + graphical objects | 3:1 | N/A |

Programmatic check: `GET https://webaim.org/resources/contrastchecker/?fcolor=FFFFFF&bcolor=000000&api`
Returns JSON: `{ "ratio": "21.0", "AA": "pass", "AAA": "pass", "AALarge": "pass", "AAALarge": "pass" }`

Source: https://webaim.org/resources/contrastchecker/

---

### 3. Standard Output Formats

#### Accessibility Audit Report

```markdown
## Accessibility Audit: [Component/Page Name]
Date: YYYY-MM-DD
Tool: axe-core 4.x + @axe-core/playwright
WCAG Level: AA (2.2)

### Critical Violations (must fix before release)
| Rule ID | Element | Impact | WCAG Criterion | Remediation |
|---------|---------|--------|----------------|-------------|
| color-contrast | .btn-secondary | serious | 1.4.3 | Darken background from #94a3b8 to #64748b |

### Serious Violations (fix in current sprint)
...

### Incomplete (manual review required)
...

### Summary
- Total violations: N
- Critical: N | Serious: N | Moderate: N | Minor: N
- Passed rules: N
- Pages/components scanned: N
```

#### Heuristic Evaluation Matrix (Nielsen scale)

Severity ratings:
- 0 — Not a usability problem
- 1 — Cosmetic (fix if time permits)
- 2 — Minor (low priority)
- 3 — Major (high priority)
- 4 — Catastrophic (fix before release)

Severity = f(frequency × impact × persistence). Three evaluators; use mean score.

```markdown
## Heuristic Evaluation: [Feature Name]
Evaluator: [name] | Date: YYYY-MM-DD

| # | Heuristic Violated | Location | Severity | Description | Recommendation |
|---|-------------------|----------|----------|-------------|----------------|
| 1 | Visibility of system status | /chat loading state | 3 | No loading indicator during API calls | Add skeleton or spinner on message submit |
```

#### Component Specification

```markdown
## Component: Button
Variants: primary | secondary | ghost | destructive
Sizes: sm | md | lg
States: default | hover | focus | active | disabled | loading

### Props
| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| variant | 'primary' \| 'secondary' \| ... | 'primary' | No | Visual style |

### Accessibility
- Role: button (native or explicit)
- Focus: visible :focus-visible ring, min 3:1 contrast vs adjacent
- Keyboard: Space/Enter activate; Escape closes menus
- ARIA: aria-disabled when disabled (do not use HTML disabled for keyboard access)
- Min target size: 44×44px (WCAG 2.5.8 AA, WCAG 2.2)
```

#### Design Token File (W3C DTCG format, April 2025 spec)

```json
{
  "color": {
    "brand": {
      "primary": {
        "$value": "#2563eb",
        "$type": "color",
        "$description": "Primary brand blue, used for CTAs and interactive elements"
      }
    }
  },
  "spacing": {
    "sm": { "$value": "8px", "$type": "dimension" },
    "md": { "$value": "16px", "$type": "dimension" }
  },
  "typography": {
    "body": {
      "fontFamily": { "$value": "Inter, system-ui", "$type": "fontFamily" },
      "fontSize": { "$value": "16px", "$type": "dimension" }
    }
  }
}
```

Valid `$type` values per W3C DTCG living draft (updated 2025-04-18):
`color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number`, `string`,
`boolean`, `null`, `strokeStyle`, `border`, `transition`, `shadow`, `gradient`, `typography`, `composite`

Source: https://github.com/design-tokens/community-group

#### Performance Budget Report

```markdown
## Performance Audit: [Page/Route]
Date: YYYY-MM-DD | Tool: Lighthouse 12.x | Mode: Mobile, throttled 4G

### Core Web Vitals
| Metric | Measured | Threshold | Status |
|--------|----------|-----------|--------|
| LCP | 1.8s | ≤ 2.5s | PASS |
| INP | 180ms | ≤ 200ms | PASS |
| CLS | 0.04 | ≤ 0.1 | PASS |

### Lighthouse Scores
| Category | Score | Target |
|----------|-------|--------|
| Performance | 94 | ≥ 90 |
| Accessibility | 87 | ≥ 90 |
| Best Practices | 100 | ≥ 90 |
| SEO | 92 | ≥ 90 |

### Accessibility Score Alert
Score 87 is below target 90. Violations from axe audit required.
```

---

### 4. Quality Gates: How a UX Designer Verifies Their Work

#### WCAG 2.2 AA Compliance

**New criteria in WCAG 2.2 (vs 2.1) at AA level:**
- 2.4.11 Focus Not Obscured (Minimum) — focused element not entirely hidden by sticky headers/footers
- 2.5.7 Dragging Movements — all drag actions have pointer alternative
- 2.5.8 Target Size (Minimum) — interactive targets at least 24×24 CSS pixels
- 3.2.6 Consistent Help — help mechanisms appear in consistent location
- 3.3.7 Redundant Entry — previously entered info not re-requested
- 3.3.8 Accessible Authentication (Minimum) — no cognitive function test required to authenticate

**Automation coverage (axe-core catches ~30-40% of WCAG issues):**
- Color contrast ratios
- Missing alt text
- Invalid ARIA roles/attributes
- Form label association
- Empty buttons/links
- Missing language attribute
- Duplicate IDs
- Keyboard traps (partial)

**Manual checks required:**
- Logical reading order via keyboard Tab sequence
- Screen reader announcement accuracy (NVDA/JAWS/VoiceOver)
- Focus visible on all interactive elements (quality judgment)
- Alternative text appropriateness (context-dependent)
- Zoom to 200% — no content loss, no horizontal scroll
- Cognitive load and error recovery quality
- Motion/animation — `prefers-reduced-motion` honored

Source: https://www.w3.org/TR/WCAG22/
Source: https://www.w3.org/WAI/test-evaluate/preliminary/

#### Cross-Browser / Cross-Device Testing

Playwright viewport sizes for standard breakpoints:
```javascript
const BREAKPOINTS = [
  { name: 'mobile-sm', width: 375, height: 812 },   // iPhone SE
  { name: 'mobile-lg', width: 428, height: 926 },   // iPhone 14 Pro Max
  { name: 'tablet', width: 768, height: 1024 },      // iPad
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
];
```

Playwright supports Chromium, Firefox, and WebKit (Safari) for cross-browser matrix.

#### Performance Budgets (Quality Gate Thresholds)

| Metric | Target | Fail |
|--------|--------|------|
| Lighthouse Performance | ≥ 90 | < 70 |
| Lighthouse Accessibility | ≥ 90 | < 80 |
| LCP | ≤ 2.5s | > 4.0s |
| INP | ≤ 200ms | > 500ms |
| CLS | ≤ 0.1 | > 0.25 |
| TBT | ≤ 200ms | > 600ms |

Source: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
Source: https://web.dev/articles/vitals

#### Design System Consistency Gate

Checks to automate with Grep + CSS analyzer:
1. Zero hardcoded hex/rgb/hsl colors (all must use `var(--color-*)`)
2. Zero hardcoded pixel spacing outside of design token values
3. Custom property count stable or decreasing (no token sprawl)
4. Specificity graph — no outlier high-specificity selectors
5. `!important` count = 0 (outside reset stylesheets)

#### Keyboard Navigation Verification Checklist

- [ ] All interactive elements reachable via Tab
- [ ] Tab order matches visual reading order
- [ ] Focus indicator visible and meets 3:1 contrast (WCAG 2.4.11 + 2.4.13 at AAA)
- [ ] No keyboard trap (can Tab out of every component)
- [ ] Modal/dialog traps focus within itself and restores on close
- [ ] Escape dismisses menus, modals, tooltips
- [ ] Arrow keys navigate within composite widgets (menus, tabs, sliders)
- [ ] Skip navigation link present and functional

#### Screen Reader Compatibility

Manual test matrix:
| Screen Reader | Browser | Platform |
|--------------|---------|----------|
| VoiceOver | Safari | macOS / iOS |
| NVDA | Firefox | Windows |
| JAWS | Chrome/IE | Windows |
| TalkBack | Chrome | Android |

Automated check: axe-core `aria-*` rules + landmark rules cover structural requirements.
Announcement quality (e.g., live regions, status messages) requires manual testing.

---

## Key Takeaways

1. **Playwright is the hub** — it handles visual regression, responsive testing, and accessibility
   scanning in one test suite. The `@axe-core/playwright` integration with `AxeBuilder.withTags(['wcag2aa'])`
   is the standard pattern for automated WCAG checks.

2. **axe-core does not cover everything** — automated tools catch ~30-40% of WCAG issues.
   The `incomplete` result array (requires manual review) is as important as `violations`.

3. **Lighthouse CI** (`@lhci/cli`) is the standard for CI performance gates. Configure
   assertions like `{ "audits[largest-contentful-paint].numericValue": { "maxNumericValue": 2500 } }`.

4. **Design tokens must be the W3C DTCG format** (`$value`, `$type`, `$description`) for
   cross-tool compatibility (Figma, Style Dictionary, Theo).

5. **WCAG 2.2 AA adds six new success criteria** not in WCAG 2.1. The most impactful for
   engineering are 2.5.8 (Target Size: 24×24px minimum) and 2.4.11 (Focus Not Obscured).

6. **Nielsen severity 3-4 = must fix before release**. Three evaluators + mean score is the
   reliable methodology for heuristic severity.

7. **Parallel Agent dispatch** is the primary force-multiplier: one agent per audit domain
   (a11y, performance, design-system-consistency) running simultaneously, synthesized into
   a single prioritized remediation report.

## Sources

- https://playwright.dev/docs/accessibility-testing
- https://playwright.dev/docs/test-snapshots
- https://github.com/abhinaba-ghosh/axe-playwright
- https://raw.githubusercontent.com/dequelabs/axe-core/develop/doc/API.md
- https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
- https://developer.chrome.com/docs/lighthouse/overview
- https://web.dev/articles/vitals
- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/test-evaluate/preliminary/
- https://webaim.org/resources/contrastchecker/
- https://github.com/projectwallace/css-analyzer
- https://github.com/design-tokens/community-group
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/
- https://code.claude.com/docs/en/cli-usage
- https://designsystem.digital.gov/design-tokens/
