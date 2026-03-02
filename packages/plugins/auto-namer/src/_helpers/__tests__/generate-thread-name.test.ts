// Tests for generate-thread-name helper

import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { generateThreadName } from '../generate-thread-name';

const makeCtx = (output: string): PluginContext => {
  return {
    invoker: {
      invoke: vi.fn().mockResolvedValue({
        output,
        durationMs: 100,
        exitCode: 0,
      }),
    },
  } as unknown as PluginContext;
};

describe('generateThreadName', () => {
  it('calls invoker with haiku model and the content embedded in the prompt', async () => {
    const ctx = makeCtx('My Test Thread Title');
    const result = await generateThreadName(ctx, 'Hello, can you help me debug this code?');

    expect(ctx.invoker.invoke).toHaveBeenCalledOnce();
    const [prompt, options] = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { model: string }];

    expect(prompt).toContain('Hello, can you help me debug this code?');
    expect(prompt).toContain('5-8 word title');
    expect(options.model).toBe('claude-haiku-4-5-20251001');
    expect(result).toBe('My Test Thread Title');
  });

  it('trims whitespace from the output', async () => {
    const ctx = makeCtx('  Debugging Code With Claude  \n');
    const result = await generateThreadName(ctx, 'debug code');

    expect(result).toBe('Debugging Code With Claude');
  });

  it('returns empty string when output is only whitespace', async () => {
    const ctx = makeCtx('   ');
    const result = await generateThreadName(ctx, 'test message');

    expect(result).toBe('');
  });
});
