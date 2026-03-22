import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    storyCharacter: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { updateStoryCharacter } = await import('../update-story-character');

describe('updateStoryCharacter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on a successful update', async () => {
    mockUpdate.mockResolvedValue({});

    const result = await updateStoryCharacter({ id: 'char-1', personality: 'Brave' });

    expect(result).toEqual({ success: true });
  });

  it('revalidates /stories path on success', async () => {
    mockUpdate.mockResolvedValue({});

    await updateStoryCharacter({ id: 'char-1', personality: 'Brave' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/stories');
  });

  it('passes only provided fields to prisma', async () => {
    mockUpdate.mockResolvedValue({});

    await updateStoryCharacter({ id: 'char-1', personality: 'Brave' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'char-1' },
      data: { personality: 'Brave' },
    });
  });

  it('passes multiple fields at once', async () => {
    mockUpdate.mockResolvedValue({});

    await updateStoryCharacter({
      id: 'char-1',
      personality: 'Brave',
      appearance: 'Tall',
      color: '#00ff00',
      status: 'deceased',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'char-1' },
      data: {
        personality: 'Brave',
        appearance: 'Tall',
        color: '#00ff00',
        status: 'deceased',
      },
    });
  });

  it('passes all supported fields', async () => {
    mockUpdate.mockResolvedValue({});

    await updateStoryCharacter({
      id: 'char-1',
      personality: 'Kind',
      appearance: 'Short',
      mannerisms: 'Fidgets',
      motives: 'Revenge',
      backstory: 'Orphan',
      relationships: 'Allied with Bob',
      color: '#0000ff',
      status: 'active',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'char-1' },
      data: {
        personality: 'Kind',
        appearance: 'Short',
        mannerisms: 'Fidgets',
        motives: 'Revenge',
        backstory: 'Orphan',
        relationships: 'Allied with Bob',
        color: '#0000ff',
        status: 'active',
      },
    });
  });

  it('returns error when prisma throws', async () => {
    mockUpdate.mockRejectedValue(new Error('Record not found'));

    const result = await updateStoryCharacter({ id: 'missing-id', personality: 'Brave' });

    expect(result).toEqual({ error: 'Failed to update character' });
  });

  it('does not revalidate on failure', async () => {
    mockUpdate.mockRejectedValue(new Error('DB error'));

    await updateStoryCharacter({ id: 'char-1', personality: 'Brave' });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
