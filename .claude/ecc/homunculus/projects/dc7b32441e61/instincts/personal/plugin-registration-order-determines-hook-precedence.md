---
id: plugin-registration-order-determines-hook-precedence
trigger: when registering multiple plugins that implement chain hooks like onBeforeInvoke
confidence: 0.70
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Registration Order Determines Hook Precedence

## Action
When registering multiple plugins, document the expected registration order in comments, especially for chain hooks like onBeforeInvoke where order affects the final prompt transformation.

## Evidence
- Observed 4+ times in test cases and orchestrator usage
- Test A: plugins registered as `[identity, activity, context, metrics, summarization, time]`
- Test B: validates chain order with `identity → context → time` resulting in correct prompt precedence
- Test comments state "chain order maintained"
- Orchestrator processes `onBeforeInvoke` hooks sequentially in registration order
- Last observed: 2026-03-14T03:55:04Z

## Details
Plugin hook execution order follows registration order:
- Identity plugin header injected first (top of prompt)
- Context plugin injects prior message history next
- Time plugin replaces `/current-time` tokens last (or based on position in array)

For chain hooks, earlier plugins transform the value first, then their output becomes input for the next plugin.

Document explicit ordering constraints in test setup or plugin configuration comments when order affects behavior.
