// Tests for generate-thread-name helper

import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { generateThreadName } from '../generate-thread-name';

type InvokeResultOverrides = { output: string; exitCode?: number | null; error?: string };

const makeCtx = (overrides: string | InvokeResultOverrides): PluginContext => {
  const defaults = typeof overrides === 'string' ? { output: overrides } : overrides;
  return {
    invoker: {
      invoke: vi.fn().mockResolvedValue({
        output: defaults.output,
        durationMs: 100,
        exitCode: defaults.exitCode ?? 0,
        error: defaults.error,
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

  it('returns empty string when invoke returns an error', async () => {
    const ctx = makeCtx({ output: 'partial garbage', error: 'timeout' });
    const result = await generateThreadName(ctx, 'test message');

    expect(result).toBe('');
  });

  it('returns empty string when invoke returns non-zero exit code', async () => {
    const ctx = makeCtx({ output: 'partial output', exitCode: 1 });
    const result = await generateThreadName(ctx, 'test message');

    expect(result).toBe('');
  });

  it('truncates output longer than 100 characters', async () => {
    const longName = 'A'.repeat(150);
    const ctx = makeCtx(longName);
    const result = await generateThreadName(ctx, 'test message');

    expect(result).toHaveLength(100);
    expect(result).toBe('A'.repeat(100));
  });

  it('passes maxTokens to invoker', async () => {
    const ctx = makeCtx('Short Title');
    await generateThreadName(ctx, 'hello');

    const [, options] = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { maxTokens: number }];
    expect(options.maxTokens).toBe(30);
  });

  it('uses custom prompt instead of default when provided', async () => {
    const ctx = makeCtx('Custom Title');
    await generateThreadName(ctx, 'hello world', 'Name this thread in 3 words');

    const [prompt] = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(prompt).toContain('Name this thread in 3 words');
    expect(prompt).not.toContain('5-8 word title');
    expect(prompt).toContain('hello world');
  });
});
