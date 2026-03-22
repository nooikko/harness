import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleCorrectMoment } from '../tool-correct-moment';

const createMockCtx = () =>
  ({
    db: {
      storyMoment: {
        findFirst: vi.fn().mockResolvedValue({ id: 'mom-1', summary: 'Original moment' }),
        update: vi.fn().mockResolvedValue({}),
      },
      characterInMoment: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({}),
      },
      storyCharacter: {
        findFirst: vi.fn().mockResolvedValue({ id: 'char-1' }),
      },
    } as never,
  }) as unknown as PluginContext;

describe('handleCorrectMoment', () => {
  it('updates allowed fields', async () => {
    const ctx = createMockCtx();
    const result = await handleCorrectMoment(ctx, 'story-1', {
      momentId: 'mom-1',
      corrections: { summary: 'Corrected summary', storyTime: 'Day 8' },
    });

    expect(result).toContain('Updated fields');
    expect(result).toContain('summary');
    expect(result).toContain('storyTime');
    expect(ctx.db.storyMoment.update).toHaveBeenCalledWith({
      where: { id: 'mom-1' },
      data: { summary: 'Corrected summary', storyTime: 'Day 8' },
    });
  });

  it('ignores disallowed fields', async () => {
    const ctx = createMockCtx();
    await handleCorrectMoment(ctx, 'story-1', {
      momentId: 'mom-1',
      corrections: { id: 'hacked', storyId: 'hacked', summary: 'ok' },
    });

    expect(ctx.db.storyMoment.update).toHaveBeenCalledWith({
      where: { id: 'mom-1' },
      data: { summary: 'ok' },
    });
  });

  it('removes phantom characters', async () => {
    const ctx = createMockCtx();
    const result = await handleCorrectMoment(ctx, 'story-1', {
      momentId: 'mom-1',
      removeCharacters: ['PhantomGirl'],
    });

    expect(result).toContain('Removed 1 character');
    expect(result).toContain('PhantomGirl');
    expect(ctx.db.characterInMoment.deleteMany).toHaveBeenCalledWith({
      where: {
        momentId: 'mom-1',
        characterName: { equals: 'PhantomGirl', mode: 'insensitive' },
      },
    });
  });

  it('adds missing characters with resolved IDs', async () => {
    const ctx = createMockCtx();
    const result = await handleCorrectMoment(ctx, 'story-1', {
      momentId: 'mom-1',
      addCharacters: [{ name: 'Mei', role: 'witness' }],
    });

    expect(result).toContain('Added 1 character');
    expect(result).toContain('Mei');
    expect(ctx.db.characterInMoment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        momentId: 'mom-1',
        characterName: 'Mei',
        role: 'witness',
        characterId: 'char-1',
      }),
    });
  });

  it('adds characters without ID when not found in DB', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.db.storyCharacter.findFirst).mockResolvedValue(null);

    await handleCorrectMoment(ctx, 'story-1', {
      momentId: 'mom-1',
      addCharacters: [{ name: 'NewGirl', role: 'observer' }],
    });

    expect(ctx.db.characterInMoment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        characterName: 'NewGirl',
        role: 'observer',
      }),
    });
    // Should NOT have characterId
    const call = vi.mocked(ctx.db.characterInMoment.create).mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data.characterId).toBeUndefined();
  });

  it('returns error when moment not found', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.db.storyMoment.findFirst).mockResolvedValue(null);

    const result = await handleCorrectMoment(ctx, 'story-1', { momentId: 'missing' });

    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('returns message when no corrections provided', async () => {
    const ctx = createMockCtx();
    const result = await handleCorrectMoment(ctx, 'story-1', { momentId: 'mom-1' });

    expect(result).toContain('No corrections provided');
  });

  it('returns error for empty momentId', async () => {
    const ctx = createMockCtx();
    const result = await handleCorrectMoment(ctx, 'story-1', { momentId: '' });

    expect(result).toContain('Error');
  });
});
