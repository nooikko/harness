import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpsert = vi.fn();
vi.mock('@harness/database', () => ({
  prisma: {
    agentConfig: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

describe('updateAgentConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { success: true } and calls revalidatePath on successful upsert', async () => {
    mockUpsert.mockResolvedValueOnce({});

    const { updateAgentConfig } = await import('../update-agent-config');

    const result = await updateAgentConfig({
      agentId: 'agent-1',
      memoryEnabled: true,
      reflectionEnabled: false,
    });

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/agents');
  });

  it('passes correct arguments to prisma.agentConfig.upsert', async () => {
    mockUpsert.mockResolvedValueOnce({});

    const { updateAgentConfig } = await import('../update-agent-config');

    await updateAgentConfig({
      agentId: 'agent-42',
      memoryEnabled: false,
      reflectionEnabled: true,
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { agentId: 'agent-42' },
      create: { agentId: 'agent-42', memoryEnabled: false, reflectionEnabled: true },
      update: { memoryEnabled: false, reflectionEnabled: true },
    });
  });

  it("returns { error: 'Failed to update agent configuration' } when prisma throws", async () => {
    mockUpsert.mockRejectedValueOnce(new Error('DB connection failed'));

    const { updateAgentConfig } = await import('../update-agent-config');

    const result = await updateAgentConfig({
      agentId: 'agent-1',
      memoryEnabled: true,
      reflectionEnabled: false,
    });

    expect(result).toEqual({ error: 'Failed to update agent configuration' });
  });

  it('does not call revalidatePath when prisma throws', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('DB error'));

    const { updateAgentConfig } = await import('../update-agent-config');

    await updateAgentConfig({
      agentId: 'agent-1',
      memoryEnabled: true,
      reflectionEnabled: false,
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
