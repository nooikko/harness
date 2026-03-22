---
id: testing-framework-evaluation-research
trigger: when researching E2E testing, test infrastructure, or comparing testing frameworks
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Testing Framework Evaluation Research Pattern

## Action
When evaluating testing solutions, fetch documentation from multiple testing framework vendors (Playwright, Vitest, Cypress, WebdriverIO) to compare configuration patterns, capabilities, and integration approaches before committing to a choice.

## Evidence
- Observed 6 WebFetch calls to Playwright documentation (test-configuration, API testing, global setup/teardown, Next.js integration example)
- Observed 4 WebFetch calls to comparative testing tools (Vitest browser mode, Cypress GitHub integration, WebdriverIO overview, GitHub Actions service containers)
- Pattern: Fetches focus on configuration options, integration patterns, and real-world examples
- Research phase includes: Playwright configuration, API testing capabilities, server-side setup, browser automation providers
- Last observed: 2026-03-19T19:50:14Z in session fdcefc3e-16f5-4a1c-9fbd-de9c251a2ac8

## Context
The harness project involves test infrastructure decisions. User demonstrates pattern of researching multiple frameworks' documentation to understand comparative strengths (W3C standards, GitHub integration, browser modes, global setup patterns) before implementation.

## When to Apply
- Starting new E2E test suite → research Playwright, Cypress, WebdriverIO docs for configuration options
- Evaluating component testing vs E2E → fetch Vitest browser mode and Playwright docs to understand scope
- Setting up CI/CD with tests → research GitHub Actions service containers and testing framework integrations
- Choosing test infrastructure → gather documentation on global setup/teardown, API testing, and server integration

## Benefits
- Comparative knowledge prevents tool lock-in decisions
- Understanding all options leads to better architectural fit
- Configuration patterns vary by framework; research upfront prevents later pivots
