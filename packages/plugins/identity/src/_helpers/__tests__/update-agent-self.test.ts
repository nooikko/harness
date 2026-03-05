import { describe, expect, it, vi } from 'vitest';
import { updateAgentSelf } from '../update-agent-self';

const makeMockDb = () => ({
  thread: { findUnique: vi.fn() },
  agent: { update: vi.fn() },
  agentConfig: { upsert: vi.fn() },
});

describe('updateAgentSelf', () => {
  it('returns error message when thread has no agent', async () => {
    const db = makeMockDb();
    db.thread.findUnique.mockResolvedValue({ agentId: null });

    const result = await updateAgentSelf(db as never, 'thread-1', {
      name: 'New Name',
    });

    expect(result).toBe('(this thread has no assigned agent)');
    expect(db.agent.update).not.toHaveBeenCalled();
    expect(db.agentConfig.upsert).not.toHaveBeenCalled();
  });

  it('updates agent name and slug, sets bootstrapped', async () => {
    const db = makeMockDb();
    db.thread.findUnique.mockResolvedValue({ agentId: 'agent-1' });
    db.agent.update.mockResolvedValue({ name: 'Cool Bot' });
    db.agentConfig.upsert.mockResolvedValue({});

    const result = await updateAgentSelf(db as never, 'thread-1', {
      name: 'Cool Bot',
    });

    expect(result).toBe('Identity updated. I am now Cool Bot.');
    expect(db.agent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: { name: 'Cool Bot', slug: 'cool-bot' },
    });
    expect(db.agentConfig.upsert).toHaveBeenCalledWith({
      where: { agentId: 'agent-1' },
      update: { bootstrapped: true },
      create: {
        agentId: 'agent-1',
        memoryEnabled: true,
        reflectionEnabled: false,
        bootstrapped: true,
      },
    });
  });

  it('updates soul and identity without changing slug', async () => {
    const db = makeMockDb();
    db.thread.findUnique.mockResolvedValue({ agentId: 'agent-2' });
    db.agent.update.mockResolvedValue({ name: 'Existing Agent' });
    db.agentConfig.upsert.mockResolvedValue({});

    await updateAgentSelf(db as never, 'thread-1', {
      soul: 'I am a helpful assistant',
      identity: 'Professional and kind',
    });

    const updateCall = db.agent.update.mock.calls[0]?.[0];
    expect(updateCall?.data).toEqual({
      soul: 'I am a helpful assistant',
      identity: 'Professional and kind',
    });
    expect(updateCall?.data).not.toHaveProperty('slug');
    expect(updateCall?.data).not.toHaveProperty('name');
  });

  it('generates valid kebab-case slug from name with spaces and capitals', async () => {
    const db = makeMockDb();
    db.thread.findUnique.mockResolvedValue({ agentId: 'agent-3' });
    db.agent.update.mockResolvedValue({ name: 'My Cool Bot' });
    db.agentConfig.upsert.mockResolvedValue({});

    await updateAgentSelf(db as never, 'thread-1', {
      name: 'My Cool Bot',
    });

    expect(db.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'my-cool-bot' }),
      }),
    );
  });

  it('updates role, goal, and backstory fields', async () => {
    const db = makeMockDb();
    db.thread.findUnique.mockResolvedValue({ agentId: 'agent-5' });
    db.agent.update.mockResolvedValue({ name: 'Agent' });
    db.agentConfig.upsert.mockResolvedValue({});

    await updateAgentSelf(db as never, 'thread-1', {
      role: 'Research assistant',
      goal: 'Help with analysis',
      backstory: 'Trained on scientific literature',
    });

    const updateCall = db.agent.update.mock.calls[0]?.[0];
    expect(updateCall?.data).toEqual({
      role: 'Research assistant',
      goal: 'Help with analysis',
      backstory: 'Trained on scientific literature',
    });
  });

  it('handles empty input gracefully and still sets bootstrapped', async () => {
    const db = makeMockDb();
    db.thread.findUnique.mockResolvedValue({ agentId: 'agent-4' });
    db.agent.update.mockResolvedValue({ name: 'Unchanged' });
    db.agentConfig.upsert.mockResolvedValue({});

    const result = await updateAgentSelf(db as never, 'thread-1', {});

    expect(result).toBe('Identity updated. I am now Unchanged.');
    expect(db.agent.update).toHaveBeenCalledWith({
      where: { id: 'agent-4' },
      data: {},
    });
    expect(db.agentConfig.upsert).toHaveBeenCalled();
  });
});
