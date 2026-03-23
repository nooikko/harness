// SDK Invoker module — manages warm Agent SDK sessions for low-latency invocations

import type { InvokeOptions, InvokeResult, PluginContext } from '@harness/plugin-contract';
import { createSession } from './_helpers/create-session';
import { extractResult } from './_helpers/extract-result';
import { mapStreamEvent } from './_helpers/map-stream-event';
import type { SessionConfig, ThinkingConfig } from './_helpers/session-pool';
import { createSessionPool } from './_helpers/session-pool';

type Logger = { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };

export type SdkInvokerConfig = {
  defaultModel: string;
  defaultTimeout: number;
  sessionConfig?: SessionConfig;
  logger?: Logger;
};

type CreateSdkInvoker = (config: SdkInvokerConfig) => {
  invoke: (prompt: string, options?: InvokeOptions) => Promise<InvokeResult>;
  prewarm: (options: { threadId: string; model?: string }) => void;
  stop: () => void;
  setPluginContext: (ctx: PluginContext) => void;
};

type WithTimeout = <T>(promise: Promise<T>, ms: number) => Promise<T>;

const withTimeout: WithTimeout = (promise, ms) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms`));
      promise.catch(() => {});
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
};

export const createSdkInvoker: CreateSdkInvoker = (config) => {
  const log = config.logger ?? { info: () => {}, warn: () => {}, error: () => {} };
  const pool = createSessionPool(
    {
      maxSessions: 8,
      ttlMs: 8 * 60 * 1000,
    },
    createSession,
    config.sessionConfig,
  );

  // Late-bound PluginContext — set after orchestrator creation via setPluginContext()
  let pluginContext: PluginContext | null = null;

  // Resolve model-aware thinking defaults, allowing explicit effort to override
  type ResolveThinkingConfig = (
    model: string,
    effort?: InvokeOptions['effort'],
  ) => { thinking?: ThinkingConfig; effort?: 'low' | 'medium' | 'high' | 'max' };
  const resolveThinkingConfig: ResolveThinkingConfig = (model, effort) => {
    // Explicit effort always wins over model-aware defaults
    if (effort !== undefined) {
      return { effort };
    }
    if (model.includes('haiku')) {
      return { thinking: { type: 'disabled' } };
    }
    if (model.includes('sonnet')) {
      return { effort: 'medium' };
    }
    if (model.includes('opus')) {
      return { effort: 'high' };
    }
    return {};
  };

  const invoke = async (prompt: string, options?: InvokeOptions): Promise<InvokeResult> => {
    const model = options?.model ?? config.defaultModel;
    const resolvedThinking = resolveThinkingConfig(model, options?.effort);
    // Encode effort/thinking + disallowedTools into the pool key so sessions with different configs don't share a warm session
    const effortSuffix = resolvedThinking.effort
      ? `:effort:${resolvedThinking.effort}`
      : resolvedThinking.thinking?.type === 'disabled'
        ? ':thinking:disabled'
        : '';
    const toolsSuffix = options?.disallowedTools?.length ? `:dt:${options.disallowedTools.length}` : '';
    const agentSuffix = options?.systemPrompt ? ':agent' : '';
    const cwdSuffix = options?.cwd ? `:cwd:${options.cwd}` : '';
    const baseKey = options?.threadId ?? options?.sessionId ?? 'default';
    const poolKey = `${baseKey}${effortSuffix}${toolsSuffix}${agentSuffix}${cwdSuffix}`;
    const timeout = options?.timeout ?? config.defaultTimeout;
    const startTime = Date.now();

    log.info(`invoker: acquiring session [poolKey=${poolKey}, model=${model}, timeout=${timeout}ms]`);
    const session = pool.get(poolKey, model, {
      ...resolvedThinking,
      ...(options?.disallowedTools?.length ? { disallowedTools: options.disallowedTools } : {}),
      ...(options?.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
      ...(options?.maxTurns ? { maxTurns: options.maxTurns } : {}),
      ...(options?.cwd ? { cwd: options.cwd } : {}),
    });
    log.info(`invoker: session acquired, sending prompt [promptLength=${prompt.length}]`);

    // Construct per-invocation meta — flows to the session's contextRef via drainQueue
    const meta = {
      threadId: options?.threadId ?? '',
      traceId: options?.traceId,
      taskId: options?.taskId,
      pendingBlocks: options?.pendingBlocks ?? [],
      ctx: pluginContext,
    };

    const sendOptions = {
      meta,
      ...(options?.onMessage
        ? {
            onMessage: (sdkMessage: Parameters<typeof mapStreamEvent>[0]) => {
              for (const event of mapStreamEvent(sdkMessage)) {
                options.onMessage!(event);
              }
            },
          }
        : {}),
    };

    try {
      const result = await withTimeout(session.send(prompt, sendOptions), timeout);
      const extracted = extractResult(result, Date.now() - startTime);
      log.info(`invoker: result received [outputLength=${extracted.output?.length ?? 0}, durationMs=${extracted.durationMs}]`);
      return { ...extracted, traceId: options?.traceId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Retry once on stale session (TOCTOU: eviction timer closed it between get() and send())
      const isStaleSession = err instanceof Error && err.message === 'Session is closed';
      pool.evict(poolKey);

      if (isStaleSession) {
        log.warn(`invoker: stale session, retrying [poolKey=${poolKey}]`);
        try {
          const freshSession = pool.get(poolKey, model, {
            ...resolvedThinking,
            ...(options?.disallowedTools?.length ? { disallowedTools: options.disallowedTools } : {}),
            ...(options?.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
            ...(options?.maxTurns ? { maxTurns: options.maxTurns } : {}),
            ...(options?.cwd ? { cwd: options.cwd } : {}),
          });
          const retryResult = await withTimeout(freshSession.send(prompt, sendOptions), timeout);
          const retryExtracted = extractResult(retryResult, Date.now() - startTime);
          log.info(`invoker: retry succeeded [outputLength=${retryExtracted.output?.length ?? 0}, durationMs=${retryExtracted.durationMs}]`);
          return { ...retryExtracted, traceId: options?.traceId };
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          log.error(`invoker: retry also failed [error=${retryMsg}, durationMs=${Date.now() - startTime}]`);
          pool.evict(poolKey);
          return {
            output: '',
            error: retryMsg,
            durationMs: Date.now() - startTime,
            exitCode: 1,
            traceId: options?.traceId,
          };
        }
      }

      log.error(`invoker: invocation failed [error=${errMsg}, durationMs=${Date.now() - startTime}]`);
      return {
        output: '',
        error: errMsg,
        durationMs: Date.now() - startTime,
        exitCode: 1,
        traceId: options?.traceId,
      };
    }
  };

  const prewarm = (options: { threadId: string; model?: string; systemPrompt?: string; maxTurns?: number }) => {
    const model = options.model ?? config.defaultModel;
    const resolvedThinking = resolveThinkingConfig(model);
    const agentSuffix = options.systemPrompt ? ':agent' : '';
    const poolKey = `${options.threadId}${agentSuffix}`;
    log.info(`invoker: prewarming session [poolKey=${poolKey}, model=${model}]`);
    pool.get(poolKey, model, {
      ...resolvedThinking,
      ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
      ...(options.maxTurns ? { maxTurns: options.maxTurns } : {}),
    });
  };

  const setPluginContext = (ctx: PluginContext) => {
    pluginContext = ctx;
  };

  return { invoke, prewarm, stop: () => pool.closeAll(), setPluginContext };
};
