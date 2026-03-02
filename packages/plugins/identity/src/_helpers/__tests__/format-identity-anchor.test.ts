import { describe, expect, it } from 'vitest';
import { formatIdentityAnchor } from '../format-identity-anchor';

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
  soul: '# Be honest and helpful\nSecond line of soul.',
  identity: 'Identity content here',
  userContext: null,
  role: null,
  goal: null,
  backstory: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('formatIdentityAnchor', () => {
  it('includes the agent name in the anchor heading', () => {
    const agent = makeAgent({ name: 'Aria' });
    const result = formatIdentityAnchor(agent);
    expect(result).toContain('Aria');
    expect(result).toContain('## Aria — Behavioral Anchor');
  });

  it('includes the "You are <name>" identity statement', () => {
    const agent = makeAgent({ name: 'Orion' });
    const result = formatIdentityAnchor(agent);
    expect(result).toContain('You are Orion.');
  });

  it('extracts the core principle from the first non-empty soul line', () => {
    const agent = makeAgent({ soul: '# Be honest and helpful\nMore soul content.' });
    const result = formatIdentityAnchor(agent);
    expect(result).toContain('Core principle: Be honest and helpful');
  });

  it('strips markdown heading markers from the core principle', () => {
    const agent = makeAgent({ soul: '## My Core Value\nOther content.' });
    const result = formatIdentityAnchor(agent);
    expect(result).toContain('Core principle: My Core Value');
    // The heading uses ##, but the extracted core principle should not contain them
    expect(result).not.toContain('Core principle: ## My Core Value');
  });

  it('omits core principle line when soul starts with only whitespace lines', () => {
    const agent = makeAgent({ soul: '\n\n\n' });
    const result = formatIdentityAnchor(agent);
    expect(result).not.toContain('Core principle:');
  });

  it('omits core principle line when soul is empty', () => {
    const agent = makeAgent({ soul: '' });
    const result = formatIdentityAnchor(agent);
    expect(result).not.toContain('Core principle:');
  });

  it('includes the "stay true" reminder', () => {
    const agent = makeAgent();
    const result = formatIdentityAnchor(agent);
    expect(result).toContain('Stay true to your soul and identity above.');
  });

  it('uses the first non-empty line even when soul starts with blank lines', () => {
    const agent = makeAgent({ soul: '\n\nHumility above all\nMore content.' });
    const result = formatIdentityAnchor(agent);
    expect(result).toContain('Core principle: Humility above all');
  });
});
