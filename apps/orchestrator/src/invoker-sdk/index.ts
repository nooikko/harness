// SDK Invoker module — manages warm Agent SDK sessions for low-latency invocations

import type { InvokeOptions, InvokeResult } from '@harness/plugin-contract';
import { createSession } from './_helpers/create-session';
import { extractResult } from './_helpers/extract-result';
import { mapStreamEvent } from './_helpers/map-stream-event';
import type { SessionConfig } from './_helpers/session-pool';
import { createSessionPool } from './_helpers/session-pool';

export type SdkInvokerConfig = {
  defaultModel: string;
  defaultTimeout: number;
  sessionConfig?: SessionConfig;
};

type CreateSdkInvoker = (config: SdkInvokerConfig) => {
  invoke: (prompt: string, options?: InvokeOptions) => Promise<InvokeResult>;
  prewarm: (options: { sessionId: string; model?: string }) => void;
  stop: () => void;
};

type WithTimeout = <T>(promise: Promise<T>, ms: number) => Promise<T>;

const withTimeout: WithTimeout = (promise, ms) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms`));
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
  const pool = createSessionPool(
    {
      maxSessions: 5,
      ttlMs: 8 * 60 * 1000,
    },
    createSession,
    config.sessionConfig,
  );

  const invoke = async (prompt: string, options?: InvokeOptions): Promise<InvokeResult> => {
    const model = options?.model ?? config.defaultModel;
    const threadId = options?.sessionId ?? 'default';
    const timeout = options?.timeout ?? config.defaultTimeout;
    const startTime = Date.now();

    const session = pool.get(threadId, model);

    const sendOptions = options?.onMessage
      ? { onMessage: (sdkMessage: Parameters<typeof mapStreamEvent>[0]) => options.onMessage!(mapStreamEvent(sdkMessage)) }
      : undefined;

    try {
      const result = await withTimeout(session.send(prompt, sendOptions), timeout);
      return extractResult(result, Date.now() - startTime);
    } catch (err) {
      pool.evict(threadId);
      return {
        output: '',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
        exitCode: 1,
      };
    }
  };

  const prewarm = (options: { sessionId: string; model?: string }) => {
    const model = options.model ?? config.defaultModel;
    pool.get(options.sessionId, model);
  };

  return { invoke, prewarm, stop: () => pool.closeAll() };
};
