# Harness Project Instincts Index

## Workflow & Process
- [read-before-edit](read-before-edit.md) — Read file before editing to understand context
- [plan-section-incremental-editing](plan-section-incremental-editing.md) — Edit plan documents section-by-section with inline verification
- [lint-commit-verify-push-sequence](lint-commit-verify-push-sequence.md) — Follow sequential workflow: lint → commit → sherif → push
- [precommit-git-status-monitoring](precommit-git-status-monitoring.md) — Check git status multiple times during pre-commit workflow to monitor file state transitions
- [hook-validation-investigation-workflow](hook-validation-investigation-workflow.md) — Investigate hook validation failures via bash before retrying
- [harness-skill-documentation-first](harness-skill-documentation-first.md) — Document skill functionality before implementation
- [staged-feature-implementation-edits](staged-feature-implementation-edits.md) — Implement features in staged, testable chunks
- [test-first-interface-discovery](test-first-interface-discovery.md) — Write tests first to discover interfaces
- [pre-completion-verification](pre-completion-verification.md) — Verify work before declaring completion
- [post-merge-state-restoration](post-merge-state-restoration.md) — Restore editor state after merges
- [cross-iteration-context-persistence](cross-iteration-context-persistence.md) — Maintain context across iteration loops
- [async-research-investigation-pattern](async-research-investigation-pattern.md) — Launch async agents to research complex technical decisions
- [empty-tool-output-followed-by-content](empty-tool-output-followed-by-content.md) — Tool logging pattern: empty output followed by actual content indicates retry or buffering behavior
- [monorepo-package-research-prelude](monorepo-package-research-prelude.md) — Research monorepo package structure before implementation decisions
- [mcp-tool-search-before-use](mcp-tool-search-before-use.md) — Use ToolSearch to discover MCP tools before invoking them
- [systematic-package-exploration-bash-grep-read](systematic-package-exploration-bash-grep-read.md) — Discover files with Bash, filter with Grep, then read implementation files in sequence
- [webfetch-official-docs-pattern](webfetch-official-docs-pattern.md) — Fetch official documentation directly for technical research
- [ai-research-timestamped-documentation](ai-research-timestamped-documentation.md) — Name research docs with YYYY-MM-DD prefix in AI_RESEARCH/ directory
- [agent-sdk-type-investigation](agent-sdk-type-investigation.md) — Research Agent SDK types and session management via official reference
- [type-driven-implementation-flow](type-driven-implementation-flow.md) — Define types first, then implement and verify alignment
- [reference-file-inspection-before-implementation](reference-file-inspection-before-implementation.md) — Read existing similar implementations before writing new server actions

## Testing & Integration Tests
- [test-alongside-implementation](test-alongside-implementation.md) — Create test files in colocated `__tests__` directory alongside implementation
- [test-discovery-in-contract-helpers](test-discovery-in-contract-helpers.md) — Discover test patterns in plugin contract helpers via Glob
- [plugin-integration-test-structure-exploration](plugin-integration-test-structure-exploration.md) — Explore plugin integration test patterns
- [integration-test-orchestrator-factory](integration-test-orchestrator-factory.md) — Use factory pattern for test orchestrator setup
- [integration-test-database-reset](integration-test-database-reset.md) — Reset database state between tests
- [integration-test-documentation-inventory](integration-test-documentation-inventory.md) — Maintain test inventory documentation with coordinated updates
- [vitest-mock-setup-pattern](vitest-mock-setup-pattern.md) — Setup vitest mocks consistently
- [comprehensive-edge-case-test-expansion](comprehensive-edge-case-test-expansion.md) — Add edge case tests for null values, errors, and boundary conditions
- [test-coverage-expansion-via-gap-analysis](test-coverage-expansion-via-gap-analysis.md) — Systematically expand tests below 80% coverage by identifying gaps and adding focused tests with vi.fn()/vi.stubEnv() mocking
- [server-action-database-mock-testing](server-action-database-mock-testing.md) — Test server actions with database and cache mocking
- [test-failure-driven-mock-completion](test-failure-driven-mock-completion.md) — Add missing mock methods when tests fail
- [react-component-test-dom-stubs](react-component-test-dom-stubs.md) — Stub DOM APIs and mock component libraries before importing tested component
- [plugin-context-mock-factory](plugin-context-mock-factory.md) — Use mock factory with overrides for PluginContext testing
- [plugin-crud-test-scope-verification](plugin-crud-test-scope-verification.md) — Verify agent scope isolation in CRUD handler tests
- [prop-type-test-fixture-sync](prop-type-test-fixture-sync.md) — Keep test fixtures in sync with prop types
- [component-prop-refactoring-test-sync](component-prop-refactoring-test-sync.md) — Update tests when refactoring props
- [iterative-test-consistency-verification](iterative-test-consistency-verification.md) — Run tests multiple times to verify consistency
- [test-retry-failure-investigation](test-retry-failure-investigation.md) — Run tests multiple times to investigate failure patterns after code changes
- [coverage-gate-package-configuration-iteration](coverage-gate-package-configuration-iteration.md) — Iteratively update coverage gate config for new packages
- [hook-error-plugin-name-parameter](hook-error-plugin-name-parameter.md) — Test both "with plugin name" and "without plugin name" error message formatting
- [hook-error-test-message-format-mismatch](hook-error-test-message-format-mismatch.md) — Investigate hook error test failures when message format changes
- [cascading-test-failure-investigation](cascading-test-failure-investigation.md) — When fixing one test reveals failures in dependent test suites
- [health-check-interface-test-fixture-updates](health-check-interface-test-fixture-updates.md) — Update all test fixtures when required properties are added to HealthCheckOptions or HealthStatus
- [test-expectation-matcher-updates](test-expectation-matcher-updates.md) — Use matchers for less important parameters when signatures change
- [test-tool-result-type-handling](test-tool-result-type-handling.md) — Handle tool handler results that can be string or object with .text property in tests
- [test-driven-error-iteration-cycle](test-driven-error-iteration-cycle.md) — Use test failures to guide iterative debugging: run → fail → edit → verify

## Plugin Architecture
- [plugin-entry-then-helpers-exploration](plugin-entry-then-helpers-exploration.md) — Explore plugins by reading entry file then helpers
- [plugin-helper-ecosystem-review](plugin-helper-ecosystem-review.md) — Review plugin helpers before writing new ones
- [plugin-module-level-lifecycle-state](plugin-module-level-lifecycle-state.md) — Use module-level state for plugin lifecycle
- [plugin-settings-reload-hook](plugin-settings-reload-hook.md) — Implement settings reload via onSettingsChange hook
- [plugin-crud-agent-scope-isolation](plugin-crud-agent-scope-isolation.md) — Enforce multi-tenant isolation in CRUD handlers via agent scope
- [multi-plugin-integration-test-gap](multi-plugin-integration-test-gap.md) — Identify gaps in multi-plugin test coverage
- [multi-plugin-package-inventory](multi-plugin-package-inventory.md) — Audit plugin ecosystem by reading all package.json files
- [fire-and-forget-plugin-background-tasks](fire-and-forget-plugin-background-tasks.md) — Delegate background work without blocking
- [unlogged-promise-catch-blocks](unlogged-promise-catch-blocks.md) — Log errors in .catch() blocks; never silently swallow
- [plugin-vitest-minimal-config](plugin-vitest-minimal-config.md) — Use minimal vitest config for plugins
- [plugin-api-endpoint-parametrization](plugin-api-endpoint-parametrization.md) — Use configurable orchestratorUrl for plugin API endpoints instead of hardcoding

## Harness Project Structure
- [harness-structure-orientation](harness-structure-orientation.md) — Understand monorepo structure and conventions
- [harness-taskmaster-state-check](harness-taskmaster-state-check.md) — Check orchestrator/task state before changes

## Exploration & Discovery
- [discovery-driven-exploration](discovery-driven-exploration.md) — Explore codebase before committing to approach
- [parallel-agent-layer-exploration](parallel-agent-layer-exploration.md) — Explore agent layers in parallel
- [crud-ui-paired-exploration](crud-ui-paired-exploration.md) — Explore CRUD UI and model together
- [multi-layer-framework-review](multi-layer-framework-review.md) — Review all framework layers before implementation
- [bash-search-relationship-mapping](bash-search-relationship-mapping.md) — Use bash to map code relationships
- [prompt-assembly-pipeline-exploration](prompt-assembly-pipeline-exploration.md) — Explore prompt assembly layers sequentially

## Code Patterns & Refactoring
- [server-action-validation-revalidate](server-action-validation-revalidate.md) — Validate and revalidate in server actions
- [sequential-server-action-crud-creation](sequential-server-action-crud-creation.md) — Create server actions in CRUD sequence for feature implementation
- [optional-parameter-scope-boundaries](optional-parameter-scope-boundaries.md) — Respect optional parameter boundaries
- [plugin-handler-type-safe-input-validation](plugin-handler-type-safe-input-validation.md) — Validate handler input with typeof guards, not assertions
- [playwright-tool-handler-template](playwright-tool-handler-template.md) — Follow consistent structure for Playwright plugin tool handlers
- [playwright-operation-error-handling](playwright-operation-error-handling.md) — Wrap all Playwright operations in try-catch, return error strings
- [sequential-phase-orchestration-preference](sequential-phase-orchestration-preference.md) — Prefer sequential phases over parallel in orchestration
- [parallel-async-agent-delegation](parallel-async-agent-delegation.md) — Delegate async agent work in parallel
- [duplicate-utility-types-consolidation](duplicate-utility-types-consolidation.md) — Consolidate duplicate utility types

## UI & Component Patterns
- [admin-page-layout-standardization](admin-page-layout-standardization.md) — Standardize admin page layouts
- [modal-dialog-trigger-customization](modal-dialog-trigger-customization.md) — Customize modal/dialog triggers
- [selector-dropdownmenu-preference](selector-dropdownmenu-preference.md) — Prefer DropdownMenu for selectors
- [suspense-wrapped-async-server-components](suspense-wrapped-async-server-components.md) — Wrap async server components in Suspense with Internal exports for testing
- [react-form-useTransition-server-action-pattern](react-form-useTransition-server-action-pattern.md) — Build forms with useTransition and server actions
- [card-content-padding-refinement](card-content-padding-refinement.md) — Reduce CardContent top padding from pt-6 to pt-3 for tighter layouts

## Build & Format
- [biome-use-block-statements](biome-use-block-statements.md) — Format block statements with biome
