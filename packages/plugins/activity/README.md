# Activity Plugin

The activity plugin records a structured audit trail for every pipeline run. It captures the start of each pipeline invocation, the Claude stream events that occur during it (thinking blocks, tool calls, tool results), and the final completion status — persisting each as a `Message` row in the database so the web UI can display a rich, step-by-step view of what Claude did.

## What it does

Every time a message is processed through the orchestrator, the activity plugin bookmarks the beginning and end of that pipeline run and saves a record of every significant event in between: when Claude was thinking, which tools it called and with what inputs, what those tools returned, and how long the whole thing took. This data appears in the web dashboard as the detailed activity feed alongside each conversation.

## Why it exists

The orchestrator core intentionally knows nothing about persistence — its job is to run the pipeline and fire hooks, not to decide what gets saved. The activity plugin is the designated home for all "Rich Activity" persistence: the structured records that go beyond the plain assistant message and capture the full shape of an invocation. Without it, the UI would only see the final text response, not the reasoning or tool use that produced it.

This plugin is also the result of a deliberate refactor. Rich Activity writes previously lived hardcoded inside `sendToThread` in the orchestrator — the activity plugin is what they moved into once the `onPipelineStart` and `onPipelineComplete` hooks were added.
