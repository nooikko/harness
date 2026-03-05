import { describe, expect, it } from 'vitest';
import { formatBootstrapPrompt } from '../format-bootstrap-prompt';

describe('formatBootstrapPrompt', () => {
  it('contains identity__update_self tool reference', () => {
    const result = formatBootstrapPrompt('Assistant');
    expect(result).toContain('identity__update_self');
  });

  it('includes the current agent name passed as parameter', () => {
    const result = formatBootstrapPrompt('Harness');
    expect(result).toContain('Harness');
  });

  it('contains onboarding topics about name and personality', () => {
    const result = formatBootstrapPrompt('Assistant');
    expect(result).toContain('Name');
    expect(result).toContain('Personality');
    expect(result).toContain('Role');
  });

  it('returns a non-empty string longer than 100 chars', () => {
    const result = formatBootstrapPrompt('Bot');
    expect(result.length).toBeGreaterThan(100);
  });

  it('works with different agent names', () => {
    const bot = formatBootstrapPrompt('Bot');
    expect(bot).toContain('"Bot"');

    const nova = formatBootstrapPrompt('Nova');
    expect(nova).toContain('"Nova"');
  });
});
