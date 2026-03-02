import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    agent: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { createAgent } = await import('../create-agent');

describe('createAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an agent and returns the new agent id', async () => {
    mockCreate.mockResolvedValue({ id: 'new-agent-1' });

    const result = await createAgent({
      slug: 'my-agent',
      name: 'My Agent',
      soul: '# Soul',
      identity: '# Identity',
    });

    expect(result).toEqual({ agentId: 'new-agent-1' });
  });

  it('revalidates /agents path on success', async () => {
    mockCreate.mockResolvedValue({ id: 'new-agent-1' });

    await createAgent({
      slug: 'my-agent',
      name: 'My Agent',
      soul: '# Soul',
      identity: '# Identity',
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/agents');
  });

  it('passes all fields to prisma including optional ones', async () => {
    mockCreate.mockResolvedValue({ id: 'new-agent-2' });

    await createAgent({
      slug: 'full-agent',
      name: 'Full Agent',
      soul: 'soul content',
      identity: 'identity content',
      role: 'Engineer',
      goal: 'Ship software',
      backstory: 'Some backstory',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        slug: 'full-agent',
        name: 'Full Agent',
        soul: 'soul content',
        identity: 'identity content',
        role: 'Engineer',
        goal: 'Ship software',
        backstory: 'Some backstory',
      },
    });
  });

  it('sets optional fields to null when not provided', async () => {
    mockCreate.mockResolvedValue({ id: 'new-agent-3' });

    await createAgent({
      slug: 'minimal-agent',
      name: 'Minimal Agent',
      soul: 'soul',
      identity: 'identity',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: null,
        goal: null,
        backstory: null,
      }),
    });
  });

  describe('slug validation', () => {
    it('rejects slugs with uppercase letters', async () => {
      const result = await createAgent({
        slug: 'My-Agent',
        name: 'My Agent',
        soul: '# Soul',
        identity: '# Identity',
      });

      expect(result).toEqual({ error: 'Slug must be lowercase letters, numbers, and hyphens only' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('rejects slugs with spaces', async () => {
      const result = await createAgent({
        slug: 'my agent',
        name: 'My Agent',
        soul: '# Soul',
        identity: '# Identity',
      });

      expect(result).toEqual({ error: 'Slug must be lowercase letters, numbers, and hyphens only' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('rejects slugs with special characters', async () => {
      const result = await createAgent({
        slug: 'my_agent!',
        name: 'My Agent',
        soul: '# Soul',
        identity: '# Identity',
      });

      expect(result).toEqual({ error: 'Slug must be lowercase letters, numbers, and hyphens only' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('accepts valid slugs with lowercase letters, numbers, and hyphens', async () => {
      mockCreate.mockResolvedValue({ id: 'new-agent-4' });

      const result = await createAgent({
        slug: 'my-agent-123',
        name: 'My Agent',
        soul: '# Soul',
        identity: '# Identity',
      });

      expect(result).toEqual({ agentId: 'new-agent-4' });
    });
  });

  describe('duplicate slug error', () => {
    it('returns a friendly error when the slug is already taken', async () => {
      mockCreate.mockRejectedValue(new Error('Unique constraint failed on the fields: (`slug`)'));

      const result = await createAgent({
        slug: 'taken-slug',
        name: 'My Agent',
        soul: '# Soul',
        identity: '# Identity',
      });

      expect(result).toEqual({ error: 'Slug "taken-slug" is already taken' });
    });

    it('returns a generic error for other database failures', async () => {
      mockCreate.mockRejectedValue(new Error('Connection refused'));

      const result = await createAgent({
        slug: 'my-agent',
        name: 'My Agent',
        soul: '# Soul',
        identity: '# Identity',
      });

      expect(result).toEqual({ error: 'Failed to create agent' });
    });
  });
});
