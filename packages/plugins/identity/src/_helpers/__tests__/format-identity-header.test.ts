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

const makeMemory = (content: string, type: 'EPISODIC' | 'SEMANTIC' | 'REFLECTION' = 'EPISODIC', scope: 'AGENT' | 'PROJECT' | 'THREAD' = 'AGENT') => ({
  id: 'mem-1',
  agentId: 'agent-1',
  content,
  type,
  scope,
  importance: 7,
  threadId: null,
  projectId: null,
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

  it('formats EPISODIC memory lines with date, type, and content', () => {
    const agent = makeAgent();
    const memories = [makeMemory('A key insight', 'EPISODIC')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('[2026-02-15]');
    expect(result).toContain('[EPISODIC]');
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

  it('includes role, goal, and backstory when set', () => {
    const agent = makeAgent({
      role: 'Senior engineer',
      goal: 'Ship reliable software',
      backstory: 'Started coding at age 12',
    });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('## Role\n\nSenior engineer');
    expect(result).toContain('## Goal\n\nShip reliable software');
    expect(result).toContain('## Backstory\n\nStarted coding at age 12');
  });

  it('omits role, goal, and backstory when null', () => {
    const agent = makeAgent({ role: null, goal: null, backstory: null });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).not.toContain('## Role');
    expect(result).not.toContain('## Goal');
    expect(result).not.toContain('## Backstory');
  });

  it('omits role, goal, and backstory when empty string', () => {
    const agent = makeAgent({ role: '', goal: '', backstory: '' });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).not.toContain('## Role');
    expect(result).not.toContain('## Goal');
    expect(result).not.toContain('## Backstory');
  });

  it('places role/goal/backstory after userContext and before memories', () => {
    const agent = makeAgent({
      userContext: 'Prefers concise responses',
      role: 'Mentor',
      goal: 'Guide effectively',
      backstory: 'Years of experience',
    });
    const memories = [makeMemory('Had a great session')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    const userContextIdx = result.indexOf('## User Context');
    const roleIdx = result.indexOf('## Role');
    const goalIdx = result.indexOf('## Goal');
    const backstoryIdx = result.indexOf('## Backstory');
    const memoryIdx = result.indexOf('## Relevant Memory');
    expect(userContextIdx).toBeLessThan(roleIdx);
    expect(roleIdx).toBeLessThan(goalIdx);
    expect(goalIdx).toBeLessThan(backstoryIdx);
    expect(backstoryIdx).toBeLessThan(memoryIdx);
  });

  it('includes Chain of Persona instruction', () => {
    const agent = makeAgent({ name: 'Aria' });
    const result = formatIdentityHeader(agent, [], { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('Before responding, briefly consider');
    expect(result).toContain('Aria');
  });

  // ── "What I Know About You" section (SEMANTIC memories) ─────────────

  it('renders SEMANTIC memories in "What I Know About You" section', () => {
    const agent = makeAgent();
    const memories = [makeMemory('User has ADD — keep responses concise and front-loaded', 'SEMANTIC')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('## What I Know About You');
    expect(result).toContain('- User has ADD — keep responses concise and front-loaded');
  });

  it('does not include date prefix for SEMANTIC memories', () => {
    const agent = makeAgent();
    const memories = [makeMemory('Prefers dark mode', 'SEMANTIC')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    const section = result.split('## What I Know About You')[1]!.split('##')[0]!;
    expect(section).not.toContain('[2026-02-15]');
    expect(section).not.toContain('[SEMANTIC]');
  });

  it('does not render SEMANTIC memories in "Relevant Memory" section', () => {
    const agent = makeAgent();
    const memories = [makeMemory('User insight here', 'SEMANTIC'), makeMemory('Episodic event here', 'EPISODIC')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    const relevantSection = result.split('## Relevant Memory')[1] ?? '';
    expect(relevantSection).not.toContain('User insight here');
    expect(relevantSection).toContain('Episodic event here');
  });

  it('omits "What I Know About You" when no SEMANTIC memories exist', () => {
    const agent = makeAgent();
    const memories = [makeMemory('Just an episodic memory', 'EPISODIC')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).not.toContain('## What I Know About You');
  });

  it('places "What I Know About You" before "Relevant Memory"', () => {
    const agent = makeAgent();
    const memories = [makeMemory('User fact', 'SEMANTIC'), makeMemory('Episodic event', 'EPISODIC')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    const knowIdx = result.indexOf('## What I Know About You');
    const memoryIdx = result.indexOf('## Relevant Memory');
    expect(knowIdx).toBeLessThan(memoryIdx);
  });

  // ── Multi-scope grouping tests ──────────────────────────────────────

  it('groups AGENT memories under "Core" subsection', () => {
    const agent = makeAgent();
    const memories = [makeMemory('Agent-level insight', 'EPISODIC', 'AGENT')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('### Core');
    expect(result).toContain('Agent-level insight');
  });

  it('groups PROJECT memories under "Project Context" subsection', () => {
    const agent = makeAgent();
    const memories = [makeMemory('Project-specific finding', 'EPISODIC', 'PROJECT')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('### Project Context');
    expect(result).toContain('Project-specific finding');
  });

  it('groups THREAD memories under "This Conversation" subsection', () => {
    const agent = makeAgent();
    const memories = [makeMemory('Thread-local observation', 'EPISODIC', 'THREAD')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('### This Conversation');
    expect(result).toContain('Thread-local observation');
  });

  it('renders all three scope subsections when memories span all scopes', () => {
    const agent = makeAgent();
    const memories = [
      makeMemory('Core personality trait', 'REFLECTION', 'AGENT'),
      makeMemory('Project API pattern', 'EPISODIC', 'PROJECT'),
      makeMemory('Current task context', 'EPISODIC', 'THREAD'),
    ];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('### Core');
    expect(result).toContain('### Project Context');
    expect(result).toContain('### This Conversation');
    // Verify ordering: Core before Project before Thread
    const coreIdx = result.indexOf('### Core');
    const projectIdx = result.indexOf('### Project Context');
    const threadIdx = result.indexOf('### This Conversation');
    expect(coreIdx).toBeLessThan(projectIdx);
    expect(projectIdx).toBeLessThan(threadIdx);
  });

  it('omits scope subsections that have no memories', () => {
    const agent = makeAgent();
    const memories = [makeMemory('Only agent memory', 'EPISODIC', 'AGENT')];
    const result = formatIdentityHeader(agent, memories, { soulMaxChars: 5000, identityMaxChars: 2000 });
    expect(result).toContain('### Core');
    expect(result).not.toContain('### Project Context');
    expect(result).not.toContain('### This Conversation');
  });
});
