# Summarization Plugin

## What it does

The summarization plugin prevents token overflow in long conversations by periodically compressing message history. Every time a thread's message count hits a multiple of 50, it invokes Claude Haiku to generate a rolling summary of the conversation and stores it as a `summary` kind message in the thread.

The context plugin reads these summary messages when assembling prompts — instead of injecting the full message history for long threads, it can inject the most recent summary as a compressed representation.

## Why it exists

Claude has a context window limit. Threads that run for hundreds of messages would eventually hit that limit if raw history was always injected. The summarization plugin gives the context plugin a compressed signal to fall back on, keeping long-running threads functional without silently truncating history.

## How it works

- Hook: `onAfterInvoke` — fires after each Claude invocation
- Checks if the thread's total message count is a positive multiple of 50
- If yes, fires `summarizeInBackground` as a fire-and-forget void
- The background task: loads all messages for the thread, invokes Claude Haiku with a summarization prompt, writes a `Message` row with `kind: 'summary'`
- A 60-second duplicate guard prevents double-writing if two invocations complete close together

## What it writes

One `Message` row per trigger:
- `role: 'assistant'`
- `kind: 'summary'`
- `content`: the generated summary text
- `metadata.coverageMessageCount`: how many messages were summarized
- `metadata.generatedAt`: ISO timestamp of generation

## What it does not do

The summarization plugin does not delete or replace old messages. It only appends. The context plugin decides whether to use the summary or the raw history — the summarization plugin has no awareness of that decision.
