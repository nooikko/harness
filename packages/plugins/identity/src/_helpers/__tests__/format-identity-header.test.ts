import { describe, expect, it } from 'vitest';
import { formatIdentityHeader } from '../format-identity-header';

const makeAgent = (
  overrides: Partial<{
    id: string;
    slug: string;
    name: string;
    version: number;
    enabled: boolean;
    soul: string;
    identity: string;
    userContext: string | null;
    role: string | null;
    goal: string | null;
    backstory: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) => ({
  id: 'agent-1',
  slug: 'test-agent',
  name: 'Test Agent',
  version: 1,
  enabled: true,
  soul: 'Soul content here',
  identity: 'Identity content here',
  userContext: null,
  role: null,
  goal: null,
  backstory: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeMemory = (content: string, type: 'EPISODIC' | 'SEMANTIC' | 'REFLECTION' = 'EPISODIC') => ({
  id: 'mem-1',
  agentId: 'agent-1',
  content,
  type,
  importance: 7,
  threadId: null,
  sourceMemoryIds: [],
  createdAt: new Date('2026-02-15T10:00:00Z'),
  lastAccessedAt: new Date('2026-02-15T10:00:00Z'),
});

describe('formatIdentityHeader', () => {
  it('includes agent name in the header', () => {
    const agent = makeAgent({ name: 'Aria' });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('Aria');
  });

  it('includes soul content in the output', () => {
    const agent = makeAgent({ soul: 'My soul content' });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('My soul content');
  });

  it('includes identity content in the output', () => {
    const agent = makeAgent({ identity: 'My identity content' });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('My identity content');
  });

  it('truncates soul at soulMaxChars', () => {
    const longSoul = 'A'.repeat(10000);
    const agent = makeAgent({ soul: longSoul });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 100, identityMaxChars: 2000 });
    expect(result).toContain('A'.repeat(100));
    expect(result).not.toContain('A'.repeat(101));
  });

  it('truncates identity at identityMaxChars', () => {
    const longIdentity = 'B'.repeat(5000);
    const agent = makeAgent({ identity: longIdentity });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 50 });
    expect(result).toContain('B'.repeat(50));
    expect(result).not.toContain('B'.repeat(51));
  });

  it('does not include memories section when memories array is empty', () => {
    const agent = makeAgent();
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).not.toContain('## Relevant Memory');
  });

  it('includes memories section when memories are provided', () => {
    const agent = makeAgent({ name: 'Aria' });
    const memories = [makeMemory('Discussed project requirements')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('## Relevant Memory');
    expect(result).toContain('Discussed project requirements');
  });

  it('formats memory lines with date, type, and content', () => {
    const agent = makeAgent();
    const memories = [makeMemory('A key insight', 'SEMANTIC')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('[2026-02-15]');
    expect(result).toContain('[SEMANTIC]');
    expect(result).toContain('A key insight');
  });

  it('includes userContext section when agent has userContext', () => {
    const agent = makeAgent({ userContext: 'The user prefers dark mode and concise responses.' });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('## User Context');
    expect(result).toContain('The user prefers dark mode and concise responses.');
  });

  it('does not include userContext section when userContext is null', () => {
    const agent = makeAgent({ userContext: null });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).not.toContain('## User Context');
  });

  it('includes Chain of Persona instruction', () => {
    const agent = makeAgent({ name: 'Aria' });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('Before responding, briefly consider');
    expect(result).toContain('Aria');
  });
});
