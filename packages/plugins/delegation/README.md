# @harness/plugin-delegation

The delegation plugin lets Claude spawn sub-agents to work on tasks independently. When Claude decides a subtask can be handled autonomously, it issues a `/delegate` command or calls the `delegate` MCP tool. The plugin creates a child thread, runs an iterative invoke-validate loop, and reports the result back to the parent thread when the sub-agent finishes.

## What it does

Claude operating in a parent thread can hand off a discrete task by providing a prompt. The delegation plugin:

- Creates a dedicated child thread and task record for the work
- Invokes a sub-agent (another Claude process) against that thread
- Validates the result: the sub-agent must output `/accept` to confirm completion, or `/request-changes <feedback>` to request a retry
- Retries up to a configurable iteration limit, carrying feedback forward on each attempt
- Sends the final result back to the parent thread as a system notification
- Enforces a cost budget so runaway loops cannot exhaust API spend

Sub-agents can also send progress updates to their parent mid-task using the `checkin` tool, which appears in the parent thread as a system message.

## Why it exists

Complex tasks benefit from parallelism and isolation. This plugin enables a "boss/worker" pattern: the main thread stays responsive while workers handle discrete subtasks in their own threads. Results arrive asynchronously when ready, keeping the parent conversation clean.

It also guards against common failure modes — runaway iteration and runaway cost — with hard limits that are configurable without code changes.

## Tools exposed to Claude

| Tool | Description |
|------|-------------|
| `delegate` | Spawn a sub-agent to work on a task in a separate thread |
| `checkin` | Send a progress update from a sub-agent to its parent thread |

Tools are exposed to Claude as MCP tools under the `delegation__` namespace (e.g., `delegation__delegate`).

## Commands handled

| Command | Description |
|---------|-------------|
| `/delegate [model=<model>] [maxIterations=<N>] <prompt>` | Delegate a task to a sub-agent |
| `/re-delegate [model=<model>] [maxIterations=<N>] <prompt>` | Re-run delegation (used internally when validation rejects) |
| `/checkin <message>` | Sub-agent check-in (handled via `onCommand`) |

## Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `DELEGATION_COST_CAP_USD` | `5` | Maximum USD spend per delegation chain before the task is failed |

`maxIterations` defaults to 5 and is capped at 20 regardless of what is passed in the command.
