---
id: tsx-env-file-loading
trigger: when sub-packages in the monorepo's dev scripts fail to access parent .env variables
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# tsx Dev Scripts Need Explicit --env-file Flag for Parent .env

## Action
When configuring dev scripts in sub-package package.json files, add `--env-file=../../.env` flag to tsx watch commands to ensure parent-level environment variables are loaded during development.

## Evidence
- Observed 5+ times in session bbe56a1c-c659-48a9-87ca-5743e8ba37f1
- Pattern: Debugging environment variable loading involved checking OAUTH_ENCRYPTION_KEY presence, grepping for process.env patterns in test files, examining orchestrator/package.json structure, then adding `--env-file=../../.env` to the dev script
- Context: Monorepo with root .env at project root and sub-packages at apps/orchestrator and other locations
- Failure symptom: Missing or invalid environment variables during dev server execution, token exchange failures
- Solution applied: `"dev": "tsx watch --env-file=../../.env src/index.ts"`
- Last observed: 2026-03-17T03:08:10Z
