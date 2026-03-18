# Research: Security and Bug-Hunting Tools for Claude Code, MCP, and AI Coding Workflows
Date: 2026-03-18

## Summary

Comprehensive research into security scanning tools that integrate with Claude Code, MCP servers, and AI agent workflows — specifically for auditing a vibe-coded TypeScript monorepo. Covers five areas: MCP security servers, AgentShield, Claude Code hooks patterns, AI-based bug hunting, and competitor approaches.

## Prior Research
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-12-agentshield-security-analysis.md` — deep technical analysis of AgentShield specifically (read this first for AgentShield implementation details)
- `/Users/quinn/dev/harness/AI_RESEARCH/2026-02-22-claude-code-ecosystem-state.md` — general ECC/Claude Code ecosystem state

---

## Area 1: MCP Servers for Security Scanning

### 1.1 Official Semgrep MCP Server (RECOMMENDED — HIGH CONFIDENCE)

**Repository:** https://github.com/semgrep/mcp
**Package:** `semgrep-mcp` on PyPI
**Status:** Now integrated directly into the Semgrep binary (no longer a separate repo to maintain)

**Tools exposed to Claude:**
- `security_check` — scan code for security vulnerabilities (uses OSS ruleset)
- `semgrep_scan` — scan files with a given config string (e.g., `p/typescript`, `p/nextjs`, `p/owasp-top-ten`)
- `semgrep_scan_with_custom_rule` — scan with inline custom rule YAML
- `get_abstract_syntax_tree` — output AST of any code snippet (useful for debugging false positives)
- `semgrep_findings` — fetch findings from Semgrep AppSec Platform API (requires paid account + token)
- `supported_languages` — list all languages Semgrep supports
- `semgrep_rule_schema` — fetch rule JSON Schema

**Installation (two options):**
```bash
# Via uvx (zero-install)
uvx semgrep-mcp

# Via Docker
docker run -i --rm ghcr.io/semgrep/mcp -t stdio
```

**Claude Code `.mcp.json` config:**
```json
{
  "mcpServers": {
    "semgrep": {
      "command": "uvx",
      "args": ["semgrep-mcp"]
    }
  }
}
```

**TypeScript monorepo relevance:** Semgrep has dedicated TypeScript/JavaScript rules. Relevant rule packs: `p/typescript`, `p/react`, `p/nextjs`, `p/owasp-top-ten`, `p/nodejs`. The `security_check` tool runs against these automatically.

**Strengths vs weaknesses:**
- Strengths: 5,000+ rules, fast deterministic SAST, semantic understanding (not regex), custom rule authoring, open-source
- Weaknesses: SAST only (no SCA/dependency scanning), false positive rate can be high on complex codebases, Python runtime dependency

---

### 1.2 Official Snyk MCP Server (RECOMMENDED — HIGH CONFIDENCE)

**Source:** Built directly into Snyk CLI (`snyk mcp`)
**PulseMCP:** https://www.pulsemcp.com/servers/snyk-cli
**Community wrapper:** https://github.com/sammcj/mcp-snyk

**Tools exposed (11 total):**
- SAST scanning (static code analysis)
- SCA scanning (dependency vulnerability analysis — most relevant for pnpm monorepos)
- IaC scanning (Dockerfile, k8s, Terraform)
- Container image scanning
- SBOM generation (CycloneDX/SPDX formats)
- AI-BOM (inventory of AI model dependencies)

**Installation:**
```bash
npm install -g snyk
snyk auth  # login with Snyk account
```

**Claude Code `.mcp.json` config:**
```json
{
  "mcpServers": {
    "snyk": {
      "command": "snyk",
      "args": ["mcp"]
    }
  }
}
```

**TypeScript monorepo relevance:** The SCA tool reads `package.json` and lock files (`pnpm-lock.yaml`) across all workspace packages. Best-in-class for dependency vulnerability analysis — understands transitive dependencies.

**Strengths vs weaknesses:**
- Strengths: Most comprehensive single MCP server (11 tools), excellent SCA, free tier available, pnpm workspace aware
- Weaknesses: Requires Snyk account (free tier has rate limits), some features paywalled, sends code to Snyk cloud

---

### 1.3 mcp-security-audit (npm audit via MCP — MEDIUM CONFIDENCE)

**Repository:** https://github.com/qianniuspace/mcp-security-audit
**NPM:** `mcp-security-audit`

**What it does:** Wraps `npm audit` into an MCP server — provides vulnerability reports for npm dependencies with CVSS scoring and CVE references. Simpler and more focused than Snyk.

**Claude Code `.mcp.json` config:**
```json
{
  "mcpServers": {
    "mcp-security-audit": {
      "command": "npx",
      "args": ["-y", "mcp-security-audit"]
    }
  }
}
```

**Assessment:** Use this as a lightweight free alternative to Snyk SCA if you want zero-setup dependency scanning. It is narrower (npm audit only, no SAST or IaC) but requires no account.

---

### 1.4 Trivy MCP Server (MEDIUM CONFIDENCE)

**PulseMCP:** https://www.pulsemcp.com/servers/norbinsh-trivy-security-scanner

**What it does:** Wraps Aqua Security's Trivy scanner. Trivy does filesystem scanning (finding vuln packages from lock files), secret scanning, container image scanning, and SBOM generation. Natural language query interface — no security expertise required.

**Best for:** Container images and full filesystem sweeps. For a pure TypeScript monorepo with no Docker, Snyk or OSV-Scanner is more targeted.

---

### 1.5 MCP for Security (Penetration Testing Tools — LOW relevance for code audit)

**Repository:** https://github.com/cyproxio/mcp-for-security
**Scope:** 23+ tools — SQLmap, FFUF, Nmap, Nuclei, Masscan, WPScan, MobSF, SSLScan, Gowitness, Amass, etc.

**Assessment:** This collection is for penetration testing running services, not static code auditing. Not directly useful for auditing source code, but `nuclei` could be valuable for black-box testing a running dev instance of the web app. `ffuf` and `katana` are useful for crawling/fuzzing a deployed endpoint.

---

### 1.6 GitHub MCP Server — Secret Scanning (HIGH CONFIDENCE)

**Changelog:** https://github.blog/changelog/2026-03-17-secret-scanning-in-ai-coding-agents-via-the-github-mcp-server/

**New capability (March 2026):** The official GitHub MCP server (`@github-mcp/github`) now includes secret scanning tools. When invoked, it runs GitHub's secret scanning engine against current changes and returns structured results with file/line locations before you commit.

**Usage via natural language:** "Scan my current changes for exposed secrets and show me the files and lines I should update before I commit."

**Requirement:** Repository must have GitHub Secret Protection enabled.

**Relevance for harness:** The harness repo is already using the GitHub MCP server (`.mcp.json` is configured). This is a zero-cost addition to run during development — just ask Claude to check for exposed secrets before PRs.

---

### 1.7 AgentShield MCP / ECC Plugin (HIGH CONFIDENCE — ALREADY RESEARCHED)

**Prior research:** `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-12-agentshield-security-analysis.md`

**Quick summary:**
- 102 static analysis rules across 5 categories (secrets, permissions, hook injection, MCP risk, agent config)
- Scans Claude Code's own configuration files (`~/.claude/`, `.claude/settings.json`, `.mcp.json`, hooks, CLAUDE.md)
- CLI: `npx ecc-agentshield scan`
- GitHub Action: `affaan-m/agentshield@v1`
- `--opus` flag activates adversarial red-team/blue-team/auditor pipeline using Claude Opus

**This is for auditing the agent setup itself, NOT the application source code.** It does not replace Semgrep/Snyk for finding bugs in your TypeScript application.

---

## Area 2: AgentShield — What It Actually Is

See prior research at `/Users/quinn/dev/harness/AI_RESEARCH/2026-03-12-agentshield-security-analysis.md` for detailed technical breakdown.

**Key clarification:** AgentShield audits the *agent configuration* (CLAUDE.md, .mcp.json, hooks, settings.json, installed skills). It does NOT audit your TypeScript application source code for business logic vulnerabilities. The tool's primary value for this project is:

1. Auditing the harness repo's own Claude Code configuration for security risks
2. Detecting secrets accidentally embedded in agent config files
3. Flagging dangerous hook patterns that could be exploited via prompt injection
4. Profiling MCP server risk levels

---

## Area 3: Claude Code Hooks for Security

### 3.1 What Hooks Can Block vs. What They Only Observe

**Critical distinction from official docs:**
- `PreToolUse` — the ONLY hook type that can **block** an action (by exiting with non-zero or returning a block decision)
- All other hooks (`PostToolUse`, `Notification`, `Stop`, `SubagentStop`) — observational only, cannot stop execution

**For security gates:** Only `PreToolUse` matters. PostToolUse hooks run AFTER damage is done.

### 3.2 Established Patterns for Security Hooks

**Pattern A: Secret scanning before file writes**
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "bash -c 'grep -rE \"(api_key|secret|password|token)\\s*=\\s*[\\x27\\x22][^\\x27\\x22]+[\\x27\\x22]\" $CLAUDE_TOOL_INPUT_FILE_PATH && echo BLOCKED || exit 0'"
      }]
    }]
  }
}
```

**Pattern B: Run Semgrep after every file write (PostToolUse, non-blocking)**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "semgrep scan --config p/security-audit $CLAUDE_TOOL_INPUT_FILE_PATH 2>&1 | head -50"
      }]
    }]
  }
}
```

**Pattern C: Block dangerous bash commands (PreToolUse)**
The harness repo already has this pattern in `.claude/hooks/` — `block-no-verify`, `block-any-types`, etc.

**Pattern D: Agent-based security check (Prompt hook)**
Rather than shell scripts, use an LLM to evaluate ambiguous security conditions:
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "prompt",
        "prompt": "Is this bash command potentially destructive, exfiltrating data, or bypassing security controls? If yes, output BLOCK with reason. If safe, output ALLOW."
      }]
    }]
  }
}
```

### 3.3 Known Security Vulnerabilities in Claude Code's Hook System

**CVE-2025-59536 / CVE-2026-21852 (Check Point Research):**
Malicious `.claude/settings.json` files in a repository can define hooks that execute arbitrary shell commands on every collaborator's machine when they open the project in Claude Code. This is the same attack surface that Anthropic addressed with an "enhanced warning dialog" for untrusted project configurations.

**Defense:** Never clone and open an untrusted repo in Claude Code without reviewing its `.claude/settings.json` and `CLAUDE.md` first. AgentShield's hook analysis rules (34 rules) specifically detect these patterns.

### 3.4 Pre-Commit Hook Integration

The harness repo already uses Husky + lint-staged with Biome, Sherif, and the coverage gate pre-commit. Adding security scanning here is straightforward:

**Option A: Add Semgrep to pre-commit via lint-staged**
```json
// package.json lint-staged section
{
  "*.{ts,tsx}": ["semgrep scan --config p/typescript --error"]
}
```

**Option B: Add to the existing pre-commit-validate Claude Code hook**
The harness has a `pre-commit-validate` Claude Code hook (PreToolUse → Bash) that runs before every `git commit`. This could be extended to call `semgrep scan` on staged files.

---

## Area 4: AI Agent-Based Security Testing and Bug Hunting

### 4.1 Anthropic's Claude Code Security (Official Product)

**Announcement:** https://www.anthropic.com/news/claude-code-security
**Status:** Limited research preview, available to Enterprise/Team customers; open-source maintainers can apply for expedited free access.

**How it works:**
- Uses Claude Opus 4.6 to reason about code like a human security researcher
- Traces data flow, understands component interactions, identifies complex vulnerabilities
- Multi-stage verification: Claude re-examines findings to filter false positives
- Assigns severity ratings
- All results require human approval before implementation
- Found 500+ vulnerabilities in production open-source codebases; 22 Firefox vulnerabilities in 2 weeks with Mozilla

**What it is NOT:** An API or CLI you can run yourself. It's a managed product on claude.ai/code for Enterprise/Team.

**Current access:** Apply at anthropic.com/claude-code-security. Open source maintainers get expedited access.

---

### 4.2 Trail of Bits Security Skills (RECOMMENDED — HIGH CONFIDENCE)

**Repository:** https://github.com/trailofbits/skills

**What it is:** A professional collection of Claude Code skills from Trail of Bits, a leading security research firm. Not just prompts — these are battle-tested workflows used in real security audits.

**Installation:**
```
/plugin marketplace add trailofbits/skills
```

**Skills most relevant for TypeScript monorepo audit:**

| Skill | What It Does |
|-------|-------------|
| `audit-context-building` | Builds deep architectural context through ultra-granular code analysis — first step in any audit |
| `static-analysis` | Static analysis toolkit integrating CodeQL, Semgrep, and SARIF parsing |
| `variant-analysis` | Finds similar vulnerabilities across codebase once one is identified (pattern propagation) |
| `semgrep-rule-creator` | Creates and refines custom Semgrep rules for patterns specific to your codebase |
| `differential-review` | Security-focused review of code changes with git history analysis |
| `insecure-defaults` | Detects insecure default configurations, hardcoded credentials, fail-open security patterns |
| `supply-chain-risk-auditor` | Audits dependency supply-chain threat landscape |
| `agentic-actions-auditor` | Examines GitHub Actions workflows for vulnerabilities |
| `fp-check` | Systematic false positive verification |
| `sharp-edges` | Identifies error-prone APIs and dangerous patterns |

**Assessment:** These are the most professionally credible security skills available for Claude Code. Trail of Bits performs commercial security audits — these skills encode their actual methodology. Highly recommended for a serious vibe-coded codebase audit.

---

### 4.3 Semgrep + Claude Code Workflow (Research Methodology — MEDIUM CONFIDENCE)

**Source:** https://semgrep.dev/blog/2025/finding-vulnerabilities-in-modern-web-apps-using-claude-code-and-openai-codex

**What Semgrep found when testing Claude Code as a bug hunter:**
- Tested against 11 large real-world Python web apps
- Prompt used: "Find all {vuln_type} vulnerabilities in my code, don't worry about third-party code."
- Results format requested: SARIF JSON with code snippets tracing from entry points
- Claude Code (Sonnet 4) found 46 vulnerabilities with **14% true positive rate** (86% false positive rate)
- Performance varied: IDOR (22% accuracy), SQL injection (5%), XSS (16%)
- **Critical finding: Non-determinism** — identical prompts on same codebase produced 3, 6, then 11 findings across three runs

**Implication for harness audit:** Do not rely solely on Claude's own judgment. Pair Claude's semantic reasoning with deterministic tools (Semgrep rules, npm audit). Use Claude for reasoning about findings, not for generating the findings list.

---

### 4.4 Custom `/security-audit` Slash Command (OWASP Coverage)

**Source:** https://dev.to/afiqiqmal/claude-security-audit-a-claude-code-slash-command-for-owasp-top-102025-nist-csf-20-and-850-4mjn

A community-built `/security-audit` command that runs 850+ security checks across 18 attack categories, mapping to:
- OWASP Top 10:2025 (all 10 categories including new supply chain and error handling)
- NIST CSF 2.0
- CWE 4.x / SANS Top 25
- PCI DSS 4.0
- MITRE ATT&CK v15
- ISO 27001:2022 / SOC 2:2017

**Framework-specific checklists** include Next.js (directly relevant to harness).

**Modes:** Full audit, diff-only (for PR review), targeted deep dives (auth, API security, configuration).

This is a Claude Code slash command file (`.claude/commands/security-audit.md`) that you add to your project. No installation beyond copying the prompt file.

---

### 4.5 Built-in `/security-review` Command (HIGH CONFIDENCE)

**Documentation:** https://support.claude.com/en/articles/11932705-automated-security-reviews-in-claude-code
**GitHub Action counterpart:** https://github.com/anthropics/claude-code-security-review

**What it does:** Built-in Claude Code slash command since August 2025 (free, included by default). The system prompt is ~2,607 tokens, focused on "exploitable vulnerabilities" in code changes.

**Scope:**
- Manual (ad hoc): Run `/security-review` in terminal — analyzes full codebase
- GitHub Action: Runs on PR diff — analyzes only changed files, posts inline PR comments

**What it scans:**
- SQL injection, XSS
- Authentication/authorization flaws
- Insecure data handling
- Dependency vulnerabilities
- Business logic issues

**Key limitation:** Non-deterministic (like all LLM-based scanning). The Semgrep research showed 86% false positive rate for pure Claude scanning. Use `/security-review` as a complement to, not replacement for, deterministic tools.

**Customization:** Copy `security-review.md` from the Anthropic repo to your `.claude/commands/` folder and edit it.

**Important security note:** The official GitHub Action warns: "This action is NOT hardened against prompt injection attacks. Only use it to review trusted PRs." This is a real risk for public repos.

---

### 4.6 Snyk agent-scan (Agent/MCP Config Security — HIGH CONFIDENCE)

**Repository:** https://github.com/snyk/agent-scan

**What it is:** A separate Snyk tool specifically for scanning AI agent configurations. Not the same as the Snyk MCP server for scanning your application code.

**What it scans:** MCP server configs, agent skills, Claude/Cursor/Windsurf/Gemini CLI configs. Detects:
- Prompt injection in installed skills
- Tool poisoning, tool shadowing, toxic flows
- Malware payloads in natural language
- Credential handling issues
- Hardcoded secrets

**Installation:**
```bash
uvx snyk-agent-scan@latest
# Requires SNYK_TOKEN env var

# Scan with skills
snyk-agent-scan --skills
```

**ToxicSkills findings (February 2026):** Of 3,984 scanned skills, 13.4% contained critical security issues. 36.82% of the broader ecosystem showed compromise. 91% of malicious skills combined prompt injection with traditional malware. This is a real threat vector.

---

## Area 5: Bug Hunt Workflows

### 5.1 Anthropic's Official `/security-review` Workflow

Already covered in 4.5. The recommended workflow for ad-hoc bug hunting:

```
1. Run: /security-review
2. Review findings, ask Claude to explain any unclear ones
3. For each finding: ask Claude to trace the data flow and confirm exploitability
4. Request fix suggestions for confirmed vulnerabilities
5. Review and approve fixes
```

### 5.2 Trail of Bits Audit Workflow (Professional Approach)

The recommended sequence using Trail of Bits skills:

```
1. /audit-context-building  → Build architectural understanding
2. /static-analysis         → Run CodeQL + Semgrep, parse SARIF
3. /variant-analysis        → Once a bug class is found, find all instances
4. /differential-review     → Review recent diffs for new vulnerabilities
5. /insecure-defaults       → Check configuration and initialization patterns
6. /supply-chain-risk-auditor → Audit dependencies
7. /fp-check                → Verify findings before reporting
```

### 5.3 Targeted Bug Hunt Prompts (from Community)

**From Medium / Semgrep research:**

For targeted vulnerability hunting, the most effective pattern (14-22% true positive rate in controlled tests):
```
"Find all [SPECIFIC_VULN_TYPE] vulnerabilities in my code.
For each finding, provide:
1. File path and line numbers
2. The vulnerable code pattern
3. A concrete exploit scenario
4. Remediation steps
Report ONLY confirmed vulnerabilities, not theoretical risks."
```

Vulnerability types to run separately: IDOR, authorization bypass, SQL injection, XSS, CSRF, path traversal, prototype pollution, insecure deserialization, race conditions, SSRF.

**For TypeScript/Next.js specifically:**
- "Review all Server Actions in apps/web/src/app/ for authorization checks — verify every action checks authentication before performing database operations"
- "Find all Prisma queries that use raw SQL or string interpolation in query parameters"
- "Audit all API routes in apps/web/src/app/api/ for missing auth guards"

### 5.4 Hardening Claude Code Framework (Tim McAllister, Medium)

**Source:** https://medium.com/@emergentcap/hardening-claude-code-a-security-review-framework-and-the-prompt-that-does-it-for-you-c546831f2cec

Seven-category defense-in-depth framework:
1. Security Assessment (initial scan)
2. Supply Chain Protection
3. File-Level Malware Scanning
4. Credential Hygiene
5. MCP Server Audit
6. Governance

Can be run as a single reusable prompt that walks through all phases with explicit approval required between each.

---

## Area 6: Competitor Approaches (Cursor, Windsurf, Copilot)

### 6.1 What Competitors Actually Offer

**GitHub Copilot:**
- Code Review feature provides natural language feedback on PRs
- Research showed it frequently fails to detect critical vulnerabilities (SQL injection, XSS, insecure deserialization) — focuses on low-severity style issues
- GitHub MCP Server now adds secret scanning (as of March 2026)

**Cursor:**
- No native security scanning built in
- Supported integrations: Snyk Code (SAST), Checkmarx (SAST), StackHawk (DAST)
- Vulnerable to "Rules File Backdoor" attack — malicious `.cursorrules` files can inject hidden instructions (CVE disclosed March 2025)

**Windsurf:**
- Cascade v2 claims built-in vulnerability scanning and automatic security patches
- External integrations: Snyk (combined SAST + dependency)
- Also built on outdated Chromium (94+ known CVEs) per OX Security research

**Key insight:** Neither IDE provides sufficient native security alone. The industry consensus is a layered approach: SAST + SCA + DAST tools integrated externally. Claude Code's `/security-review` and Trail of Bits skills put Claude Code ahead of Cursor/Copilot for built-in security capability.

---

## Key Takeaways

### What to Add to the Harness Setup

**Immediate (zero cost, no new accounts):**
1. `semgrep-mcp` — Add to `.mcp.json`. Use `security_check` tool for on-demand SAST scanning during development.
2. `mcp-security-audit` — Add to `.mcp.json`. Wraps npm audit for dependency CVE checking.
3. `github` MCP server secret scanning — Already have GitHub MCP. Ask Claude to scan for secrets before commits.
4. Trail of Bits skills — Install via `/plugin marketplace add trailofbits/skills`. Run `audit-context-building` then `static-analysis` for initial audit.
5. `/security-review` — Already built into Claude Code. Run before major PRs.

**Medium effort (requires account):**
6. Snyk MCP server — Create free Snyk account, `npm install -g snyk`, add to `.mcp.json`. Best comprehensive coverage.
7. AgentShield — `npx ecc-agentshield scan` to audit the Claude Code configuration itself (not app code).
8. Custom `/security-audit` command — Copy the community OWASP slash command to `.claude/commands/security-audit.md`.

**Future (significant setup):**
9. `anthropics/claude-code-security-review` GitHub Action — Add to CI for automatic PR security reviews.
10. Anthropic Claude Code Security product — Apply for access at anthropic.com/claude-code-security.

### Critical Limitations to Know

1. **LLM-based scanning is non-deterministic**: Identical prompts produce different findings each run (verified by Semgrep research). Always pair with deterministic tools (Semgrep rules, npm audit).

2. **False positive rates are high**: Claude Code standalone scanning showed 86% false positive rate in controlled testing. Use `/security-review` to prioritize investigation, not as ground truth.

3. **Claude Code hook injection is a real CVE**: CVE-2025-59536 / CVE-2026-21852 — malicious repos can execute arbitrary code via `.claude/settings.json` hooks. Run AgentShield to audit your own hook configuration.

4. **Skills supply chain is compromised**: 13.4% of Claude Code skills on ClawHub contain critical security issues per Snyk's ToxicSkills research. Vet all external skills before installing.

5. **The GitHub Action is not injection-hardened**: Anthropic's own docs warn: "Not hardened against prompt injection attacks." Only run on trusted PRs.

---

## Sources

### MCP Servers
- https://github.com/semgrep/mcp — Official Semgrep MCP server
- https://www.pulsemcp.com/servers/semgrep — Semgrep MCP listing with config
- https://www.pulsemcp.com/servers/snyk-cli — Snyk MCP listing
- https://github.com/sammcj/mcp-snyk — Community Snyk MCP wrapper
- https://github.com/snyk/agent-scan — Snyk agent/skill scanner
- https://github.com/qianniuspace/mcp-security-audit — npm audit MCP server
- https://github.com/cyproxio/mcp-for-security — Pen testing MCP collection (23+ tools)
- https://github.com/Puliczek/awesome-mcp-security — Curated MCP security catalog
- https://chatforest.com/reviews/code-security-mcp-servers/ — Comparative review of security MCP servers
- https://github.blog/changelog/2026-03-17-secret-scanning-in-ai-coding-agents-via-the-github-mcp-server/ — GitHub MCP secret scanning

### AgentShield / ECC
- https://github.com/affaan-m/agentshield — AgentShield repo
- https://github.com/affaan-m/everything-claude-code/blob/main/the-security-guide.md — ECC security guide
- https://www.npmjs.com/package/ecc-agentshield — npm package

### Claude Code Security
- https://www.anthropic.com/news/claude-code-security — Claude Code Security announcement
- https://support.claude.com/en/articles/11932705-automated-security-reviews-in-claude-code — /security-review docs
- https://github.com/anthropics/claude-code-security-review — Official GitHub Action
- https://github.com/Piebald-AI/claude-code-system-prompts — System prompt analysis (2,607 token security-review prompt)

### Trail of Bits
- https://github.com/trailofbits/skills — Security skills repo

### Research / Methodology
- https://semgrep.dev/blog/2025/finding-vulnerabilities-in-modern-web-apps-using-claude-code-and-openai-codex — Controlled study of Claude Code bug hunting accuracy
- https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/ — ToxicSkills supply chain attack research
- https://research.checkpoint.com/2026/rce-and-api-token-exfiltration-through-claude-code-project-files-cve-2025-59536/ — Hook injection CVEs
- https://dev.to/afiqiqmal/claude-security-audit-a-claude-code-slash-command-for-owasp-top-102025-nist-csf-20-and-850-4mjn — Community OWASP slash command

### Competitors
- https://apiiro.com/blog/securing-code-with-cursor-and-windsurf/ — Cursor/Windsurf security analysis
- https://www.pillar.security/blog/new-vulnerability-in-github-copilot-and-cursor-how-hackers-can-weaponize-code-agents — Rules File Backdoor attack
