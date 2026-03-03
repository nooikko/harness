import { describe, expect, it, vi } from 'vitest';
import { loadAgentConfig } from '../load-agent-config';

const makeMockDb = (configResult: unknown) => ({
  agentConfig: {
    findUnique: vi.fn().mockResolvedValue(configResult),
  },
});

describe('loadAgentConfig', () => {
  it('calls findUnique with the correct agentId where clause', async () => {
    const db = makeMockDb(null);
    await loadAgentConfig(db as never, 'agent-42');
    expect(db.agentConfig.findUnique).toHaveBeenCalledWith({
      where: { agentId: 'agent-42' },
    });
  });

  it('returns the config when it exists', async () => {
    const config = {
      id: 'cfg-1',
      agentId: 'agent-1',
      memoryEnabled: true,
      reflectionEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = makeMockDb(config);
    const result = await loadAgentConfig(db as never, 'agent-1');
    expect(result).toEqual(config);
  });

  it('returns null when no config exists for the agent', async () => {
    const db = makeMockDb(null);
    const result = await loadAgentConfig(db as never, 'agent-missing');
    expect(result).toBeNull();
  });
});
