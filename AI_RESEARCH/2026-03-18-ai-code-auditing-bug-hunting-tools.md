# Research: AI-Native Code Auditing and Bug Hunting Tools
Date: 2026-03-18

## Summary

Comprehensive survey of AI-powered code auditing, bug hunting, and security tools targeting AI-generated codebases. Covers AgentShield (agent config scanner), Shannon (autonomous pentester), Claude Code Review (Anthropic's native multi-agent PR reviewer), CodeRabbit, Greptile, Qodo, Semgrep, Snyk DeepCode, Codacy, Ultimate Bug Scanner, and Kodus. All tools confirmed to support TypeScript/Node.js.

## Prior Research
- `2026-03-12-agentshield-security-analysis.md` — deep prior analysis of AgentShield, confirmed it is a regex-based CLI/GitHub Action, not an MCP server. That file has the full source tree breakdown.
- `2026-03-12-everything-claude-code-analysis.md` — ECC ecosystem context

---

## Current Findings

---

### 1. AgentShield

**Official URL:** https://github.com/affaan-m/agentshield
**npm package:** `ecc-agentshield` (https://www.npmjs.com/package/ecc-agentshield)
**Prior research file:** `2026-03-12-agentshield-security-analysis.md` — read that file for full detail.

**What it actually does:**
AgentShield is a static analysis security scanner for AI agent configurations — specifically for Claude Code setups. It is NOT an MCP server. It scans `.claude/` directories, CLAUDE.md files, hooks configs, and MCP server registrations for security vulnerabilities.

102 rules across 5 categories:
- Secrets (10 rules, 14 patterns) — hardcoded API keys, tokens, credentials
- Permissions (10 rules) — wildcard access, missing deny lists, dangerous flags
- Hooks (34 rules) — command injection, data exfiltration, reverse shells
- MCP Servers (23 rules) — high-risk servers, supply chain issues, hardcoded secrets
- Agent Configs (25 rules) — unrestricted tools, prompt injection vectors, hidden instructions

1,280 tests across those rules.

**How it's used:**
```bash
npx ecc-agentshield scan           # Zero-install CLI scan
agentshield scan --fix              # Auto-fix safe issues
agentshield scan --opus --stream    # Three-agent Opus adversarial analysis (requires ANTHROPIC_API_KEY)
agentshield init                    # Generate secure baseline config
agentshield miniclaw start          # Launch sandboxed agent server
```
Also available as a GitHub Action (`uses: affaan-m/agentshield@v1`) and as an ECC Claude Code plugin (`/security-scan` slash command).

Default mode is pure regex-based static analysis. The three-agent adversarial pipeline (Red Team / Blue Team / Auditor using Claude Opus) only activates with `--opus` flag.

**Pricing:** MIT license. Free and open source.

**TypeScript/Node.js:** Yes — the tool itself is written in TypeScript. Scans Claude Code configurations, not application source code.

**Complement to Claude Code:** Directly targeted at Claude Code security. Scans the project's `.claude/` directory, hooks, and MCP server configs that Claude Code uses. Most relevant tool for securing the Harness orchestrator's own Claude Code setup.

---

### 2. Shannon (spelled "Shannon", not "Shanon")

**Official URL:** https://github.com/KeygraphHQ/shannon
**Commercial product:** Shannon Pro (no public URL in research results)
**Coverage:** https://cybersecuritynews.com/shannon-ai-pentesting-tool/

**What it actually does:**
Shannon is an autonomous white-box AI pentester for web applications and APIs. It is NOT a code linter or static analyzer — it runs live exploits against a running application. Two-stage approach:
1. Source code analysis to identify attack vectors (reads your repo)
2. Live exploitation using browser automation and CLI tools to prove each vulnerability is real

Targets: OWASP vulnerabilities — injection, auth bypass, SSRF, XSS, IDOR, business logic flaws. Handles 2FA/TOTP, SSO, browser navigation, and report generation without manual intervention.

Built on Anthropic's Claude Agent SDK to emulate human red team tactics across the full pentest lifecycle: reconnaissance, vulnerability analysis, exploitation, reporting.

**Performance:** 96.15% on the XBOW benchmark (100/104 exploit challenges). Most commercial DAST tools score 30-40% on comparable evaluations.

**How it's used:**
```bash
git clone https://github.com/KeygraphHQ/shannon.git
cd shannon
export ANTHROPIC_API_KEY="your-key"
./shannon start URL=https://your-app.com REPO=repo-name
./shannon logs          # real-time worker activity
./shannon query ID=...  # check specific run status
./shannon stop          # halt containers (preserves data)
./shannon workspaces    # list all previous runs
```
Shannon Lite is CLI-only (manual invocation). Shannon Pro adds GitHub PR scanning and CI/CD orchestration. Runs support workspaces that checkpoint via git commits — interrupted runs can be resumed.

**Pricing:**
- Shannon Lite: AGPL-3.0 open source. Free for local testing.
- Shannon Pro: Commercial product. Pricing not publicly listed.
- Estimated cost: ~$50 per engagement in Anthropic API calls (runs 1-1.5 hours).

**TypeScript/Node.js:** Performs source code analysis on whatever repo you point it at. The README doesn't list framework-specific limitations — it reads source + runs against the live app regardless of stack.

**Warning from creators:** Mandatory authorization required. Not safe to run against production — the tool executes mutative exploits that can impact system stability.

**Complement to Claude Code:** Complementary, not overlapping. Use Shannon against a running instance of the Harness web app to find actual exploitable vulnerabilities. It goes further than any static tool because it validates findings via live exploitation.

---

### 3. Claude Code Review (Anthropic Native)

**Official URL:** https://code.claude.com/docs/en/code-review
**Admin setup:** https://claude.ai/admin-settings/claude-code

**What it actually does:**
Anthropic launched Code Review in Claude Code (March 9, 2026 — research preview). It's a managed multi-agent system that automatically analyzes GitHub PRs and posts inline comments. A fleet of specialized agents examines code changes in the context of the full codebase:
- Bug Detection Agent — logic errors, security vulnerabilities, unhandled edge cases, regressions
- Verification Agent — checks each finding against actual code behavior (filters false positives)
- Overview Agent — generates PR summary comment, classifies issues by severity

Findings are tagged by severity (Normal = bug before merging, Nit = minor, Pre-existing = existed before this PR). Does NOT approve or block PRs. Reads `CLAUDE.md` and a `REVIEW.md` file to customize what it flags.

**How it's used:**
- GitHub App installation via admin settings (not CLI, not CI/CD — it's a managed service)
- Three trigger modes: once after PR creation, after every push, or manual (`@claude review` comment)
- Findings appear as inline PR comments within ~20 minutes on average
- Can also run locally via a `code-review` plugin in the plugin marketplace

**Pricing:**
- Requires Teams or Enterprise Claude subscription
- NOT available with Zero Data Retention orgs
- Billed on token usage: $15-25 per review on average (scales with PR size and codebase complexity)
- Billed as "extra usage" — does not count against plan's included usage
- Monthly spend cap configurable in admin settings

**TypeScript/Node.js:** Yes — language agnostic, reads the full codebase for context.

**Complement to Claude Code:** This IS Claude Code — Anthropic's own managed PR review service. Unique advantage: it has full codebase context (not just the diff), reads your CLAUDE.md, and uses the same model that generated the code to review it. The REVIEW.md customization means you can encode project-specific rules (e.g., Harness's plugin architectural invariants).

---

### 4. CodeRabbit

**Official URL:** https://www.coderabbit.ai/
**Docs:** https://docs.coderabbit.ai/
**Pricing page:** https://www.coderabbit.ai/pricing

**What it actually does:**
AI code review tool that analyzes PRs and posts inline comments. Includes 40+ built-in linters and security scanners alongside LLM-powered contextual review. A December 2025 CodeRabbit analysis of 470 open-source GitHub PRs found AI co-authored code had 2.74x higher security vulnerability rates — the tool is tuned to catch exactly these patterns.

**How it's used:**
- GitHub App (primary integration) — auto-triggers on PR open/push
- IDE extension (VS Code) — free, for on-demand local reviews before pushing
- CLI — for terminal-based review automation
- Customizable via `.coderabbit.yaml` config file

**Pricing:**
- Free: Unlimited public + private repos, PR summarization, IDE reviews (rate-limited)
- Pro: $24/month/developer (annual) or $30/month (monthly). Unlimited PR reviews, Jira/Linear integrations, SAST tool support, analytics. Charged per developer who creates PRs — not total team.
- Enterprise: Custom pricing, self-hosting option, SLA support, custom RBAC.
- Free for open source projects.

**TypeScript/Node.js:** Yes — supports JavaScript, TypeScript, Python, Java, C#, C++, Ruby, Rust, Go, PHP.

**Complement to Claude Code:** Runs automatically on every PR in parallel with Claude Code Review. Lower per-review cost ($24/seat/month vs $15-25/review) makes it cost-effective for high-volume teams. The built-in SAST/linter layer is complementary to Claude's semantic reasoning.

---

### 5. Greptile

**Official URL:** https://www.greptile.com/
**GitHub App:** https://github.com/apps/greptile-apps
**Pricing:** https://www.greptile.com/pricing

**What it actually does:**
AI code review agent with full codebase indexing. Builds a language-agnostic semantic graph of every function, class, and dependency, then uses multi-hop investigation to trace issues across files. NOT a diff-only tool — it understands the entire repo. Claims 82% bug detection rate in benchmarks vs CodeRabbit at 44%, Copilot at 54%, Cursor at 58%.

V4 (early 2026): 74% increase in addressed comments per PR, 68% increase in positive developer replies vs prior version. Highest catch rate AND highest false positive rate in independent evaluations — a trade-off.

**How it's used:**
- GitHub App (primary) — integrates with GitHub PRs, leaves inline comments
- API access — for custom integrations
- Zapier integration — for workflow automation
- No CLI in Lite tier

**Pricing:**
- Cloud: $30/seat/month. Includes 50 reviews per seat; additional reviews $1 each. Fewer than 10% of users exceed the included usage.
- Discounts: 20% for 1-year contracts, 50% for pre-Series A startups, free for OSS.
- 14-day free trial.
- Enterprise: Custom pricing, self-hosted deployment, SSO/SAML, GitHub Enterprise, dedicated Slack support.

**TypeScript/Node.js:** Yes — benchmarked specifically against Cal.com (a TypeScript project). Caught 100% of high-severity bugs in TypeScript test cases.

**Complement to Claude Code:** Best for cross-file bug detection that spans components. The semantic code graph makes it strong for architectural violations (e.g., a plugin reaching into orchestrator internals). Higher cost than CodeRabbit but stronger at multi-file reasoning.

---

### 6. Qodo (formerly CodiumAI)

**Official URL:** https://www.qodo.ai/
**VS Code marketplace:** https://marketplace.visualstudio.com/items?itemName=Codium.codium

**What it actually does:**
AI code integrity platform with 5 specialized agents:
- Qodo Gen — test generation
- Qodo Merge — PR code review
- Qodo Cover — coverage analysis
- Qodo Aware — deep research across codebase
- Qodo Command — workflow automation

42-48% detection rate for real-world runtime bugs using static analysis + dynamic symbolic execution. Context Engine achieves 80% accuracy in codebase understanding (competitors at 45-74%). 15+ agentic workflows covering bug detection, test coverage, and documentation. Multi-repo context engine indexes and understands codebases across repositories. Recognized as a Visionary in 2025 Gartner Magic Quadrant for AI Code Assistants.

**How it's used:**
- GitHub, GitLab, Bitbucket integration for PR reviews
- VS Code and JetBrains IDE plugins
- CLI for terminal-based review automation outside PRs
- SaaS, on-premises, and air-gapped deployment options (SOC 2 Type II)

**Pricing:** Not publicly detailed in search results. Enterprise tier with on-prem available. Trial via website.

**TypeScript/Node.js:** Yes — Python, JavaScript, TypeScript, Java, C++, C#, Go, Ruby, PHP.

**Complement to Claude Code:** Strongest on test generation (Qodo Gen fills coverage gaps that Claude Code might not address). The multi-repo context engine is useful for monorepos like Harness. The CLI lets it run locally, not just on PRs.

---

### 7. Semgrep

**Official URL:** https://semgrep.dev/
**GitHub:** https://github.com/semgrep/semgrep
**Semgrep Code (SAST product):** https://semgrep.dev/products/semgrep-code/

**What it actually does:**
Fast open-source SAST tool with deterministic pattern matching + AI layer (Semgrep Assistant). Two detection modes:
1. Deterministic SAST: classic XSS, SQL injection, hardcoded secrets — zero false positives on what it catches
2. AI-powered (Assistant): IDOR, business-logic flaws, complex data-flow issues that rules can't express

Semgrep Assistant (AI component): reduces findings to triage by 20% on day one by filtering false positives using mitigating context. Learns from your team's triage decisions over time. Provides step-by-step remediation instructions. Framework-aware: 50+ frameworks including Express, NestJS, React, Angular.

The Semgrep Secure 2026 announcement (Feb 2026) introduced a "multimodal AppSec engine" combining deterministic analysis with LLM reasoning, targeting zero false positives with deep context-aware detection.

**How it's used:**
- CLI: `semgrep scan` — runs against local codebase
- CI/CD integration (GitHub Actions, GitLab, Jenkins, etc.)
- IDE plugins (VS Code, JetBrains)
- Pre-commit hooks

**Pricing:**
- Community Edition: Open source, LGPL-2.1. Free for commercial use, CI/CD, custom rules.
- Semgrep Code (cloud platform): Free tier + paid plans. Contact for enterprise pricing.

**TypeScript/Node.js:** Yes — first-class support. Engine-level support for Express, NestJS, React, Angular with framework-specific rules.

**Complement to Claude Code:** Most natural fit as a pre-commit / CI gate. Run `semgrep scan` on staged files to catch security issues before Claude Code even sees them. The SAST rules are deterministic (no LLM cost), making it cheap to run on every commit.

---

### 8. Snyk / DeepCode AI

**Official URL:** https://snyk.io/ and https://snyk.io/platform/deepcode-ai/
**Pricing:** https://snyk.io/plans/

**What it actually does:**
Snyk is a developer security platform. DeepCode AI is their ML-powered SAST layer. Three core products relevant here:
- Snyk Code (SAST): real-time scanning with DeepCode AI fix suggestions. 80%-accurate security autofixes. 25M+ data flow training cases. 19+ languages.
- Snyk Open Source (SCA): dependency vulnerability scanning
- Snyk Container / IaC: container and infrastructure-as-code scanning

DeepCode AI is trained on real-world security fixes, not just vulnerability patterns — it suggests how to fix issues, not just where they are.

**How it's used:**
- IDE plugins (VS Code, JetBrains, Eclipse, Visual Studio)
- CLI: `snyk test`, `snyk code test`
- CI/CD integration (GitHub Actions, GitLab, Jenkins, etc.)
- GitHub PR checks (automatic on push)

**Pricing:**
- Free: Small teams, limited features
- Team: $25/month/developer (minimum 5 developers)
- Enterprise: Custom pricing
- Free tier has real scanning capability (not just a demo)

**TypeScript/Node.js:** Yes — first-class. TypeScript and JavaScript explicitly listed. SCA covers npm/yarn dependency trees.

**Complement to Claude Code:** The SCA layer (dependency scanning) fills a gap that pure code review tools miss. Snyk catches vulnerable npm packages that Claude Code won't flag. The IDE plugin gives real-time feedback before code is even committed — different workflow than PR-time review.

---

### 9. Codacy

**Official URL:** https://www.codacy.com/
**Pricing:** https://www.codacy.com/pricing

**What it actually does:**
Code quality and security platform with the broadest AppSec surface area in this category. Includes SAST, SCA (dependency checks), DAST, secrets detection, SBOM generation, license scanning, and pentesting in one platform. 49 languages, 30+ linters/analyzers integrated.

New in 2026:
- AI Risk Hub: centrally define AI policies and enforce them across teams/projects — specifically targets "vibe coding" governance
- AI Reviewer: contextual AI code review on PRs
- AI Guardrails: free IDE extension that scans AI-generated code in real time as you type (before commit)

**How it's used:**
- GitHub, GitLab, Bitbucket integration
- IDE extension (VS Code, Cursor, Windsurf) — for AI Guardrails
- CLI
- CI/CD pipeline integration

**Pricing:**
- Free plan available
- Paid: $15/user/month
- Enterprise: Custom

**TypeScript/Node.js:** Yes — JavaScript, TypeScript listed explicitly. 49 languages total.

**Complement to Claude Code:** The broadest platform coverage (SAST + SCA + DAST + secrets + SBOM + license). The AI Guardrails IDE extension is the most real-time option here — catches issues as Claude Code writes them. The AI Risk Hub addresses the governance angle: tracking how much AI-generated code is in the codebase and enforcing policies.

---

### 10. Ultimate Bug Scanner (UBS)

**Official URL:** https://github.com/Dicklesworthstone/ultimate_bug_scanner

**What it actually does:**
Static analysis tool that catches 1,000+ bug patterns specifically designed to be consumed by AI coding agents. The README explicitly frames it as "The AI Coding Agent's Secret Weapon." Catches: null pointer crashes, XSS vulnerabilities, missing `await` statements, language-specific pitfalls. Outputs machine-readable formats optimized for LLM context windows (TOON = token-optimized format).

**How it's used:**
```bash
ubs .                      # scan current directory
ubs --staged               # scan only git-staged files
ubs . --format=json        # machine-readable output for agents
ubs . --fail-on-warning    # strict CI mode
```
Output formats: text, JSON, JSONL, TOON (token-optimized), SARIF. Auto-detects languages present in repo.

**Pricing:** MIT license. Free and open source. Install via Homebrew, Scoop, or curl installer.

**TypeScript/Node.js:** Yes — JavaScript and TypeScript are listed explicitly. Auto-detects language presence.

**Complement to Claude Code:** The most direct complement — specifically designed to wire into AI coding agent quality guardrails. The TOON output format fits in Claude's context window efficiently. Best used as a pre-commit check or as a tool Claude Code can call to self-check generated code.

---

### 11. Kodus

**Official URL:** https://www.kodus.io/ (cloud: app.kodus.io)
**GitHub:** https://github.com/kodustech/kodus-ai

**What it actually does:**
Open-source AI code review platform. Works directly in PRs with GitHub, GitLab, Bitbucket, and Azure Repos. "Bring your own API key" model — use Claude, GPT-5, Gemini, or Llama with zero markup on LLM costs. Custom review rules and up to 15 configurable review rules (paid). SOC 2 in progress.

**How it's used:**
- GitHub App / GitLab integration (primary)
- Cloud hosted at app.kodus.io
- Self-hosted via Docker, VM, or Railway
- CLI for local and pipeline reviews

**Pricing:**
- Community (Free): Self-hosted or cloud, 10 rules max, 3 plugins max
- Teams: $10/developer/month. Unlimited rules and plugins, metrics dashboard.
- Enterprise: Custom, SSO, compliance features.
- Bring-your-own-API-key: zero LLM cost markup.

**TypeScript/Node.js:** The platform itself is 95.9% TypeScript. Language support for code review follows the underlying model's capabilities.

**Complement to Claude Code:** The cheapest option for PR-integrated AI review ($10/dev/month). The BYOK model means you can use Claude Sonnet for reviews without paying Kodus a markup. Self-hosting option is relevant if data residency matters.

---

### 12. NVIDIA Garak

**Official URL:** https://garak.ai/ and https://github.com/NVIDIA/garak

**What it actually does:**
LLM vulnerability scanner — NOT a code scanner. Garak probes LLM models themselves for vulnerabilities: prompt injection, jailbreaks, hallucinations, data leakage, adversarial attacks. 190+ probes, simulates attacks against the model and uses detectors to evaluate outputs. Works against any LLM endpoint.

**How it's used:**
- Python CLI: `python -m garak --model_type openai --model_name gpt-4`
- Python API for integration into test suites
- NeMo Guardrails integration (NVIDIA ecosystem)

**Pricing:** Open source (Apache 2.0). Free.

**TypeScript/Node.js:** Not applicable — Garak tests LLM models, not TypeScript codebases. Written in Python.

**Complement to Claude Code:** Orthogonal use case. Relevant if you want to red-team the Claude models being used in the Harness orchestrator (testing for prompt injection via user inputs, jailbreak resistance, etc.) — not for auditing the codebase itself.

---

## Key Takeaways for the Harness Project

**Securing agent configs (highest priority):** AgentShield — scans `.claude/` directories, hooks, MCP server configs. Directly relevant since Harness has a complex Claude Code setup with many hooks.

**PR-time code review (ship less bugs):** Claude Code Review ($15-25/review, Teams+) is the highest-signal option because it has full codebase context and reads CLAUDE.md. CodeRabbit ($24/dev/month) is cost-effective for high-volume and adds 40+ built-in linters.

**Static security scanning (CI gate):** Semgrep Community Edition (free) with NestJS/Express rules catches security issues before they reach PR stage. Zero cost, runs in 1-2 seconds on staged files.

**Dependency vulnerabilities (supply chain):** Snyk free tier covers npm dependency scanning — different category from all the above.

**AI-generated code governance:** Codacy AI Guardrails (free IDE extension) catches issues as Claude Code generates them in real time.

**Penetration testing (prove exploitability):** Shannon — runs live exploits against a running Harness instance. Use in a staging environment, not production. ~$50/engagement in API costs.

**For AI agent integration pattern:** Ultimate Bug Scanner outputs TOON format optimized for LLM context windows — can be called by Claude Code itself as a self-check tool.

---

## Vibe Coding / AI-Generated Code Security Context

Research confirmed the scale of the problem this tooling addresses:
- 24.7% of AI-generated code has a security flaw (2025 research)
- AI co-authored code has 2.74x higher security vulnerability rates (CodeRabbit December 2025 analysis of 470 OSS PRs)
- Zero CSRF protection, zero security headers, SSRF in every single major AI coding tool tested (audit of Claude Code, Codex, Cursor, Replit, Devin — 69 vulnerabilities in 15 test apps)

---

## Sources

- https://github.com/affaan-m/agentshield — AgentShield GitHub
- https://libraries.io/npm/ecc-agentshield — npm package details
- https://github.com/KeygraphHQ/shannon — Shannon GitHub
- https://cybersecuritynews.com/shannon-ai-pentesting-tool/ — Shannon coverage
- https://cyberpress.org/shannon-autonomous-vulnerabilities/ — Shannon coverage
- https://code.claude.com/docs/en/code-review — Claude Code Review official docs
- https://techcrunch.com/2026/03/09/anthropic-launches-code-review-tool-to-check-flood-of-ai-generated-code/ — Claude Code Review launch
- https://www.coderabbit.ai/pricing — CodeRabbit pricing
- https://www.greptile.com/pricing — Greptile pricing
- https://www.greptile.com/benchmarks — Greptile benchmark data
- https://www.qodo.ai/ — Qodo
- https://semgrep.dev/products/semgrep-code/ — Semgrep Code
- https://github.com/semgrep/semgrep — Semgrep GitHub
- https://snyk.io/platform/deepcode-ai/ — Snyk DeepCode AI
- https://snyk.io/plans/ — Snyk pricing
- https://www.codacy.com/ — Codacy
- https://github.com/Dicklesworthstone/ultimate_bug_scanner — Ultimate Bug Scanner
- https://github.com/kodustech/kodus-ai — Kodus GitHub
- https://github.com/NVIDIA/garak — NVIDIA Garak
- https://awesomeagents.ai/news/vibe-coding-security-69-vulnerabilities/ — vibe coding vulnerability audit
