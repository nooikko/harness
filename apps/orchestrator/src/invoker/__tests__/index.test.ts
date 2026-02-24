import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvokerConfig } from '../index';
import { createInvoker } from '../index';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

type MockChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  killed: boolean;
  kill: ReturnType<typeof vi.fn>;
};

const createMockChild = (): MockChild => {
  const emitter = new EventEmitter();
  const child = emitter as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
  });
  return child;
};

type JsonResponse = {
  result: string;
  session_id?: string;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const emitJson = (child: MockChild, response: JsonResponse) => {
  child.stdout.emit('data', Buffer.from(JSON.stringify(response)));
};

const defaultConfig: InvokerConfig = {
  defaultModel: 'claude-sonnet-4-6',
  defaultTimeout: 30000,
};

describe('createInvoker', () => {
  let mockChild: ReturnType<typeof createMockChild>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild as unknown as ChildProcess);
  });

  it('spawns claude with correct args including JSON output format', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('hello world');

    emitJson(mockChild, { result: '' });
    mockChild.emit('close', 0);

    await resultPromise;

    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', 'hello world', '--model', 'claude-sonnet-4-6', '--output-format', 'json']),
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
    );
  });

  it('extracts result from JSON response', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('test prompt');

    emitJson(mockChild, { result: 'result text' });
    mockChild.emit('close', 0);

    const result = await resultPromise;

    expect(result.output).toBe('result text');
    expect(result.exitCode).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it('extracts session_id and model from JSON response', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('test prompt');

    emitJson(mockChild, {
      result: 'hello',
      session_id: 'sess-abc',
      model: 'claude-haiku-4-5-20251001',
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    mockChild.emit('close', 0);

    const result = await resultPromise;

    expect(result.sessionId).toBe('sess-abc');
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
  });

  it('falls back to raw stdout when JSON parsing fails', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('test prompt');

    mockChild.stdout.emit('data', Buffer.from('  raw text output  '));
    mockChild.emit('close', 0);

    const result = await resultPromise;

    expect(result.output).toBe('raw text output');
    expect(result.sessionId).toBeUndefined();
  });

  it('concatenates multiple stdout chunks before parsing JSON', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('test prompt');

    const json = JSON.stringify({ result: 'combined' });
    const mid = Math.floor(json.length / 2);
    mockChild.stdout.emit('data', Buffer.from(json.slice(0, mid)));
    mockChild.stdout.emit('data', Buffer.from(json.slice(mid)));
    mockChild.emit('close', 0);

    const result = await resultPromise;

    expect(result.output).toBe('combined');
  });

  it('returns stderr as error when process exits with non-zero code', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('bad prompt');

    mockChild.stderr.emit('data', Buffer.from('something went wrong'));
    mockChild.emit('close', 1);

    const result = await resultPromise;

    expect(result.error).toBe('something went wrong');
    expect(result.exitCode).toBe(1);
  });

  it('returns no error when stderr is empty and process succeeds', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('good prompt');

    mockChild.emit('close', 0);

    const result = await resultPromise;

    expect(result.error).toBeUndefined();
    expect(result.exitCode).toBe(0);
  });

  it('handles spawn error emitted by the child process', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('any prompt');

    mockChild.emit('error', new Error('ENOENT: claude not found'));

    const result = await resultPromise;

    expect(result.output).toBe('');
    expect(result.error).toBe('Failed to spawn claude: ENOENT: claude not found');
    expect(result.exitCode).toBeNull();
  });

  it('uses default model from config when no model option is provided', async () => {
    const config: InvokerConfig = { defaultModel: 'claude-opus-4-6', defaultTimeout: 10000 };
    const invoker = createInvoker(config);

    const resultPromise = invoker.invoke('prompt');

    mockChild.emit('close', 0);

    await resultPromise;

    const spawnArgs = mockSpawn.mock.calls[0]![1] as string[];
    const modelIndex = spawnArgs.indexOf('--model');
    expect(spawnArgs[modelIndex + 1]).toBe('claude-opus-4-6');
  });

  it('uses model from options when provided, overriding config default', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('prompt', { model: 'claude-haiku-4-6' });

    mockChild.emit('close', 0);

    await resultPromise;

    const spawnArgs = mockSpawn.mock.calls[0]![1] as string[];
    const modelIndex = spawnArgs.indexOf('--model');
    expect(spawnArgs[modelIndex + 1]).toBe('claude-haiku-4-6');
  });

  it('passes sessionId as --resume arg alongside -p when provided', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('prompt', { sessionId: 'sess-xyz' });

    mockChild.emit('close', 0);

    await resultPromise;

    const spawnArgs = mockSpawn.mock.calls[0]![1] as string[];
    expect(spawnArgs).toContain('--resume');
    expect(spawnArgs).toContain('sess-xyz');
    expect(spawnArgs).toContain('-p');
    expect(spawnArgs).toContain('prompt');
  });

  it('includes durationMs in the result', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('timed prompt');

    mockChild.emit('close', 0);

    const result = await resultPromise;

    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('passes allowedTools args when provided in options', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('prompt', { allowedTools: ['Bash', 'Read'] });

    mockChild.emit('close', 0);

    await resultPromise;

    const spawnArgs = mockSpawn.mock.calls[0]![1] as string[];
    expect(spawnArgs).toContain('--allowedTools');
    expect(spawnArgs).toContain('Bash');
    expect(spawnArgs).toContain('Read');
  });

  it('passes maxTokens arg when provided in options', async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke('prompt', { maxTokens: 4096 });

    mockChild.emit('close', 0);

    await resultPromise;

    const spawnArgs = mockSpawn.mock.calls[0]![1] as string[];
    expect(spawnArgs).toContain('--max-tokens');
    expect(spawnArgs).toContain('4096');
  });

  it('kills child process after timeout and returns timeout error', async () => {
    vi.useFakeTimers();

    const config: InvokerConfig = { defaultModel: 'sonnet', defaultTimeout: 500 };
    const invoker = createInvoker(config);

    const resultPromise = invoker.invoke('slow prompt');

    await vi.advanceTimersByTimeAsync(500);

    expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');

    mockChild.emit('close', null);

    const result = await resultPromise;

    expect(result.error).toBe('Timed out after 500ms');

    vi.useRealTimers();
  });

  it('uses timeout from options when provided, overriding config default', async () => {
    vi.useFakeTimers();

    const config: InvokerConfig = { defaultModel: 'sonnet', defaultTimeout: 60000 };
    const invoker = createInvoker(config);

    const resultPromise = invoker.invoke('prompt', { timeout: 1000 });

    // Config default (60000ms) should NOT have fired yet but options timeout (1000ms) should
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');

    mockChild.emit('close', null);

    const result = await resultPromise;

    expect(result.error).toBe('Timed out after 1000ms');

    vi.useRealTimers();
  });

  it('removes CLAUDECODE and ANTHROPIC_API_KEY from the child process env', async () => {
    // Simulate running inside a Claude Code session with an inherited API key
    process.env.CLAUDECODE = '1';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    const invoker = createInvoker(defaultConfig);
    const resultPromise = invoker.invoke('prompt');

    mockChild.emit('close', 0);
    await resultPromise;

    const spawnOptions = mockSpawn.mock.calls[0]![2] as { env: Record<string, string | undefined> };
    expect('CLAUDECODE' in spawnOptions.env).toBe(false);
    expect('ANTHROPIC_API_KEY' in spawnOptions.env).toBe(false);

    delete process.env.CLAUDECODE;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('does not report timeout error when process finishes before deadline', async () => {
    vi.useFakeTimers();

    const config: InvokerConfig = { defaultModel: 'sonnet', defaultTimeout: 5000 };
    const invoker = createInvoker(config);

    const resultPromise = invoker.invoke('fast prompt');

    emitJson(mockChild, { result: 'done' });
    mockChild.emit('close', 0);

    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;

    expect(result.error).toBeUndefined();
    expect(mockChild.kill).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
