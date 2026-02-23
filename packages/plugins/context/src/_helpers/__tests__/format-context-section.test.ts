import { describe, expect, it } from 'vitest';
import { formatContextSection } from '../format-context-section';

describe('formatContextSection', () => {
  it('formats multiple context files into markdown', () => {
    const files = [
      { name: 'memory.md', content: 'Memory data' },
      { name: 'inbox.md', content: 'Inbox data' },
    ];

    const result = formatContextSection(files);

    expect(result).toContain('# Context');
    expect(result).toContain('## memory.md');
    expect(result).toContain('Memory data');
    expect(result).toContain('## inbox.md');
    expect(result).toContain('Inbox data');
    expect(result).toContain('---');
  });

  it('returns empty string for no files', () => {
    expect(formatContextSection([])).toBe('');
  });

  it('formats single file without separator', () => {
    const files = [{ name: 'memory.md', content: 'Single file' }];

    const result = formatContextSection(files);

    expect(result).toBe('# Context\n\n## memory.md\n\nSingle file');
  });
});
