// Delegation loop — manages sub-agent task lifecycle with iteration control
// Creates task records, fires lifecycle hooks, invokes sub-agents,
// and handles accept/reject validation with re-delegation support

import type { InvokeStreamEvent, PluginContext, PluginHooks } from '@harness/plugin-contract';
import { runHook } from '@harness/plugin-contract';
import { buildIterationPrompt } from './build-iteration-prompt';
import { calculateBackoffMs } from './calculate-backoff-ms';
import { categorizeFailure } from './categorize-failure';
import { fireTaskCompleteHooks } from './fire-task-complete-hooks';
import { invokeSubAgent } from './invoke-sub-agent';
import { queryDelegationCost } from './query-delegation-cost';
import { sendThreadNotification } from './send-thread-notification';

// Maximum USD spend allowed for a single delegation chain.
// Stops the loop before runaway Opus usage drains the budget.
// Override with DELEGATION_COST_CAP_USD env var.
const DELEGATION_COST_CAP_USD = Number(process.env.DELEGATION_COST_CAP_USD ?? '5');

export type DelegationOptions = {
  prompt: string;
  parentThreadId: string;
  maxIterations?: number;
  model?: string;
  traceId?: string;
};

export type DelegationResult = {
  taskId: string;
  threadId: string;
  status: 'completed' | 'failed';
  result: string | null;
  iterations: number;
};

export type SetupDelegationTaskResult = {
  threadId: string;
  taskId: string;
};

const DEFAULT_MAX_ITERATIONS = 5;

type SetupDelegationTask = (ctx: PluginContext, allHooks: PluginHooks[], options: DelegationOptions) => Promise<SetupDelegationTaskResult>;

export const setupDelegationTask: SetupDelegationTask = async (ctx, allHooks, options) => {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  // Steps 1 & 2: Create thread and task record atomically
  const { threadId, taskId } = await ctx.db.$transaction(async (tx) => {
    const thread = await tx.thread.create({
      data: {
        source: 'delegation',
        sourceId: `task-${crypto.randomUUID()}`,
        name: `Task: ${options.prompt.slice(0, 50)}`,
        kind: 'task',
        status: 'active',
        parentThreadId: options.parentThreadId,
        lastActivity: new Date(),
      },
    });

    const task = await tx.orchestratorTask.create({
      data: {
        threadId: thread.id,
        prompt: options.prompt,
        status: 'pending',
        maxIterations,
        currentIteration: 0,
      },
    });

    return { threadId: thread.id, taskId: task.id };
  });

  ctx.logger.info(`Delegation: created task ${taskId} in thread ${threadId}`, {
    parentThreadId: options.parentThreadId,
    maxIterations,
  });

  // Step 3: Fire onTaskCreate hooks
  await runHook(
    allHooks,
    'onTaskCreate',
    (hooks) => {
      if (hooks.onTaskCreate) {
        return hooks.onTaskCreate(threadId, taskId);
      }
      return undefined;
    },
    ctx.logger,
  );

  // Step 4: Broadcast task creation
  await ctx.broadcast('task:created', {
    taskId,
    threadId,
    parentThreadId: options.parentThreadId,
  });

  return { threadId, taskId };
};

type RunDelegationLoop = (ctx: PluginContext, allHooks: PluginHooks[], options: DelegationOptions) => Promise<DelegationResult>;

export const runDelegationLoop: RunDelegationLoop = async (ctx, allHooks, options) => {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  const { threadId, taskId } = await setupDelegationTask(ctx, allHooks, options);

  // Delegation loop — invoke and validate
  let feedback: string | undefined;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Update task status to running
    await ctx.db.orchestratorTask.update({
      where: { id: taskId },
      data: {
        status: 'running',
        currentIteration: iterations,
      },
    });

    ctx.logger.info(`Delegation: iteration ${iterations}/${maxIterations} for task ${taskId}`);

    // Persist the prompt as a user message in the task thread
    const iterationPrompt = buildIterationPrompt(options.prompt, feedback);
    await ctx.db.message.create({
      data: {
        threadId,
        role: 'user',
        content: iterationPrompt,
      },
    });

    // Invoke the sub-agent with streaming callback
    const onMessage = (event: InvokeStreamEvent) => {
      ctx
        .broadcast('task:stream', {
          taskId,
          threadId,
          parentThreadId: options.parentThreadId,
          iteration: iterations,
          event,
        })
        .catch(() => {});
    };
    const invokeResult = await invokeSubAgent(ctx, iterationPrompt, taskId, threadId, options.model, onMessage, options.traceId);

    // Check for invocation failure
    if (invokeResult.exitCode !== 0 && invokeResult.exitCode !== null) {
      const category = categorizeFailure(invokeResult.error);

      ctx.logger.warn(`Delegation: sub-agent failed for task ${taskId}`, {
        exitCode: invokeResult.exitCode,
        error: invokeResult.error,
        category,
        iteration: iterations,
      });

      feedback = `Sub-agent invocation failed (${category}) at iteration ${iterations}: ${invokeResult.error ?? 'unknown error'}`;

      if (category === 'logic-error') {
        // Same prompt will fail the same way — no point retrying
        ctx.logger.error(`Delegation: logic error detected, fast-failing task ${taskId}`, { category });
        break;
      }

      const waitMs = calculateBackoffMs(iterations, category);
      if (waitMs > 0) {
        ctx.logger.info(`Delegation: backing off ${waitMs}ms before retry`, { iteration: iterations, category });
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      // Cost cap check before retrying
      const spentAfterFailure = await queryDelegationCost(ctx.db, taskId);
      if (spentAfterFailure >= DELEGATION_COST_CAP_USD) {
        ctx.logger.warn(`Delegation: cost cap hit for task ${taskId}`, {
          spent: spentAfterFailure,
          cap: DELEGATION_COST_CAP_USD,
        });
        await ctx.broadcast('task:cost-cap', { taskId, threadId, spent: spentAfterFailure, cap: DELEGATION_COST_CAP_USD });
        feedback = `Task stopped: exceeded cost budget of $${DELEGATION_COST_CAP_USD.toFixed(2)} (spent $${spentAfterFailure.toFixed(2)})`;
        break;
      }

      continue;
    }

    // Update task status to evaluating
    await ctx.db.orchestratorTask.update({
      where: { id: taskId },
      data: { status: 'evaluating' },
    });

    // Fire onTaskComplete hooks for validation
    const outcome = await fireTaskCompleteHooks(allHooks, threadId, taskId, invokeResult.output, ctx);

    // Broadcast task status update
    await ctx.broadcast('task:evaluated', {
      taskId,
      threadId,
      iteration: iterations,
      accepted: outcome.accepted,
    });

    if (outcome.accepted) {
      // Task accepted — finalize
      await ctx.db.orchestratorTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          result: invokeResult.output,
        },
      });

      // Update thread status
      await ctx.db.thread.update({
        where: { id: threadId },
        data: { status: 'completed', lastActivity: new Date() },
      });

      ctx.logger.info(`Delegation: task ${taskId} completed after ${iterations} iteration(s)`);

      // Broadcast completion
      await ctx.broadcast('task:validated', {
        taskId,
        threadId,
        parentThreadId: options.parentThreadId,
        iterations,
      });

      // Notify parent thread with structured cross-thread notification
      await sendThreadNotification(ctx, {
        parentThreadId: options.parentThreadId,
        taskThreadId: threadId,
        taskId,
        status: 'completed',
        summary: invokeResult.output.slice(0, 200),
        iterations,
      });

      return {
        taskId,
        threadId,
        status: 'completed',
        result: invokeResult.output,
        iterations,
      };
    }

    // Task rejected — prepare for re-delegation
    feedback = outcome.feedback ?? 'Task was rejected without specific feedback.';
    ctx.logger.info(`Delegation: task ${taskId} rejected at iteration ${iterations}`, {
      feedback,
    });

    // Broadcast iteration progress
    await ctx.broadcast('task:progress', {
      taskId,
      threadId,
      parentThreadId: options.parentThreadId,
      iteration: iterations,
      maxIterations,
      status: 'rejected',
      feedback,
    });

    // Cost cap check before next iteration
    const spentAfterRejection = await queryDelegationCost(ctx.db, taskId);
    if (spentAfterRejection >= DELEGATION_COST_CAP_USD) {
      ctx.logger.warn(`Delegation: cost cap hit for task ${taskId}`, {
        spent: spentAfterRejection,
        cap: DELEGATION_COST_CAP_USD,
      });
      await ctx.broadcast('task:cost-cap', { taskId, threadId, spent: spentAfterRejection, cap: DELEGATION_COST_CAP_USD });
      feedback = `Task stopped: exceeded cost budget of $${DELEGATION_COST_CAP_USD.toFixed(2)} (spent $${spentAfterRejection.toFixed(2)})`;
      break;
    }
  }

  // Max iterations exhausted — task failed
  await ctx.db.orchestratorTask.update({
    where: { id: taskId },
    data: { status: 'failed' },
  });

  await ctx.db.thread.update({
    where: { id: threadId },
    data: { status: 'failed', lastActivity: new Date() },
  });

  const failError = new Error(`Task ${taskId} failed after ${maxIterations} iterations. Last feedback: ${feedback ?? 'none'}`);

  // Fire onTaskFailed hooks
  await runHook(
    allHooks,
    'onTaskFailed',
    (hooks) => {
      if (hooks.onTaskFailed) {
        return hooks.onTaskFailed(threadId, taskId, failError);
      }
      return undefined;
    },
    ctx.logger,
  );

  ctx.logger.error(`Delegation: task ${taskId} failed after ${maxIterations} iterations`);

  // Broadcast failure
  await ctx.broadcast('task:failed', {
    taskId,
    threadId,
    parentThreadId: options.parentThreadId,
    iterations: maxIterations,
    error: failError.message,
  });

  // Notify parent thread with structured cross-thread notification
  await sendThreadNotification(ctx, {
    parentThreadId: options.parentThreadId,
    taskThreadId: threadId,
    taskId,
    status: 'failed',
    summary: feedback ?? 'Max iterations exhausted',
    iterations: maxIterations,
  });

  return {
    taskId,
    threadId,
    status: 'failed',
    result: null,
    iterations: maxIterations,
  };
};
