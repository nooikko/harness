# Research: E2E Testing with GitHub Actions — Best Practices (Early 2026)

Date: 2026-03-19

## Summary

Comprehensive research into Playwright and Cypress GitHub Actions integration, PR test result surfacing, cost profiles, Docker/database strategies, and flaky test handling. All findings sourced from official documentation.

## Prior Research

No prior AI_RESEARCH files on this topic.

---

## Current Findings

### 1. Playwright + GitHub Actions

**Official First-Party Setup**
Playwright ships with automated GitHub Actions scaffolding. Running `npm init playwright@latest` or using the VS Code Playwright extension generates a `.github/workflows/playwright.yml` file that triggers on push/PR to main/master.

Standard workflow steps:
1. Checkout repo
2. Install Node.js (LTS)
3. `npm ci`
4. `npx playwright install --with-deps` — installs browser binaries and OS dependencies
5. `npx playwright test`
6. Upload HTML report as artifact (30-day retention)

Source: https://playwright.dev/docs/ci-intro

**Sharding (Parallelization)**
Playwright has first-class sharding support via `--shard=x/y` flag. The recommended GitHub Actions pattern uses a matrix strategy:

```yaml
strategy:
  matrix:
    shardIndex: [1, 2, 3, 4]
    shardTotal: [4]

steps:
  - run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
```

Shard balancing behavior:
- With `fullyParallel: true`: distributes at individual test level (even load)
- Without `fullyParallel`: distributes at file level (can be uneven if files vary in size)

The documentation explicitly recommends `fullyParallel: true` for balanced shard execution.

Source: https://playwright.dev/docs/test-sharding

**Blob Reporter for Sharded Runs**
When sharding, use the blob reporter to collect results per shard, then merge into a single HTML report:

```typescript
// playwright.config.ts
reporter: process.env.CI ? 'blob' : 'html'
```

After all shards complete, a separate merge job runs:
```
npx playwright merge-reports --reporter html ./all-blob-reports
```

The merge job uses `needs: [playwright-tests]` to depend on all shards completing.

Source: https://playwright.dev/docs/test-sharding

**Artifact Handling**
- HTML reports upload as artifacts with 30-day retention (configurable)
- Blob reports contain test results, attachments, traces, and screenshots
- The documentation warns: "Treat these files just as carefully as you treat that sensitive data" — traces may contain credentials or tokens
- PR artifacts from forked repos cannot upload (no secret access)
- For public web-accessible reports, Playwright recommends Azure Blob Storage with static website hosting

Source: https://playwright.dev/docs/ci-intro

**Workers in CI**
The documentation recommends setting `workers: 1` in CI "to prioritize stability and reproducibility." Parallel workers can be enabled on powerful self-hosted runners.

Source: https://playwright.dev/docs/ci

**Deployment-Triggered Tests**
Playwright supports triggering tests after GitHub Deployments succeed — useful for Vercel, Netlify, etc. The `--only-changed` flag runs only affected test files first, reducing CI time on PRs.

Source: https://playwright.dev/docs/ci

**Docker Container Support**
Tests run inside containers via `jobs.<job_id>.container`. The documentation notes this is "useful to not pollute the host environment with dependencies and to have a consistent environment for e.g. screenshots/visual regression testing across different operating systems."

Source: https://playwright.dev/docs/ci

---

### 2. Cypress + GitHub Actions

**Official GitHub Action**
Cypress provides an official GitHub Action (maintained by Cypress + community). The documentation recommends pinning to the latest major version: `cypress-io/github-action@v7`.

The action handles:
- Dependency installation (npm, yarn, or pnpm) with built-in caching
- Building the app
- Starting the web server
- Running tests (Electron by default)

Source: https://docs.cypress.io/app/continuous-integration/github-actions

**Browser Selection**
GitHub-hosted Ubuntu/Windows runners include Chrome, Firefox, and Edge pre-installed. macOS includes Safari. Specify with the `browser` parameter. The documentation recommends Cypress Docker images (`cypress/browsers`) for parallel jobs to avoid browser version drift from GitHub runner image updates.

Source: https://docs.cypress.io/app/continuous-integration/github-actions

**Parallelization with Cypress Cloud**
Parallel execution requires:
1. `record: true` — recording to Cypress Cloud
2. `parallel: true` — enable parallelization
3. Matrix strategy defining container count: `containers: [1, 2, 3, 4, 5]`
4. `group` parameter to label runs

Cypress Cloud provides intelligent load balancing across parallel machines (not naive static sharding).

For accurate build identification during re-runs, pass `GITHUB_TOKEN`. For PR comment integration, set `COMMIT_INFO_MESSAGE` and `COMMIT_INFO_SHA` environment variables.

Source: https://docs.cypress.io/app/continuous-integration/github-actions

**Multi-Job Workflow Pattern**
For workflows with separate install and test jobs:
1. Install job builds app and caches dependencies via `upload-artifact`
2. Worker jobs download artifacts via `download-artifact` before running tests

Source: https://docs.cypress.io/app/continuous-integration/github-actions

**Reporters**
- Built-in: `spec` (default, STDOUT), `junit`, `teamcity`
- Mocha-compatible: any Mocha reporter works with Cypress
- JUnit XML: configurable output path with `[hash]` placeholder for parallel spec files
- No built-in GitHub-specific annotation output (GitHub integration is via Cypress Cloud, not reporters)

Source: https://docs.cypress.io/app/tooling/reporters

---

### 3. GitHub-Specific E2E Integrations

**Check Runs vs Commit Statuses**
GitHub Actions generates Check Runs (not commit statuses). Check Runs provide:
- Line-level annotations on the Files tab of PRs
- Detailed build output in the Checks tab
- Re-run capability directly from the PR

The Checks tab displays all test results; developers can rerun failed checks from the PR interface.

Source: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks

**Required Status Checks**
Status checks can be required before merging to protected branches. Important caveat: a skipped job reports as "Success" and does not block merging even if required. This is relevant for E2E tests that might be skipped under certain conditions.

Source: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks

**Deployment Environments**
GitHub Environments (`production`, `staging`, `development`) support:
- Required approvals before deployment
- Branch restrictions
- Custom deployment protection rules powered by GitHub Apps
- Automated approvals based on external conditions (e.g., E2E test pass from a third-party service)

E2E tests can be gated on deployment environments — a common pattern is: deploy to staging → run E2E → gate production deploy on E2E status check.

Source: https://docs.github.com/en/actions/use-cases-and-examples/deploying/deploying-with-github-actions

**Workflow Annotations**
GitHub Actions supports inline annotations via workflow commands:
```
echo "::error file={name},line={line},endLine={endLine},title={title}::{message}"
echo "::warning file={name},line={line},title={title}::{message}"
echo "::notice file={name},line={line},title={title}::{message}"
```

These appear as inline comments pinned to specific code lines in the Files tab of PRs. Test frameworks can emit these to surface failures directly in PR diffs.

Source: https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions#setting-an-error-message

---

### 4. Test Result Reporting in GitHub PRs

**Playwright — GitHub Reporter**
The built-in `github` reporter generates automatic failure annotations in GitHub Actions:

```typescript
// playwright.config.ts
reporter: process.env.CI ? 'github' : 'list'
```

**Critical caveat**: The official documentation explicitly warns: "using this annotation type with matrix strategies is not recommended" because "stack trace failures will multiply and obscure the GitHub file view."

Alternative for sharded/matrix runs: use blob reporter per shard, merge to HTML, upload as artifact.

Source: https://playwright.dev/docs/test-reporters

**Cypress — Cypress Cloud GitHub App**
Cypress Cloud GitHub integration provides:
- Commit status checks (one per run group OR one per spec file, configurable)
- Automatic PR comments with: run context, test statistics (passed/failed/skipped/flaky/pending), failed/flaky test summaries, links to Cypress Cloud for debugging
- Flaky test counts in PR comments with a "Flakiness" section

Requires: Cypress Cloud account (paid), GitHub App installation by a GitHub admin, project configured to record.

Source: https://docs.cypress.io/cloud/integrations/source-control/github

**Playwright vs Cypress for PR Reporting**
- Playwright: built-in `github` reporter works without external services but has matrix limitations. Annotations appear inline in PRs. No native PR comment capability.
- Cypress: richer PR experience (comments with full stats + flaky counts) but requires Cypress Cloud (paid service). The GitHub integration is significantly more polished.

---

### 5. Cost Considerations

**GitHub Actions Minute Rates (as of early 2026)**

| Runner Type | Rate |
|-------------|------|
| Linux 1-core (x64) | $0.002/min |
| Linux 2-core (x64) | $0.006/min |
| Linux 2-core (arm64) | $0.005/min |
| Windows 2-core (x64) | $0.010/min |
| macOS 3-4 core (M1/Intel) | $0.062/min |

macOS is ~10x more expensive than Linux. Windows is ~1.7x more expensive.

**Free Tier Limits**

| Plan | Minutes/Month | Artifact Storage | Cache |
|------|---------------|-----------------|-------|
| GitHub Free | 2,000 | 500 MB | 10 GB |
| GitHub Pro | 3,000 | 1 GB | 10 GB |
| GitHub Team | 3,000 | 2 GB | 10 GB |
| Enterprise Cloud | 50,000 | 50 GB | 10 GB |

Artifact storage: $0.07/GiB/month beyond included. Public repositories get free minutes.

Source: https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions

**Cost Optimization Strategies (inferred from official docs)**
- Run E2E only on Linux — never macOS unless Safari testing is required
- Use sharding to reduce wall-clock time (same total minutes, faster feedback)
- Use `--only-changed` (Playwright) to skip unaffected tests on PRs
- Cache browser binaries (Playwright notes cache restore times are comparable to install, so benefit is marginal)
- Avoid uploading videos/traces on success — only on failure to reduce storage costs
- Self-hosted runners eliminate per-minute charges entirely

**Framework Speed Comparison**
No official benchmarks found comparing Playwright vs Cypress execution time on GitHub Actions. Playwright uses a dedicated browser protocol (CDP/DevTools) without a proxy, which is generally considered faster than Cypress's in-browser JavaScript execution model for large test suites. Playwright's `--only-changed` flag provides a meaningful CI cost reduction with no Cypress equivalent.

---

### 6. Docker/Container Strategies for E2E with Databases

**PostgreSQL Service Container (Official Pattern)**

```yaml
services:
  postgres:
    image: postgres
    env:
      POSTGRES_PASSWORD: postgres
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432  # required when job runs on runner (not in container)
```

Two deployment approaches:
1. **Runner-based jobs**: use `ports: - 5432:5432`, access via `localhost:5432`
2. **Container-based jobs**: use service label as hostname directly (no port mapping needed), access via `postgres:5432`

**Critical requirement**: Service containers only work on Linux. Must use Ubuntu runners for GitHub-hosted infrastructure.

Connection from test code:
```javascript
const client = new Client({
  host: process.env.POSTGRES_HOST,  // 'localhost' or 'postgres'
  port: process.env.POSTGRES_PORT,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres'
});
```

Source: https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers

**Service Container Networking**
- Container jobs: all containers on user-defined bridge network, all ports accessible by service label hostname
- Runner jobs: must explicitly map ports; access via localhost
- Health checks ensure service is ready before tests run (the `options` block with `--health-cmd`)

Source: https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/about-service-containers

**Playwright Global Setup for Database**
Playwright recommends using Project Dependencies for database setup (over `globalSetup`):

```typescript
// playwright.config.ts
{
  projects: [
    { name: 'setup db', testMatch: /global\.setup\.ts/ },
    { name: 'e2e tests', dependencies: ['setup db'] }
  ]
}
```

Advantages over `globalSetup`:
- Setup code appears in HTML report and produces traces
- Fixture support in setup files
- Easier to debug initialization failures

Pattern for sharing state from setup to tests: `process.env.FOO = 'some data'` in setup; tests read from `process.env`.

Source: https://playwright.dev/docs/test-global-setup-teardown

**Full Pattern for E2E with Postgres in GitHub Actions**
```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx prisma migrate deploy  # or db:push for test DBs
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      - run: npx playwright test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
```

---

### 7. Flaky Test Handling

**Playwright Retry Configuration**
```typescript
// playwright.config.ts
retries: process.env.CI ? 2 : 0  // common pattern
```

Or per test group: `test.describe.configure({ retries: 2 })`

On retry, the worker process is fully discarded and a new browser context starts — this is a clean retry, not a same-process retry.

Test outcome classification:
- `passed` — succeeded on first attempt
- `flaky` — failed initially, passed on retry
- `failed` — failed on all attempts

The `flaky` classification is surfaced in the HTML report and Playwright's own output. The `github` reporter annotates flaky tests separately from hard failures.

Runtime detection: `testInfo.retry` property allows tests to perform cleanup on retry.

Source: https://playwright.dev/docs/test-retries

**Cypress Flaky Test Management (Cypress Cloud)**
Cypress Cloud detects flaky tests via retry patterns. A test is flaky when it passes and fails across multiple retry attempts without code changes.

Features:
- Flake Rate vs Failure Rate tracked separately
- Analytics dashboard (Team plan): temporal flakiness plot, severity grouping, historical logs
- PR comments display flaky count with "Flakiness" section
- GitHub, Slack, GitLab, Microsoft Teams alerting integrations
- As of Cypress 13.4.0: experimental flake detection with enhanced pass/fail control for retried tests

Quarantine: The official documentation does not describe a quarantine feature as of early 2026.

Source: https://docs.cypress.io/cloud/features/flaky-test-management

**Playwright vs Cypress for Flaky Test Management**
- Playwright: built-in `flaky` classification in reports, retries configurable per test/suite/globally. No external service required. No quarantine feature.
- Cypress Cloud: richer analytics dashboard, alerting integrations, PR comment flaky counts. Requires paid Cypress Cloud subscription.

**GitHub-Native Flaky Test Solutions**
No first-party GitHub feature for flaky test quarantine was found. The GitHub Actions re-run model (re-run failed jobs) is manual. Community solutions like `dorny/test-reporter` (JUnit XML → GitHub Check annotations) can surface failure patterns but do not provide quarantine.

---

## Key Takeaways

1. **Playwright is the lower-friction choice** for GitHub Actions — it generates workflow YAML automatically, has no external service dependency for PR annotations, and ships with sharding + blob reporter for distributed runs.

2. **Cypress Cloud is required** for Cypress's best GitHub integration (PR comments, flaky detection analytics). Without Cypress Cloud, Cypress's GitHub integration is limited to JUnit XML artifacts.

3. **The `github` reporter in Playwright has a matrix incompatibility** — do not use it with sharded/matrix runs. Use blob reporter + merge job instead.

4. **Linux runners only** for service containers (Postgres). This is an official hard requirement.

5. **macOS runners are 10x more expensive** than Linux. Run E2E on Linux unless Safari testing is required.

6. **Sharding reduces wall-clock time** but does not reduce total minute consumption. Use `--only-changed` (Playwright) for actual minute reduction on PRs.

7. **PostgreSQL health checks are mandatory** — the `--health-cmd pg_isready` pattern prevents test runs starting before Postgres is ready.

8. **Playwright Project Dependencies** are preferred over `globalSetup` for database initialization because they produce traces and appear in the HTML report.

---

## Gaps Identified

- No official benchmark data comparing Playwright vs Cypress execution speed on GitHub Actions
- Cypress quarantine feature status unclear — not documented in official flaky test management docs
- GitHub Actions larger runner pricing (4-core, 8-core) not retrieved — may be relevant for faster E2E runs
- GitHub's own test summary feature (via `$GITHUB_STEP_SUMMARY`) not researched — this allows posting markdown summaries to the Actions run page without external services

---

## Sources

- https://playwright.dev/docs/ci-intro — Playwright CI Introduction (GitHub Actions setup)
- https://playwright.dev/docs/ci — Playwright CI Configuration
- https://playwright.dev/docs/test-sharding — Playwright Sharding
- https://playwright.dev/docs/test-reporters — Playwright Reporters (github, blob, html, junit)
- https://playwright.dev/docs/test-retries — Playwright Retry Mechanism
- https://playwright.dev/docs/test-global-setup-teardown — Playwright Global Setup
- https://docs.cypress.io/app/continuous-integration/github-actions — Cypress GitHub Actions
- https://docs.cypress.io/app/tooling/reporters — Cypress Reporters
- https://docs.cypress.io/cloud/integrations/source-control/github — Cypress Cloud GitHub Integration
- https://docs.cypress.io/cloud/features/flaky-test-management — Cypress Cloud Flaky Test Management
- https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers — PostgreSQL Service Containers
- https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/about-service-containers — Service Container Overview
- https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/using-a-matrix-for-your-jobs — Matrix Strategies
- https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow — Artifact Storage
- https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks — Status Checks
- https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions#setting-an-error-message — Workflow Annotations
- https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions — GitHub Actions Billing
- https://docs.github.com/en/actions/use-cases-and-examples/deploying/deploying-with-github-actions — Deployment Environments
