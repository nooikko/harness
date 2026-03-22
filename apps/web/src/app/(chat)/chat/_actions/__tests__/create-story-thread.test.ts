import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoryFindUniqueOrThrow = vi.fn();
const mockCharacterFindMany = vi.fn();
const mockMomentFindMany = vi.fn();
const mockThreadFindFirst = vi.fn();
const mockMessageFindMany = vi.fn();
const mockThreadCreate = vi.fn();
const mockMessageCreate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    story: {
      findUniqueOrThrow: (...args: unknown[]) => mockStoryFindUniqueOrThrow(...args),
    },
    storyCharacter: {
      findMany: (...args: unknown[]) => mockCharacterFindMany(...args),
    },
    storyMoment: {
      findMany: (...args: unknown[]) => mockMomentFindMany(...args),
    },
    thread: {
      findFirst: (...args: unknown[]) => mockThreadFindFirst(...args),
      create: (...args: unknown[]) => mockThreadCreate(...args),
    },
    message: {
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
      create: (...args: unknown[]) => mockMessageCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { createStoryThread } = await import('../create-story-thread');

describe('createStoryThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStoryFindUniqueOrThrow.mockResolvedValue({
      premise: 'A dark fantasy tale',
      storyTime: 'Midnight',
      agentId: 'agent-1',
      name: 'The Dark Saga',
    });
    mockCharacterFindMany.mockResolvedValue([]);
    mockMomentFindMany.mockResolvedValue([]);
    mockThreadFindFirst.mockResolvedValue(null);
    mockMessageFindMany.mockResolvedValue([]);
    mockThreadCreate.mockResolvedValue({ id: 'new-thread-1' });
    mockMessageCreate.mockResolvedValue({ id: 'recap-msg-1' });
  });

  it('creates a thread with storytelling kind and storyId', async () => {
    const result = await createStoryThread('story-1');

    expect(mockThreadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'storytelling',
        storyId: 'story-1',
        agentId: 'agent-1',
        source: 'web',
        status: 'active',
      }),
    });
    expect(result).toEqual({ threadId: 'new-thread-1' });
  });

  it('creates a recap message as the first message', async () => {
    await createStoryThread('story-1');

    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        threadId: 'new-thread-1',
        role: 'system',
        kind: 'recap',
      }),
    });

    const createCall = mockMessageCreate.mock.calls[0]![0];
    expect(createCall.data.content).toContain('Story Recap');
  });

  it('includes story premise in the recap', async () => {
    await createStoryThread('story-1');

    const createCall = mockMessageCreate.mock.calls[0]![0];
    expect(createCall.data.content).toContain('A dark fantasy tale');
  });

  it('includes characters in the recap', async () => {
    mockCharacterFindMany.mockResolvedValue([{ name: 'Elena', personality: 'brave', appearance: 'tall', status: 'active' }]);

    await createStoryThread('story-1');

    const createCall = mockMessageCreate.mock.calls[0]![0];
    expect(createCall.data.content).toContain('Elena');
  });

  it('includes moments in the recap', async () => {
    mockMomentFindMany.mockResolvedValue([
      {
        summary: 'The great battle began',
        storyTime: 'Dawn',
        characters: [{ characterName: 'Elena' }],
      },
    ]);

    await createStoryThread('story-1');

    const createCall = mockMessageCreate.mock.calls[0]![0];
    expect(createCall.data.content).toContain('The great battle began');
  });

  it('loads recent messages from the latest thread in the story', async () => {
    mockThreadFindFirst.mockResolvedValue({ id: 'prev-thread' });
    mockMessageFindMany.mockResolvedValue([
      { role: 'assistant', content: 'The door creaked open.' },
      { role: 'user', content: 'She stepped inside.' },
    ]);

    await createStoryThread('story-1');

    expect(mockThreadFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 'story-1' },
      }),
    );
    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          threadId: 'prev-thread',
        }),
      }),
    );

    const createCall = mockMessageCreate.mock.calls[0]![0];
    expect(createCall.data.content).toContain('The door creaked open.');
  });

  it('handles empty story with no characters, moments, or threads', async () => {
    mockStoryFindUniqueOrThrow.mockResolvedValue({
      premise: null,
      storyTime: null,
      agentId: null,
      name: 'Empty Story',
    });

    const result = await createStoryThread('story-1');

    expect(result).toEqual({ threadId: 'new-thread-1' });
    const createCall = mockMessageCreate.mock.calls[0]![0];
    expect(createCall.data.content).toContain('No story context available yet.');
  });

  it('names the thread with story name + (continued)', async () => {
    await createStoryThread('story-1');

    expect(mockThreadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'The Dark Saga (continued)',
      }),
    });
  });

  it('revalidates the root path', async () => {
    await createStoryThread('story-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });
});
