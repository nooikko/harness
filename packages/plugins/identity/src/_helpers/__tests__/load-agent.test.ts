import { describe, expect, it, vi } from 'vitest';
import { loadAgent } from '../load-agent';

const makeMockDb = (threadResult: unknown, agentResult: unknown) => ({
  thread: {
    findUnique: vi.fn().mockResolvedValue(threadResult),
  },
  agent: {
    findFirst: vi.fn().mockResolvedValue(agentResult),
  },
});

describe('loadAgent', () => {
  it('returns null when thread is not found', async () => {
    const db = makeMockDb(null, null);
    const result = await loadAgent(db as never, 'thread-1');
    expect(result).toBeNull();
    expect(db.agent.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when thread has no agentId', async () => {
    const db = makeMockDb({ agentId: null }, null);
    const result = await loadAgent(db as never, 'thread-1');
    expect(result).toBeNull();
    expect(db.agent.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when agent is disabled or not found', async () => {
    const db = makeMockDb({ agentId: 'agent-1' }, null);
    const result = await loadAgent(db as never, 'thread-1');
    expect(result).toBeNull();
    expect(db.agent.findFirst).toHaveBeenCalledWith({
      where: { id: 'agent-1', enabled: true },
    });
  });

  it('returns the agent when thread has agentId and agent is enabled', async () => {
    const agent = { id: 'agent-1', slug: 'test', name: 'Test Agent', enabled: true };
    const db = makeMockDb({ agentId: 'agent-1', projectId: null }, agent);
    const result = await loadAgent(db as never, 'thread-1');
    expect(result).toEqual({ ...agent, threadProjectId: null });
    expect(db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      select: { agentId: true, projectId: true },
    });
  });

  it('queries thread with correct threadId', async () => {
    const db = makeMockDb({ agentId: 'agent-2', projectId: 'proj-1' }, { id: 'agent-2', name: 'Agent Two', enabled: true });
    await loadAgent(db as never, 'thread-abc');
    expect(db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-abc' },
      select: { agentId: true, projectId: true },
    });
  });
});
