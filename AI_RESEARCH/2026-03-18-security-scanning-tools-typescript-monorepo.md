# Research: Security Scanning Tools for TypeScript/Node.js Monorepos
Date: 2026-03-18

## Summary

Comprehensive landscape survey of security scanning tools suitable for auditing a TypeScript/Node.js
monorepo (specifically a pnpm workspace + Turborepo stack running Next.js 16). Coverage spans
SAST, SCA, DAST, secret scanning, and IaC scanning. Research focus: tools that work well on
AI-generated ("vibe coded") codebases.

## Prior Research

No prior security tooling research exists in AI_RESEARCH/.

---

## 1. SAST (Static Application Security Testing)

### Semgrep
- **URL**: https://semgrep.dev
- **License**: OSS CLI (Apache 2.0) + paid tiers (Team/Enterprise ~$40/dev/mo)
- **TypeScript support**: HIGH MATURITY — cross-file dataflow analysis, 50+ framework/library
  detectors including Express, NestJS, React, Angular. Engine-level taint tracking for OWASP
  Top 10 vulnerabilities (SQLi, Path Traversal, SSRF). TypeScript specifically listed at
  "Cross-File Dataflow Analysis — Highest Maturity."
- **CI/CD**: First-class. Lightweight CLI, official GitHub Actions, GitLab CI. 10-second median
  scan time. Non-zero exit codes for gating.
- **Pre-commit**: Supported via CLI.
- **Monorepo/pnpm**: CLI can be pointed at any path; no native pnpm workspace detection, but
  running `semgrep --config=auto .` from the monorepo root scans all packages. Fast enough for
  pre-commit scope-limiting.
- **AI features**: Semgrep Assistant — AI-powered triage that agrees with security engineers 97%
  of the time. Auto-triages findings, generates remediation guidance (80% rated helpful). Can
  increase true positive rate by up to 20%. "Assistant Memories" for custom secret detection rules.
  Specifically designed for "vibe coding" security — Replit partnership deploys ~200 curated
  rules pre-deployment on AI-generated code.
- **Accuracy**: 82% accuracy, 12% false positive rate (SAST Tool Evaluation Study 2024).
- **Best for**: Developer-first security, custom rule writing, vibe-coded code auditing.

### CodeQL (GitHub Advanced Security)
- **URL**: https://codeql.github.com
- **License**: Free for public repos; GitHub Advanced Security ~$29/dev/mo for private repos
- **TypeScript support**: Native. TypeScript analysis runs through the JavaScript extractor
  with TypeScript enabled by default. Supports semantic (dataflow) analysis, not just pattern
  matching.
- **CI/CD**: GitHub Actions native (`github/codeql-action`). Advanced setup allows path filtering
  for monorepos via `paths-ignore` / `paths` keywords — scan only changed packages.
- **Pre-commit**: Not designed for pre-commit (scan times ~8 min for large codebases).
- **Monorepo/pnpm**: Supported via advanced setup. Can exclude directories and scope scans to
  specific packages. pnpm workspace detection is not automatic — requires manual workflow
  configuration.
- **AI features**: GitHub Copilot Autofix generates fix suggestions inline. Semantic analysis
  (not LLM-based).
- **Accuracy**: 88% accuracy, 5% false positive rate (highest accuracy of major SAST tools).
  Highest F1 score on OWASP Benchmark v1.2 (arXiv:2601.22952, 2025).
- **Best for**: Deepest semantic analysis, lowest false positive rate, GitHub-centric orgs.

### SonarQube / SonarCloud
- **URL**: https://www.sonarsource.com/products/sonarqube/
- **License**: Community Edition free (self-hosted); SonarCloud free for OSS; paid tiers
  LOC-based (gets expensive at scale).
- **TypeScript support**: Supported. 2025.1 LTA release added "Deeper SAST" — traces data paths
  through top 1,000 TypeScript libraries. Covers bugs, code smells, and security hotspots.
- **CI/CD**: Official plugins for Jenkins, Azure DevOps, GitHub Actions, GitLab CI. "Quality
  gates" block PRs on threshold violations.
- **Pre-commit**: Not designed for this; server-based analysis.
- **Monorepo/pnpm**: Multi-module projects supported via `sonar.modules` config. Not pnpm-aware
  natively; requires manual project key configuration per package.
- **AI features**: Limited. SonarQube AI Code Assurance flags AI-generated code. No LLM
  remediation by default.
- **Accuracy**: Lower vulnerability detection depth than Semgrep/CodeQL per AppSecSanta 2026
  analysis. Better for code quality + security combined.
- **Best for**: Enterprise governance, code quality tracking, compliance dashboards.

### Snyk Code
- **URL**: https://snyk.io/product/snyk-code/
- **License**: Free plan (100 tests/month); paid from ~$59/dev/mo
- **TypeScript support**: Strong. DeepCode AI engine trained on millions of OSS repos. Detects
  AI-generated vulnerability patterns. IDE plugin provides real-time feedback.
- **CI/CD**: Native integration with GitHub, GitLab, Bitbucket. CLI available. IDE plugins for
  VS Code, JetBrains.
- **Pre-commit**: Via CLI or IDE plugin.
- **Monorepo/pnpm**: pnpm workspace support is GA. Requires `package.json`, `pnpm-lock.yaml`,
  and `pnpm-workspace.yaml` at root. `--all-projects` flag auto-discovers all workspace packages.
- **AI features**: DeepCode AI uses symbolic AI + generative AI + ML trained on security research.
  "Accuracy without hallucinations" claim. Scores 92/100 for AI-generated code detection.
- **Accuracy**: 85% accuracy, 8% false positive rate. 45-second scan for 50K LOC.
- **Best for**: AI-generated code auditing, pnpm monorepo with explicit workspace support,
  real-time IDE feedback.

### Bearer CLI
- **URL**: https://www.bearer.com/bearer-cli (now part of Cycode)
- **License**: OSS CLI (MIT); Bearer Pro via Cycode (commercial)
- **TypeScript support**: Full support for JavaScript and TypeScript. Two scanner types: SAST
  and secrets. Data flow analysis prioritizes sensitive data exposure.
- **CI/CD**: Recommended for CI PR checking. CLI-first. GitHub Actions compatible.
- **Pre-commit**: Supported via CLI.
- **Monorepo/pnpm**: Not explicitly documented. CLI can be run from any directory.
- **AI features**: None explicitly documented.
- **Key differentiator**: Privacy-focused — prioritizes findings by sensitive data flow (PII,
  credentials). OWASP Top 10 + CWE Top 25 coverage. Good for finding data leakage patterns
  common in AI-generated code.
- **Best for**: Privacy compliance (GDPR), sensitive data exposure audits, small teams wanting
  a focused open-source tool.

### SAST Verdict for Vibe-Coded TypeScript Monorepos
| Tool | Accuracy | Speed | Monorepo | AI Features | Cost |
|------|----------|-------|----------|-------------|------|
| Semgrep | 82% / 12% FP | Fastest (~10s) | Manual path | Best (Assistant) | Free OSS |
| CodeQL | 88% / 5% FP | Slowest (~8min) | Advanced config | Copilot Autofix | ~$29/dev/mo |
| Snyk Code | 85% / 8% FP | Fast (~45s) | pnpm GA | DeepCode AI | Free tier |
| SonarQube | Unknown / low FP | Medium | Manual config | Limited | Free CE |
| Bearer | Unknown | Fast | Manual | None | Free OSS |

**Recommended stack**: Semgrep (speed + AI triage + vibe-coding focus) + CodeQL (accuracy +
semantic depth) + Snyk Code (pnpm monorepo native + AI-code detection).

---

## 2. SCA (Software Composition Analysis)

### Snyk Open Source
- **URL**: https://snyk.io/product/open-source-security-management/
- **License**: Free tier available; paid from ~$59/dev/mo
- **TypeScript/Node.js**: Full npm/pnpm/yarn support. Scans `package.json` and lock files.
- **CI/CD**: Native GitHub/GitLab integration. PR checks block on new vulnerabilities.
- **Pre-commit**: Via CLI.
- **Monorepo**: `--all-projects` flag auto-discovers all workspaces. pnpm workspace support GA
  (requires `pnpm-workspace.yaml` at root).
- **AI features**: AI-prioritized fix recommendations; automated PRs.
- **Key differentiator**: Largest proprietary vulnerability database (adds 200+ vulns/week beyond
  NVD). Fix recommendations with severity context.
- **vs npm audit**: Tighter SCM integration, more vulnerabilities found, automated PR fixes.
  npm audit only queries npm advisory database (subset of CVEs).

### Socket.dev
- **URL**: https://socket.dev
- **License**: Free tier; paid plans for organizations (10,000+ orgs as of Dec 2025)
- **TypeScript/Node.js**: npm, yarn, pnpm wrapper. Scans third-party code behavior.
- **CI/CD**: CLI wraps package managers; GitHub PR checks; CI/CD integration.
- **Pre-commit**: Socket CLI as drop-in package manager wrapper.
- **Monorepo**: pnpm workspace support; firewall mode intercepts installs across all packages.
- **AI features**: Static analysis of package behavior (not LLM). Tracks 70+ red-flag signals.
- **Key differentiator**: Supply chain focus — detects malicious packages BEFORE install.
  Analyzes: network access, filesystem access, shell execution, env variable access, code
  obfuscation, install scripts, maintainer ownership changes. npm registry now links to Socket
  analysis pages. Coana reachability analysis integration (every vuln will include reachability
  context by default — in progress).
- **Best for**: Supply chain attack prevention (typosquatting, dependency confusion, malicious
  packages), which is critical for AI-generated code that may hallucinate package names.

### npm audit
- **URL**: Built into npm
- **License**: Free
- **TypeScript/Node.js**: Native.
- **CI/CD**: `npm audit --audit-level=high` as a pipeline step. `pnpm audit` equivalent.
- **Monorepo**: `pnpm audit --recursive` for workspaces.
- **Key differentiator**: Zero setup, always available. Queries npm advisory database only.
  Lower coverage than Snyk. No fix automation.
- **Best for**: Baseline check; always run, but supplement with Snyk or Socket.

### Dependabot
- **URL**: https://github.com/dependabot
- **License**: Free (GitHub-native)
- **TypeScript/Node.js**: Full npm/pnpm/yarn support.
- **CI/CD**: GitHub-native. Automated PRs for dependency updates.
- **Monorepo**: pnpm workspace support added 2024. Each workspace package can be configured
  independently in `.github/dependabot.yml`.
- **AI features**: None, but GitHub Copilot can explain Dependabot alerts.
- **Best for**: Automated dependency updates with vulnerability context. Free for all GitHub repos.

### SCA Verdict
| Tool | Vuln Database | Supply Chain | Monorepo | Cost |
|------|--------------|--------------|----------|------|
| Snyk OSS | Largest (proprietary) | Good | pnpm GA | Free tier |
| Socket.dev | Behavior-based | Best | pnpm | Free tier |
| npm audit | npm advisory only | None | `--recursive` | Free |
| Dependabot | GitHub advisory | None | pnpm | Free |

**Recommended stack**: Socket.dev (supply chain, pre-install blocking) + Snyk (vulnerability depth
+ auto-fix PRs) + Dependabot (free automated update PRs). npm audit as always-on baseline.

---

## 3. DAST (Dynamic Application Security Testing)

### OWASP ZAP (Zed Attack Proxy)
- **URL**: https://www.zaproxy.org
- **License**: Free, open-source (Apache 2.0)
- **Node.js/Next.js**: JavaScript add-ons improve coverage. Can handle SPAs. LIMITATION: standard
  ZAP scans fail to detect certain Next.js-specific vulnerabilities (CVE-2025-29927,
  CVE-2025-66478) due to "protocol ignorance and context blindness" around React Server
  Components and Server Actions.
- **CI/CD**: Docker image (`ghcr.io/zaproxy/zaproxy`), GitHub Actions, CLI. Full automation mode.
- **Pre-commit**: Not applicable to DAST.
- **API testing**: Swagger/OpenAPI, Postman, manual API testing.
- **Authenticated scanning**: Supported.
- **Best for**: Budget-conscious teams, baseline web app scanning, API scanning.

### Burp Suite
- **URL**: https://portswigger.net/burp
- **License**: Community Edition free (limited); Professional ~$449/user/yr; Enterprise (quote)
- **Node.js/Next.js**: No specific Next.js support documented.
- **CI/CD**: Burp Suite Enterprise has CI/CD integration. Pro requires manual setup.
- **Best for**: Manual penetration testing, security researchers. Not ideal for automated CI/CD.

### Nuclei
- **URL**: https://projectdiscovery.io/nuclei
- **License**: Free, open-source (MIT)
- **Node.js/Next.js**: STRONG — community maintains Next.js-specific CVE templates including:
  - CVE-2025-29927 (middleware authentication bypass)
  - CVE-2025-55182 (React Server Components RCE)
  - CVE-2025-66478 (Next.js App Router RCE, thenable prototype pollution)
  - nextjs-middleware-cache misconfiguration template
  Templates at: github.com/projectdiscovery/nuclei-templates
- **CI/CD**: CLI, Docker. Fast template-based scanning. Exit codes for gating.
- **Best for**: CVE regression testing, Next.js-specific vulnerability detection, fast targeted
  scans. Critical for Next.js deployments.

### StackHawk
- **URL**: https://www.stackhawk.com
- **License**: Free developer tier; paid for teams
- **Node.js/Next.js**: API-first. OpenAPI, GraphQL support. Good for Next.js API routes.
- **CI/CD**: YAML-driven, GitHub Actions-native. Most CI/CD-friendly paid DAST tool.
- **Best for**: DevSecOps pipelines, API testing, teams wanting DAST-as-code.

### DAST Verdict
**Recommended stack**:
- Nuclei: Run on every deployment for Next.js CVE regression (free, fast, targeted)
- OWASP ZAP: Weekly/monthly full scans (free, comprehensive)
- StackHawk: If budget allows, for continuous API testing in CI/CD

**Critical note**: No DAST tool currently catches all Next.js App Router + Server Actions
vulnerabilities automatically. Manual review of server actions, middleware, and RSC boundaries
remains essential.

---

## 4. Secret Scanning

### TruffleHog
- **URL**: https://github.com/trufflesecurity/trufflehog
- **License**: Free, open-source (AGPL)
- **Detection approach**: 800+ detectors. Verifies whether discovered credentials are still
  active by authenticating against target services. Goes beyond code: S3, Docker images, Slack,
  Jenkins, Elasticsearch.
- **CI/CD**: CLI, GitHub Actions, `--fail` flag (exit code 183). JSON output.
- **Pre-commit**: Supported but slower than Gitleaks due to API verification calls.
- **False positives**: Lower than Gitleaks — inactive credentials filtered automatically.
- **Best for**: CI/CD deep scans, Docker image scanning, credential verification.

### Gitleaks
- **URL**: https://github.com/gitleaks/gitleaks
- **License**: Free, open-source (MIT)
- **Detection approach**: 150+ regex patterns. Fast, no API calls. Regex-based only.
- **CI/CD**: SARIF output integrates directly with GitHub Advanced Security. GitHub Actions.
- **Pre-commit**: Best choice for pre-commit hooks — millisecond response, zero network overhead.
- **False positives**: Higher than TruffleHog. Managed via `.gitleaks.toml` allowlists.
- **Best for**: Pre-commit hooks (speed), GitHub Advanced Security integration.

### detect-secrets (Yelp)
- **URL**: https://github.com/Yelp/detect-secrets
- **License**: Free, open-source (Apache 2.0)
- **Detection approach**: Plugin architecture with baseline file. Curated approach focuses on
  preventing NEW secret exposures rather than historical issues. Low false positive rate through
  careful tuning.
- **CI/CD**: Supported. Baseline methodology excludes known findings.
- **Pre-commit**: Supported and well-suited (fast, incremental).
- **Best for**: Teams that want lowest false positive rate with incremental baseline management.

### GitGuardian
- **URL**: https://www.gitguardian.com
- **License**: Free for OSS; paid for private repos
- **Detection approach**: Advanced secret classification, deep Git history analysis. Commercial
  with higher detection coverage.
- **CI/CD**: Full CI/CD integration, PR blocking.
- **Pre-commit**: Supported via `ggshield`.
- **Best for**: Enterprise secret management, historical Git audit.

### Secret Scanning Verdict
**Recommended stack** (layered):
1. Gitleaks as pre-commit hook (blocks secrets before commit, zero latency)
2. TruffleHog in CI/CD (verifies active credentials, scans Docker images)
3. detect-secrets for baseline management (low false positive rate)

**For vibe-coded codebases**: AI-generated code commonly includes placeholder API keys and
hardcoded credentials. Running all three in the pipeline is strongly recommended.

---

## 5. Infrastructure as Code Scanning

### Trivy
- **URL**: https://trivy.dev (Aqua Security)
- **License**: Free, open-source (Apache 2.0)
- **Scope**: IaC + container images + dependency vulnerabilities + secrets — single binary.
  tfsec development is now directed into Trivy; tfsec is in maintenance mode.
- **Node.js/Docker**: Scans `package-lock.json` for dependency vulnerabilities inside container
  images. Full Docker/OCI image scanning. Kubernetes cluster scanning.
- **CI/CD**: Official GitHub Action, Docker image, SARIF output.
- **Monorepo**: CLI can scan any path; run from root to cover all Dockerfiles.
- **IaC formats**: Terraform, CloudFormation, Azure ARM/Bicep, Kubernetes manifests,
  Dockerfile, Helm.
- **SBOM**: Generates CycloneDX and SPDX SBOMs for supply chain compliance.
- **Best for**: One-tool solution covering containers + IaC + dependencies.

### Checkov
- **URL**: https://www.checkov.io (Bridgecrew/Palo Alto)
- **License**: Free, open-source (Apache 2.0)
- **Scope**: IaC only (no container image scanning). 1,000+ built-in policies including 800
  graph-based cross-resource checks — validates relationships between resources.
- **Node.js/Docker**: Scans Dockerfiles for misconfigurations. Does NOT scan running containers.
- **CI/CD**: Official GitHub Action, Docker image, SARIF output.
- **Monorepo**: CLI recursive scanning from root.
- **IaC formats**: Terraform, CloudFormation, Azure ARM/Bicep, Kubernetes, Kustomize,
  OpenTofu, Serverless Framework, AWS CDK, Ansible.
- **Compliance**: Maps to CIS, SOC 2, HIPAA, PCI DSS (broader than Trivy's CIS-only).
- **Best for**: Compliance reporting, deep IaC policy coverage, graph-based relationship checks.

### For a pnpm/Next.js monorepo specifically:
What to scan:
- Dockerfiles in each app (`apps/web/Dockerfile`)
- docker-compose files
- `.env.example` files (verify no real secrets)
- GitHub Actions workflow files (for secret exposure, permission escalation)
- Any cloud config files (vercel.json, fly.toml, railway.yaml)

**Recommended stack**: Trivy (primary — Docker + deps + secrets in one pass) + Checkov (if
compliance frameworks matter).

---

## 6. Next.js-Specific Security Considerations

### Next.js-Specific CVEs (2025)
Three critical CVEs affecting Next.js were published in 2025 — all have Nuclei templates:
- **CVE-2025-29927**: Middleware authentication bypass via `x-middleware-subrequest` header
- **CVE-2025-55182**: React Server Components RCE
- **CVE-2025-66478**: App Router RCE via "thenable" prototype pollution in Server Actions

### Automated Tool Recommendations (Next.js)
Per arcjet.com security checklist and Next.js official data security guide:

1. Use `server-only` package to prevent server modules from being imported in client components
2. Semgrep custom rules for Next.js Data Access Layer isolation patterns
3. ESLint with `eslint-plugin-security` for synchronous code patterns
4. Socket.dev for dependency assessment on install
5. Nuclei for CVE regression on deployment
6. Zod/Valibot for runtime validation (TypeScript types alone are not sufficient)

### OWASP Node.js Cheat Sheet Recommendations
OWASP recommends these tools for Node.js security (from official cheat sheet):
- `npm audit` / `pnpm audit` — dependency scanning (built-in)
- `Retire.js` — JavaScript library vulnerability detection
- OWASP Dependency-Check — broader than npm audit
- ESLint — SAST for JavaScript patterns
- `vuln-regex-detector` — ReDoS pattern detection
- `helmet` — HTTP security headers middleware

---

## Key Takeaways

### For a "vibe coded" TypeScript monorepo audit, priority order:

1. **Semgrep** — run immediately, fastest SAST, best AI triage, vibe-coding focus. Free OSS.
2. **Snyk Code + Snyk OSS** — pnpm workspace native, AI-code detection, vuln database depth.
3. **TruffleHog** — verify no active credentials were committed in AI-generated code.
4. **Gitleaks** — add as pre-commit hook to prevent new secrets entering repo.
5. **Socket.dev** — audit existing dependencies for supply chain risks.
6. **Nuclei** — run Next.js CVE templates against staging environment.
7. **Trivy** — scan Docker images and any IaC files.
8. **CodeQL** — one-time deep semantic audit for lowest false-positive findings.

### Monorepo-Specific Notes (pnpm + Turborepo)
- Snyk: explicit pnpm workspace support (`--all-projects`)
- Semgrep: point at repo root; fast enough to scan all packages
- CodeQL: advanced setup with path scoping per package
- Dependabot: configure per-package in `.github/dependabot.yml`
- Trivy: scan from repo root with `--scanners vuln,secret,config`

### AI/LLM Features Summary (2026)
- Semgrep Assistant: AI auto-triage (97% agreement rate), remediation guidance
- Snyk Code: DeepCode AI — symbolic + generative AI, hallucination-resistant
- CodeQL: GitHub Copilot Autofix for fix suggestions
- Socket.dev: ML-based behavioral package analysis (not LLM)
- Gitleaks/TruffleHog: No AI features (rule-based)

---

## Sources
- https://semgrep.dev/blog/2025/beyond-benchmarks-how-semgrep-redefines-javascript-security/
- https://semgrep.dev/blog/2025/replit-and-semgrep-secure-vibe-coding/
- https://semgrep.dev/docs/semgrep-assistant/overview
- https://sanj.dev/post/ai-code-security-tools-comparison
- https://www.aikido.dev/blog/sonarqube-vs-semgrep
- https://konvu.com/compare/semgrep-vs-codeql
- https://appsecsanta.com/sast-tools/gitleaks-vs-trufflehog
- https://www.jit.io/resources/appsec-tools/trufflehog-vs-gitleaks-a-detailed-comparison-of-secret-scanning-tools
- https://www.aikido.dev/blog/top-secret-scanning-tools
- https://appsecsanta.com/checkov-vs-trivy
- https://www.aikido.dev/blog/top-dynamic-application-security-testing-dast-tools
- https://projectdiscovery.io/nuclei
- https://github.com/projectdiscovery/nuclei-templates
- https://socket.dev
- https://docs.snyk.io/supported-languages/supported-languages-list/javascript
- https://updates.snyk.io/you-can-now-use-pnpm-across-snyk/
- https://owasp.org/www-community/Source_Code_Analysis_Tools
- https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html
- https://blog.arcjet.com/next-js-security-checklist/
- https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning
- https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/
- https://www.bearer.com/bearer-cli
- https://docs.bearer.com/explanations/scanners/
- https://trivy.dev
- https://github.com/bridgecrewio/checkov
- https://github.com/trufflesecurity/trufflehog
- https://github.com/gitleaks/gitleaks
