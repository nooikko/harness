# Research: E2E Testing Framework Landscape (Early 2026)
Date: 2026-03-19

## Summary

Comprehensive survey of end-to-end testing frameworks as of March 2026. Playwright has become the dominant E2E framework by weekly downloads (~33M/week vs Cypress's ~6M/week). Cypress remains actively maintained but is losing market share. Selenium/WebDriver persists in enterprise Java/Python contexts but is rarely recommended for new JavaScript projects. AVA is a unit test runner — not an E2E framework. WebdriverIO maintains a strong niche in mobile+web cross-platform testing. TestCafe is maintained but largely stagnant. Vitest Browser Mode is real but explicitly positioned as a complement to, not a replacement for, full E2E frameworks.

## Prior Research

No prior E2E testing research in AI_RESEARCH/.

---

## 1. Playwright

### Key Stats
- **Current version:** 1.58.2 (released February 6, 2026)
- **GitHub stars:** 84,600+
- **GitHub forks:** 5,300+
- **Weekly npm downloads:** ~33.3 million (across playwright + @playwright/test)
- **Used by:** 449,000+ dependents on GitHub
- **License:** Apache-2.0
- **Backed by:** Microsoft
- **Release cadence:** Monthly minor releases (~4-6 week intervals); patch releases as needed

### Recent Release History
| Version | Date | Key Features |
|---------|------|-------------|
| 1.58.2 | Feb 6, 2026 | Trace viewer stdin fix, SwiftShader macOS fix |
| 1.58.1 | Jan 30, 2026 | MS Edge local network permissions, CFT download location fix |
| 1.58.0 | Jan 23, 2026 | Token-efficient CLI mode with 3 agent types (planner, generator, healer), Timeline visualization in HTML reports, UI mode system theme support |
| 1.57.0 | Nov 25, 2025 | Speedboard dashboard (test execution perf metrics), Chrome for Testing builds (replacing Chromium), webServer regex wait patterns |
| 1.56.0 | Oct 6, 2024 | Playwright Agents — LLM-guided test exploration, generation, and auto-repair; new APIs for console messages, page errors, network requests |

### Major Recent Features
- **Playwright Agents (v1.56+):** Three LLM-guided definitions for exploring apps, generating tests, and auto-repairing failures. Uses AI to reduce test maintenance overhead.
- **Token-efficient CLI mode (v1.58):** Optimized for AI-assisted test workflows with planner/generator/healer agent types.
- **Chrome for Testing (v1.57):** Switched from bundled Chromium to Google's official Chrome for Testing builds; headed uses `chrome`, headless uses `chrome-headless-shell`.
- **Speedboard (v1.57):** HTML reporter tab showing tests sorted by execution time for performance optimization.
- **API Testing:** `APIRequestContext` enables direct HTTP testing of backend endpoints (Next.js API routes, Server Actions) without browser overhead.

### Strengths for Next.js App Router
- **Official Next.js endorsement:** Next.js 16 documentation (`nextjs.org/docs/app/guides/testing/playwright`) lists Playwright as the primary E2E testing guide.
- **`create-next-app` integration:** `--example with-playwright` scaffold is officially maintained by Vercel.
- **`webServer` config:** Automatically starts and waits for Next.js dev/prod server before running tests.
- **API testing:** Can test Next.js API routes and server-side behavior via `APIRequestContext`.
- **Full-stack testing:** Tests the full Next.js pipeline — Server Components render, Client Component hydration, Server Actions, route handlers.
- **Multi-browser:** Chromium, Firefox, and WebKit in a single config.
- **Parallelization:** Sharding and worker-based parallel test execution built in.
- **Trace Viewer:** Records and replays complete test execution with DOM snapshots, network requests, console logs.

### Weaknesses for Next.js App Router
- **No Server Component unit testing:** Cannot test RSC logic in isolation — only through browser rendering.
- **No component-level testing:** Unlike Cypress, Playwright is purely E2E (no component mounting). You need Vitest for component tests.
- **Setup complexity:** Requires running a full Next.js server; cold starts can slow CI.
- **Binary downloads:** Each `playwright install` downloads browser binaries (~300MB+), which complicates Docker caching.
- **No visual DOM diffing in browser:** Trace Viewer is post-run only; no live DOM inspector during test authoring (partially addressed by UI Mode).

### Sources
- https://playwright.dev/docs/release-notes
- https://github.com/microsoft/playwright (stats as of March 2026)
- https://nextjs.org/docs/app/guides/testing/playwright
- https://npmtrends.com/playwright-vs-cypress

---

## 2. Cypress

### Key Stats
- **Current version:** 15.12.0 (released March 13, 2025; GitHub shows "March 13, 2026" — likely a display artifact, but v15.x is clearly the current branch as of March 2026)
- **GitHub stars:** 49,600+
- **GitHub forks:** 3,400+
- **Weekly npm downloads:** ~6.1 million
- **Dependent repos:** 1.5M+
- **License:** MIT
- **Backed by:** Cypress.io (VC-backed startup — Bessemer, OpenView, Sapphire, Battery, Stripes)
- **Release cadence:** Bi-weekly to monthly minor releases

### Recent Release History
| Version | Date | Key Changes |
|---------|------|------------|
| 15.12.0 | Mar 13, 2026 | Latest release |
| 15.10.0 | Feb 3, 2025 | Ongoing v15 maintenance |
| v15 launch | Aug 20, 2025 | AI-assisted test creation (Studio AI), `cy.env()`, Angular 20 support, TypeScript via `tsx` |
| v14 launch | Jan 16, 2025 | `justInTimeCompile`, `cy.origin()` required for subdomain nav, React 19/Angular 19/Next.js 15 support |

### Major Recent Features (v14-v15)
- **Studio AI (v15):** AI-assisted test recording — record interactions, add assertions by right-clicking, edit tests inline. Prepares for "the next era of AI-assisted test creation."
- **Cloud MCP:** Beta MCP server connecting AI assistants to Cypress Cloud for test debugging workflows.
- **cy.env() (v15):** Async command for securely accessing environment variables; the old `Cypress.env()` is deprecated.
- **cy.prompt:** Allows LLM-generated test steps with network request waiting.
- **justInTimeCompile (v14):** Compiles only spec-related resources, improving component test performance.

### Company/Funding Status
The official Cypress about page confirms VC backing (Bessemer, OpenView, Sapphire, Battery, Stripes). The company describes itself as "growing" with open roles. No verified acquisition, bankruptcy, or major layoff news was found in official sources. The blog focuses exclusively on product updates (Studio AI, Cloud MCP, release notes) with no organizational announcements as of March 2026.

**Note on market position:** Weekly downloads (~6.1M) vs. Playwright (~33.3M) represent roughly a 5.5x gap. This is a significant reversal from 2021-2022 when Cypress was the dominant framework. The product is actively maintained and evolving (monthly releases, AI features), but is clearly losing share to Playwright.

### Strengths for Next.js App Router
- **Component testing:** Cypress supports component-level testing for React, Vue, Angular components with its own mounting harness. Official support for Next.js 14, 15, 16 declared.
- **Time-travel debugging:** In-browser test runner shows DOM state at every step.
- **Familiar JavaScript syntax:** More intuitive API for developers new to testing.
- **Real browser (not headless-first):** Tests run in a real, embedded browser — easier to debug visually.
- **Dashboard/Cloud:** Cypress Cloud provides parallelization, video recording, and flaky test detection as a paid service.

### Weaknesses for Next.js App Router
- **App Router component testing caveat:** Cypress explicitly states "Server Components" and `getServerSideProps` methods are not available in component tests — E2E is recommended for App Router pages.
- **Single-tab architecture:** Cannot test multi-tab or cross-origin flows without workarounds (v14's `cy.origin()` partially addresses subdomain navigation).
- **Slower downloads/CI:** Cypress binary is large (200MB+); install times are a known pain point.
- **Commercial cloud dependency:** Parallelization requires Cypress Cloud (paid), whereas Playwright sharding is free.
- **Market share decline:** Growing difficulty finding Cypress-specific help as community migrates to Playwright.

### Sources
- https://github.com/cypress-io/cypress/releases
- https://docs.cypress.io/app/references/changelog
- https://www.cypress.io/about
- https://npmtrends.com/playwright-vs-cypress

---

## 3. Selenium / WebDriver

### Key Stats
- **Current version:** 4.41.0 (released February 20, 2026; 4.42.0-SNAPSHOT nightly as of March 2026)
- **Supported languages:** JavaScript (npm: `selenium-webdriver`), Java, Python, C#/.NET, Ruby
- **Backed by:** OpenJS Foundation (non-profit); major sponsors BrowserStack, Sauce Labs, TestMu AI
- **License:** Apache-2.0
- **Release cadence:** Roughly monthly for patch/minor releases; blog shows 4.37-4.41 all within Oct 2025 - Feb 2026

### Current State
Selenium is actively maintained and releasing regularly. The blog shows updates roughly every 4-8 weeks. Version 4.x is the current stable branch. Notable recent activity:
- Active Python support modernization (ended Python 3.9 support, Oct 2025)
- Selenium Grid improvements with Docker/Kubernetes integration
- Chrome two-week release cycle adaptation (March 2026 blog post)

### Is Selenium Recommended for New JavaScript Projects?
**Confidence: HIGH — No, Selenium is not recommended for new Next.js/JavaScript projects.**

Reasons:
1. **Architecture:** Selenium communicates over HTTP to a WebDriver server (local or remote), adding latency and setup complexity compared to Playwright's in-process browser control.
2. **JavaScript DX:** The `selenium-webdriver` npm package lacks the developer experience of Playwright (no built-in test runner, assertions, retry logic, trace recording).
3. **Primary use case:** Selenium's JavaScript binding is a niche choice; the ecosystem primarily serves Java and Python shops with legacy test suites.
4. **Playwright supersedes it:** Microsoft built Playwright explicitly as a modern replacement. For JavaScript-first projects, Playwright provides everything Selenium does and more, with better tooling.
5. **When Selenium is appropriate:** Cross-language test suites; organizations with Java/Python testing infrastructure; legacy enterprise test suites that cannot be rewritten; cloud grid providers (BrowserStack, Sauce Labs) where Selenium Grid is the canonical integration.

### Strengths
- Language-agnostic: one test suite can be used by Java/Python/Ruby/C# teams
- Universal browser grid support (every cloud provider supports Selenium Wire Protocol)
- 20-year track record; vast documentation and Stack Overflow coverage

### Weaknesses for Next.js App Router
- Verbose API; no built-in auto-retry or smart waiting (manual `WebDriverWait` required)
- No built-in test runner, assertions, or HTML reporter (must compose your own)
- Remote WebDriver architecture adds latency and configuration overhead
- No native Next.js integration or official Vercel support

### Sources
- https://selenium.dev/blog/
- https://selenium.dev/downloads/

---

## 4. AVA

### IMPORTANT CLARIFICATION
AVA is a **Node.js unit/integration test runner** — it is not an E2E framework and has no browser automation capabilities. It is in the same category as Jest, Vitest, or Mocha — not Playwright or Cypress.

### Key Stats
- **Current version:** 7.0.0 (released February 27, 2026)
- **GitHub stars:** 20,900+
- **GitHub contributors:** 310
- **Dependent projects:** 124,000+
- **Backed by:** Community (key maintainers: Mark Wubben, Sindre Sorhus)
- **License:** MIT

### What AVA Does
AVA runs Node.js tests concurrently, with isolated test file environments, TypeScript support, and detailed error diffs ("magic assert"). It enforces atomic test design and provides clean stack traces.

### Maintenance Status
**Actively maintained.** v7.0.0 was released February 27, 2026 (recent). 57 open issues (healthy), 310 contributors, regular release history (106 total releases). The project shows signs of continued care from its core maintainers.

### Is AVA Suitable for E2E Testing?
**No.** AVA's own documentation says "dedicated E2E frameworks like Puppeteer, Selenium, or Cypress are better suited for browser automation and end-to-end workflows." AVA has no concept of a browser, DOM, or HTTP server lifecycle.

### Relevance to Next.js App Router Projects
AVA would only be relevant for testing pure Node.js utilities (helper functions, data transformations) that don't require a browser. For a Next.js project, Vitest is the more common choice for this layer because it integrates naturally with the Vite/Next.js ecosystem. AVA and Vitest are direct competitors in the unit test runner space.

### Sources
- https://github.com/avajs/ava

---

## 5. Other Frameworks / New Entrants

### WebdriverIO

**Key Stats:**
- **Current version:** v9.26.1 (released March 15, 2026)
- **GitHub stars:** 9,800+
- **GitHub forks:** 2,700+
- **Open issues:** 234
- **Backed by:** OpenJS Foundation (non-profit); enterprise support via Tidelift
- **License:** MIT
- **Release cadence:** Very frequent — v9.26.0 and v9.26.1 both released March 15, 2026

**v9 Key Changes (Aug 2024):**
WebdriverIO v9 adopts the **WebDriver Bidi protocol**, providing "much greater automation capabilities than ever before." This is a significant architectural upgrade from the classic WebDriver HTTP protocol.

**February 2026 Highlight:**
Released **WebdriverIO MCP** — a unified MCP server for both browsers and mobile apps, announced February 4, 2026.

**Primary Strengths:**
- True open-source governance (OpenJS Foundation, not corporate-owned)
- Supports web, native/hybrid mobile, desktop, and VS Code extension testing in one framework
- WebDriver Bidi protocol support (modern standard, cross-browser)
- Vitest Browser Mode uses WebdriverIO as one of three supported providers

**Weaknesses for a Next.js-first project:**
- Lower download volume and community share vs. Playwright
- Primarily valued for mobile+web cross-platform scenarios; overkill for pure Next.js web testing
- Less Next.js ecosystem documentation than Playwright

**Sources:**
- https://github.com/webdriverio/webdriverio
- https://webdriver.io/blog/

---

### TestCafe

**Key Stats:**
- **Current version:** 3.7.4 (released January 19, 2025)
- **GitHub stars:** 9,900+
- **Backed by:** Developer Express Inc. (DevExpress — proprietary software company)
- **License:** MIT (open source)

**Current State:**
Last release was January 19, 2025 — over a year without a new release as of March 2026. The project has 15 open issues and 11 active PRs suggesting some activity, but the release cadence has slowed dramatically. DevExpress continues to own it.

**Assessment:** TestCafe was a noteworthy Playwright/Cypress alternative circa 2020-2022 for its zero-setup promise (no browser binaries). As of early 2026, it has effectively been superseded. It is not recommended for new projects. The slow release cadence and DevExpress ownership (which prioritizes commercial products) make its long-term trajectory uncertain.

---

### Vitest Browser Mode

**Current Status:** Available but self-described as "still in its early stages of development" — not production-ready for full E2E use.

**What It Is:**
Vitest Browser Mode runs Vitest tests inside a real browser (via Playwright, WebdriverIO, or Preview providers) instead of jsdom. It provides access to real browser APIs (`window`, `document`), DOM assertions, and component rendering.

**Key Capabilities:**
- Fills inputs, clicks buttons, simulates keyboard events via Chrome DevTools Protocol or WebDriver
- Framework-specific rendering (Vue, React, Svelte component testing)
- Multiple browser support (Chromium, Firefox, WebKit)
- Visual regression testing and trace view (via Playwright provider)
- Vitest 3 (Jan 2025) improved multi-browser configuration via `instances` option

**Limitations:**
- Explicitly "early stages of development" — bugs and unoptimized paths acknowledged
- Thread-blocking dialogs (alert, confirm) cannot be used natively
- Module spy/mock constraints due to sealed namespace objects
- Longer initialization time (browser startup per test run)
- **Official recommendation:** Vitest's own docs say to "augment Browser Mode with a standalone browser-side test runner like WebdriverIO, Cypress or Playwright" for comprehensive E2E testing

**Verdict:** Vitest Browser Mode is positioned as a component/integration testing tool that provides higher browser fidelity than jsdom, not as a Playwright replacement. For a Next.js App Router project, the correct stack is: Vitest for unit/component tests + Playwright for E2E tests.

**Sources:**
- https://vitest.dev/guide/browser/
- https://vitest.dev/guide/browser/why
- https://vitest.dev/blog/vitest-3

---

## Download Comparison (Weekly, March 2026)

| Framework | Weekly Downloads | GitHub Stars |
|-----------|-----------------|-------------|
| Playwright | ~33.3 million | 84,600 |
| Cypress | ~6.1 million | 49,600 |
| Selenium (JS binding) | Not measured (multi-language) | — |
| WebdriverIO | Not measured separately | 9,800 |
| AVA | Not measured (unit test runner) | 20,900 |
| TestCafe | Not measured | 9,900 |

Source: npmtrends.com/playwright-vs-cypress (March 2026)

---

## Key Takeaways

1. **Playwright is the clear leader** for new JavaScript/TypeScript E2E projects as of early 2026 — 5.5x weekly downloads vs. Cypress, official Next.js endorsement, AI-assisted test features (Agents, token-efficient CLI), and Microsoft backing.

2. **Cypress is alive but declining in share.** v15 with Studio AI shows it is actively investing in product differentiation. The company is VC-backed with no confirmed acquisition or shutdown. However, its download share vs. Playwright has inverted since ~2022 and continues to diverge.

3. **Selenium/WebDriver is a legacy choice** for JavaScript projects. It remains the right answer for polyglot enterprise teams and cloud grid integrations, but new JavaScript-first projects should use Playwright.

4. **AVA is not an E2E framework.** v7.0.0 (Feb 2026) confirms it is actively maintained as a Node.js unit test runner. Not relevant for E2E.

5. **WebdriverIO v9** with WebDriver Bidi is a modern framework worth considering if mobile app testing is required alongside web testing. Not the best choice for pure Next.js projects.

6. **TestCafe** (last release Jan 2025) is effectively stagnant. Not recommended for new projects.

7. **Vitest Browser Mode** is real but self-limited — officially recommended only as a complement to a dedicated E2E framework. The canonical Next.js stack is Vitest (unit/component) + Playwright (E2E).

## Recommendation for Next.js App Router

For the Harness project specifically (Next.js 16 App Router, pnpm monorepo, Vitest already in use):

- **Unit/integration tests:** Vitest (already in use)
- **E2E tests:** Playwright — official Next.js support, `webServer` config, API testing, Trace Viewer, 33M weekly downloads, Microsoft-backed

## Sources

- https://playwright.dev/docs/release-notes
- https://github.com/microsoft/playwright
- https://nextjs.org/docs/app/guides/testing/playwright
- https://github.com/cypress-io/cypress/releases
- https://docs.cypress.io/app/references/changelog
- https://www.cypress.io/about
- https://npmtrends.com/playwright-vs-cypress
- https://selenium.dev/blog/ and https://selenium.dev/downloads/
- https://github.com/avajs/ava
- https://github.com/webdriverio/webdriverio/releases
- https://webdriver.io/blog/
- https://www.testcafe.io/
- https://github.com/DevExpress/testcafe/releases
- https://vitest.dev/guide/browser/
- https://vitest.dev/guide/browser/why
- https://vitest.dev/blog/vitest-3
