# Metrics Plugin

## What it does

The metrics plugin records token usage and estimated dollar cost for every Claude invocation. After each successful AI call, it writes four metric records to the database: input tokens, output tokens, total tokens, and estimated USD cost — all tagged with the model that was used.

This data is scoped per thread, so you can see usage broken down by conversation.

## Why it exists

Without the metrics plugin, there is no visibility into how much Claude is being used or what it costs. The web dashboard's metrics view reads directly from the records this plugin writes. The delegation plugin also queries these records to enforce per-task cost caps — without metrics, delegation cost caps silently stop working.

The plugin exists to make AI usage observable. It answers: how many tokens did we spend, on which model, in which thread, and what did it cost?

## What it records

Each invocation produces four `Metric` rows:

- `token.input` — prompt tokens sent to Claude
- `token.output` — completion tokens returned by Claude
- `token.total` — sum of input and output
- `token.cost` — estimated cost in USD

All four rows are tagged with the model name and linked to the thread.

## What it does not do

The metrics plugin does not aggregate, roll up, or summarize data. It is append-only — one set of four records per invocation. Aggregation is the responsibility of whatever reads the data (the web dashboard, the delegation plugin, etc.).

It has no external dependencies. All writes go directly to the database via Prisma.
