import os from 'node:os';
import type { SDKMessage, SDKResultSuccess, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it, vi } from 'vitest';

type MockController = {
  yield: (message: SDKMessage) => void;
  throw: (error: Error) => void;
  end: () => void;
};

let activeController: MockController | null = null;
let activeCloseFn: ReturnType<typeof vi.fn> | null = null;
let lastQueryOptions: Record<string, unknown> | null = null;

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(({ prompt, options }: { prompt: AsyncIterable<SDKUserMessage>; options?: Record<string, unknown> }) => {
    lastQueryOptions = options ?? null;
    let outputResolve: ((value: IteratorResult<SDKMessage>) => void) | null = null;
    let outputReject: ((error: Error) => void) | null = null;
    let outputDone = false;

    // Consume the prompt generator in the background so yieldResolver gets set
    const consumePrompt = async () => {
      try {
        for await (const _msg of prompt) {
          // We don't need the user messages — just consuming keeps the generator running
        }
      } catch {
        // Session closed
      }
    };
    consumePrompt();

    activeCloseFn = vi.fn(() => {
      outputDone = true;
      if (outputResolve) {
        const r = outputResolve;
        outputResolve = null;
        r({ value: undefined as unknown as SDKMessage, done: true });
      }
    });

    activeController = {
      yield: (message: SDKMessage) => {
        if (outputResolve) {
          const r = outputResolve;
          outputResolve = null;
          r({ value: message, done: false });
        }
      },
      throw: (error: Error) => {
        if (outputReject) {
          const r = outputReject;
          outputReject = null;
          r(error);
        }
      },
      end: () => {
        outputDone = true;
        if (outputResolve) {
          const r = outputResolve;
          outputResolve = null;
          r({ value: undefined as unknown as SDKMessage, done: true });
        }
      },
    };

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (outputDone) {
            return Promise.resolve({ value: undefined as unknown as SDKMessage, done: true });
          }
          return new Promise<IteratorResult<SDKMessage>>((res, rej) => {
            outputResolve = res;
            outputReject = rej;
          });
        },
      }),
      close: activeCloseFn,
    };
  }),
}));

import { createSession } from '../create-session';

type MakeResult = (overrides?: Partial<SDKResultSuccess>) => SDKResultSuccess;

const makeResult: MakeResult = (overrides) => ({
  type: 'result',
  subtype: 'success',
  duration_ms: 500,
  duration_api_ms: 400,
  is_error: false,
  num_turns: 1,
  result: 'Done',
  stop_reason: 'end_turn',
  total_cost_usd: 0.01,
  usage: {
    input_tokens: 10,
    output_tokens: 20,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  } as SDKResultSuccess['usage'],
  modelUsage: {},
  permission_denials: [],
  uuid: 'uuid-1' as SDKResultSuccess['uuid'],
  session_id: 'sess-1',
  ...overrides,
});

// Allow microtasks to drain (async generators need multiple ticks)
type Tick = (count?: number) => Promise<void>;
const tick: Tick = async (count = 5) => {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
};

describe('createSession', () => {
  it('returns a session object with expected interface', async () => {
    const session = createSession('sonnet');
    await tick();

    expect(session).toHaveProperty('send');
    expect(session).toHaveProperty('close');
    expect(session.isAlive).toBe(true);
    expect(typeof session.lastActivity).toBe('number');

    session.close();
  });

  it('resolves send when a result message arrives', async () => {
    const session = createSession('sonnet');
    await tick();

    const sendPromise = session.send('Hello');
    await tick();

    activeController!.yield(makeResult());

    const result = await sendPromise;
    expect(result.type).toBe('result');

    session.close();
  });

  it('rejects send on a closed session', async () => {
    const session = createSession('sonnet');
    await tick();

    session.close();

    await expect(session.send('Hello')).rejects.toThrow('Session is closed');
  });

  it('marks session as not alive after close', async () => {
    const session = createSession('sonnet');
    await tick();

    expect(session.isAlive).toBe(true);
    session.close();
    expect(session.isAlive).toBe(false);
  });

  it('calls close on the query iterable when closing', async () => {
    const session = createSession('sonnet');
    await tick();
    const closeFn = activeCloseFn!;

    session.close();

    expect(closeFn).toHaveBeenCalled();
  });

  it('rejects pending requests when session is closed', async () => {
    const session = createSession('sonnet');
    await tick();

    // Send two messages so the second stays in pending queue
    const promise1 = session.send('First');
    await tick();
    const promise2 = session.send('Second');

    session.close();

    await expect(promise1).rejects.toThrow('Session closed');
    await expect(promise2).rejects.toThrow('Session closed');
  });

  it('forwards non-result messages to onMessage callback', async () => {
    const session = createSession('sonnet');
    await tick();
    const onMessage = vi.fn();

    const sendPromise = session.send('Hello', { onMessage });
    await tick();

    const toolProgress = {
      type: 'tool_progress',
      tool_use_id: 'tu-1',
      tool_name: 'Read',
      parent_tool_use_id: null,
      elapsed_time_seconds: 1,
      uuid: 'uuid-2',
      session_id: 'sess-1',
    } as unknown as SDKMessage;

    activeController!.yield(toolProgress);
    await tick();

    expect(onMessage).toHaveBeenCalledWith(toolProgress);

    activeController!.yield(makeResult());
    const result = await sendPromise;
    expect(result.type).toBe('result');

    session.close();
  });

  it('does not throw when non-result message arrives with no onMessage', async () => {
    const session = createSession('sonnet');
    await tick();

    const sendPromise = session.send('Hello');
    await tick();

    // Yield a non-result message — should not throw
    const assistantMsg = { type: 'assistant', session_id: 'sess-1' } as unknown as SDKMessage;
    activeController!.yield(assistantMsg);
    await tick();

    activeController!.yield(makeResult());
    await sendPromise;

    session.close();
  });

  it('rejects active and pending requests when iterator throws', async () => {
    const session = createSession('sonnet');
    await tick();

    const promise1 = session.send('First');
    await tick();

    const promise2 = session.send('Second');

    activeController!.throw(new Error('SDK connection lost'));

    await expect(promise1).rejects.toThrow('SDK connection lost');
    await expect(promise2).rejects.toThrow('SDK connection lost');
  });

  it('marks session as not alive after iterator error', async () => {
    const session = createSession('sonnet');
    await tick();

    const promise = session.send('Hello');
    await tick();

    activeController!.throw(new Error('Connection lost'));
    await promise.catch(() => {});
    await tick();

    expect(session.isAlive).toBe(false);
  });

  it('processes queued requests sequentially', async () => {
    const session = createSession('sonnet');
    await tick();

    const promise1 = session.send('First');
    await tick();

    const promise2 = session.send('Second');

    activeController!.yield(makeResult({ result: 'First result' }));
    const firstResult = await promise1;
    expect((firstResult as SDKResultSuccess).result).toBe('First result');

    // Give drainQueue time to make second request active
    await tick();

    activeController!.yield(makeResult({ result: 'Second result' }));
    const secondResult = await promise2;
    expect((secondResult as SDKResultSuccess).result).toBe('Second result');

    session.close();
  });

  it('updates lastActivity when a result is received', async () => {
    const session = createSession('sonnet');
    await tick();

    const initialActivity = session.lastActivity;

    const sendPromise = session.send('Hello');
    await tick();

    activeController!.yield(makeResult());
    await sendPromise;

    expect(session.lastActivity).toBeGreaterThanOrEqual(initialActivity);

    session.close();
  });

  it('marks session not alive when iterator ends naturally', async () => {
    const session = createSession('sonnet');
    await tick();

    activeController!.end();
    await tick();

    expect(session.isAlive).toBe(false);
  });

  it('calls mcpServerFactory and passes result to query() options when provided', async () => {
    const mockMcpServer = { name: 'harness', tools: [] };
    const session = createSession('sonnet', {
      mcpServerFactory: () => ({ harness: mockMcpServer as never }),
    });
    await tick();

    expect(lastQueryOptions).toEqual(
      expect.objectContaining({
        mcpServers: { harness: mockMcpServer },
      }),
    );

    session.close();
  });

  it('does not include mcpServers in query() options when not provided', async () => {
    const session = createSession('sonnet');
    await tick();

    expect(lastQueryOptions).not.toHaveProperty('mcpServers');

    session.close();
  });

  it('passes cwd: os.tmpdir() to query() to isolate Claude from project memory', async () => {
    const session = createSession('sonnet');
    await tick();

    expect(lastQueryOptions).toEqual(
      expect.objectContaining({
        cwd: os.tmpdir(),
      }),
    );

    session.close();
  });
});
