import type { PluginContext } from '@harness/plugin-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetExtractionCache, loadExtractionSystemPrompt } from '../extraction-config';

const createMockCtx = (agentResult: { soul: string } | null) =>
  ({
    db: {
      agent: {
        findFirst: vi.fn().mockResolvedValue(agentResult),
      },
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }) as unknown as PluginContext;

describe('loadExtractionSystemPrompt', () => {
  afterEach(() => {
    _resetExtractionCache();
  });

  it('loads the Safe Space agent soul from the database', async () => {
    const ctx = createMockCtx({ soul: 'You are a safe space.' });
    const prompt = await loadExtractionSystemPrompt(ctx);

    expect(prompt).toContain('literary analysis tool');
    expect(prompt).toContain('You are a safe space.');
    expect(ctx.db.agent.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'safe-space' } }));
  });

  it('caches the soul after first load', async () => {
    const ctx = createMockCtx({ soul: 'Cached soul.' });

    await loadExtractionSystemPrompt(ctx);
    await loadExtractionSystemPrompt(ctx);

    expect(ctx.db.agent.findFirst).toHaveBeenCalledTimes(1);
  });

  it('returns extraction identity without soul when agent not found', async () => {
    const ctx = createMockCtx(null);
    const prompt = await loadExtractionSystemPrompt(ctx);

    expect(prompt).toContain('literary analysis tool');
    expect(prompt).not.toContain('Content Permissions');
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('safe-space agent not found'));
  });
});
