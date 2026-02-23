// Delegation loop — manages sub-agent task lifecycle with iteration control
// Creates task records, fires lifecycle hooks, invokes sub-agents,
// and handles accept/reject validation with re-delegation support

import type { InvokeResult, PluginContext, PluginHooks } from "@harness/plugin-contract";

export type DelegationOptions = {
  prompt: string;
  parentThreadId: string;
  maxIterations?: number;
  model?: string;
};

export type DelegationResult = {
  taskId: string;
  threadId: string;
  status: "completed" | "failed";
  result: string | null;
  iterations: number;
};

type TaskCompleteOutcome = {
  accepted: boolean;
  feedback?: string;
};

type FireTaskCreateHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  taskId: string,
  ctx: PluginContext
) => Promise<void>;

const fireTaskCreateHooks: FireTaskCreateHooks = async (allHooks, threadId, taskId, ctx) => {
  for (const hooks of allHooks) {
    if (hooks.onTaskCreate) {
      try {
        await hooks.onTaskCreate(threadId, taskId);
      } catch (err) {
        ctx.logger.error(`Hook "onTaskCreate" threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
};

type FireTaskCompleteHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  taskId: string,
  result: string,
  ctx: PluginContext
) => Promise<TaskCompleteOutcome>;

const fireTaskCompleteHooks: FireTaskCompleteHooks = async (allHooks, threadId, taskId, result, ctx) => {
  for (const hooks of allHooks) {
    if (hooks.onTaskComplete) {
      try {
        await hooks.onTaskComplete(threadId, taskId, result);
      } catch (err) {
        ctx.logger.error(`Hook "onTaskComplete" threw: ${err instanceof Error ? err.message : String(err)}`);
        return {
          accepted: false,
          feedback: `Validation hook error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }
  return { accepted: true };
};

type FireTaskFailedHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  taskId: string,
  error: Error,
  ctx: PluginContext
) => Promise<void>;

const fireTaskFailedHooks: FireTaskFailedHooks = async (allHooks, threadId, taskId, error, ctx) => {
  for (const hooks of allHooks) {
    if (hooks.onTaskFailed) {
      try {
        await hooks.onTaskFailed(threadId, taskId, error);
      } catch (err) {
        ctx.logger.error(`Hook "onTaskFailed" threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
};

const DEFAULT_MAX_ITERATIONS = 5;

type CreateTaskThread = (ctx: PluginContext, parentThreadId: string, prompt: string) => Promise<{ threadId: string }>;

const createTaskThread: CreateTaskThread = async (ctx, parentThreadId, prompt) => {
  const thread = await ctx.db.thread.create({
    data: {
      source: "delegation",
      sourceId: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `Task: ${prompt.slice(0, 50)}`,
      kind: "task",
      status: "active",
      parentThreadId,
      lastActivity: new Date(),
    },
  });
  return { threadId: thread.id };
};

type CreateTaskRecord = (
  ctx: PluginContext,
  threadId: string,
  prompt: string,
  maxIterations: number
) => Promise<{ taskId: string }>;

const createTaskRecord: CreateTaskRecord = async (ctx, threadId, prompt, maxIterations) => {
  const task = await ctx.db.orchestratorTask.create({
    data: {
      threadId,
      prompt,
      status: "pending",
      maxIterations,
      currentIteration: 0,
    },
  });
  return { taskId: task.id };
};

type BuildIterationPrompt = (originalPrompt: string, feedback: string | undefined) => string;

const buildIterationPrompt: BuildIterationPrompt = (originalPrompt, feedback) => {
  if (!feedback) {
    return originalPrompt;
  }
  return `${originalPrompt}\n\n---\n\nPrevious attempt was rejected with the following feedback:\n\n${feedback}`;
};

type InvokeSubAgent = (
  ctx: PluginContext,
  prompt: string,
  taskId: string,
  threadId: string,
  model: string | undefined
) => Promise<InvokeResult>;

const invokeSubAgent: InvokeSubAgent = async (ctx, prompt, taskId, threadId, model) => {
  const result = await ctx.invoker.invoke(prompt, { model });

  // Persist the sub-agent output as a message in the task thread
  await ctx.db.message.create({
    data: {
      threadId,
      role: "assistant",
      content: result.output,
    },
  });

  // Record the agent run
  await ctx.db.agentRun.create({
    data: {
      threadId,
      taskId,
      model: model ?? ctx.config.claudeModel,
      durationMs: result.durationMs,
      status: result.exitCode === 0 ? "completed" : "failed",
      error: result.error ?? null,
      completedAt: new Date(),
    },
  });

  return result;
};

type RunDelegationLoop = (
  ctx: PluginContext,
  allHooks: PluginHooks[],
  options: DelegationOptions
) => Promise<DelegationResult>;

export const runDelegationLoop: RunDelegationLoop = async (ctx, allHooks, options) => {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  // Step 1: Create a task thread linked to the parent
  const { threadId } = await createTaskThread(ctx, options.parentThreadId, options.prompt);

  // Step 2: Create the task record
  const { taskId } = await createTaskRecord(ctx, threadId, options.prompt, maxIterations);

  ctx.logger.info(`Delegation: created task ${taskId} in thread ${threadId}`, {
    parentThreadId: options.parentThreadId,
    maxIterations,
  });

  // Step 3: Fire onTaskCreate hooks
  await fireTaskCreateHooks(allHooks, threadId, taskId, ctx);

  // Broadcast task creation
  await ctx.broadcast("task:created", {
    taskId,
    threadId,
    parentThreadId: options.parentThreadId,
  });

  // Step 4: Delegation loop — invoke and validate
  let feedback: string | undefined;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Update task status to running
    await ctx.db.orchestratorTask.update({
      where: { id: taskId },
      data: {
        status: "running",
        currentIteration: iterations,
      },
    });

    ctx.logger.info(`Delegation: iteration ${iterations}/${maxIterations} for task ${taskId}`);

    // Persist the prompt as a user message in the task thread
    const iterationPrompt = buildIterationPrompt(options.prompt, feedback);
    await ctx.db.message.create({
      data: {
        threadId,
        role: "user",
        content: iterationPrompt,
      },
    });

    // Invoke the sub-agent
    const invokeResult = await invokeSubAgent(ctx, iterationPrompt, taskId, threadId, options.model);

    // Check for invocation failure
    if (invokeResult.exitCode !== 0 && invokeResult.exitCode !== null) {
      ctx.logger.warn(`Delegation: sub-agent failed for task ${taskId}`, {
        exitCode: invokeResult.exitCode,
        error: invokeResult.error,
      });
      feedback = `Sub-agent invocation failed with exit code ${invokeResult.exitCode}: ${invokeResult.error ?? "unknown error"}`;
      continue;
    }

    // Update task status to evaluating
    await ctx.db.orchestratorTask.update({
      where: { id: taskId },
      data: { status: "evaluating" },
    });

    // Fire onTaskComplete hooks for validation
    const outcome = await fireTaskCompleteHooks(allHooks, threadId, taskId, invokeResult.output, ctx);

    // Broadcast task status update
    await ctx.broadcast("task:evaluated", {
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
          status: "completed",
          result: invokeResult.output,
        },
      });

      // Update thread status
      await ctx.db.thread.update({
        where: { id: threadId },
        data: { status: "completed", lastActivity: new Date() },
      });

      ctx.logger.info(`Delegation: task ${taskId} completed after ${iterations} iteration(s)`);

      // Broadcast completion
      await ctx.broadcast("task:validated", {
        taskId,
        threadId,
        parentThreadId: options.parentThreadId,
        iterations,
      });

      // Notify parent thread
      await ctx.sendToThread(
        options.parentThreadId,
        `Task ${taskId} completed successfully after ${iterations} iteration(s).`
      );

      return {
        taskId,
        threadId,
        status: "completed",
        result: invokeResult.output,
        iterations,
      };
    }

    // Task rejected — prepare for re-delegation
    feedback = outcome.feedback ?? "Task was rejected without specific feedback.";
    ctx.logger.info(`Delegation: task ${taskId} rejected at iteration ${iterations}`, {
      feedback,
    });
  }

  // Max iterations exhausted — task failed
  await ctx.db.orchestratorTask.update({
    where: { id: taskId },
    data: { status: "failed" },
  });

  await ctx.db.thread.update({
    where: { id: threadId },
    data: { status: "failed", lastActivity: new Date() },
  });

  const failError = new Error(
    `Task ${taskId} failed after ${maxIterations} iterations. Last feedback: ${feedback ?? "none"}`
  );

  // Fire onTaskFailed hooks
  await fireTaskFailedHooks(allHooks, threadId, taskId, failError, ctx);

  ctx.logger.error(`Delegation: task ${taskId} failed after ${maxIterations} iterations`);

  // Broadcast failure
  await ctx.broadcast("task:failed", {
    taskId,
    threadId,
    parentThreadId: options.parentThreadId,
    iterations: maxIterations,
    error: failError.message,
  });

  // Notify parent thread
  await ctx.sendToThread(
    options.parentThreadId,
    `Task ${taskId} failed after ${maxIterations} iteration(s). ${feedback ?? ""}`
  );

  return {
    taskId,
    threadId,
    status: "failed",
    result: null,
    iterations: maxIterations,
  };
};
