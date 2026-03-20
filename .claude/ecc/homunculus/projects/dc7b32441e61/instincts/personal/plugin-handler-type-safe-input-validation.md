---
id: plugin-handler-type-safe-input-validation
trigger: when extracting and validating input parameters in plugin tool handlers
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Handlers Use Type-Safe Input Validation

## Action
Always validate input types using typeof guards and explicit null checks instead of type assertions. Never use `input.name as string`.

## Evidence
- Observed 4 times across handlers: list-cron-jobs, get-cron-job, update-cron-job, delete-cron-job
- Pattern: Replace `input.name as string | undefined` with `typeof input.name === 'string' ? input.name.trim() : ''`
- Last observed: 2026-03-14

## Implementation Details

### For String Inputs
```javascript
// Before (unsafe)
const name = input.name as string | undefined;
if (!name?.trim()) return 'Error: name is required.';

// After (safe)
const name = typeof input.name === 'string' ? input.name.trim() : '';
if (!name) return 'Error: name is required.';
```

### For Boolean Inputs
```javascript
// Before (unsafe)
const enabledOnly = (input.enabledOnly as boolean | undefined) ?? false;

// After (safe)
const enabledOnly = typeof input.enabledOnly === 'boolean' ? input.enabledOnly : false;
```

### For Other Types
```javascript
// Check type before using
if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
  return 'Error: prompt must be a non-empty string.';
}
```

## Why
Plugin handlers receive untrusted input from the harness system. Type assertions bypass runtime checks and can mask bugs. Typeof guards are explicit and handle edge cases (null, undefined, wrong types).
