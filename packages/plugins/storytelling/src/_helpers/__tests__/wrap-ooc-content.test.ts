import { describe, expect, it } from 'vitest';
import { wrapOocContent } from '../wrap-ooc-content';

describe('wrapOocContent', () => {
  it('wraps content in OOC tags', () => {
    const result = wrapOocContent('change the setting to nighttime');
    expect(result).toBe('[OUT OF CHARACTER — Author direction, not in-story]\nchange the setting to nighttime\n[END OOC]');
  });

  it('preserves content exactly', () => {
    const content = '  spaces and   tabs\t preserved  ';
    const result = wrapOocContent(content);
    expect(result).toContain(content);
  });

  it('handles multi-line content', () => {
    const content = 'line one\nline two\nline three';
    const result = wrapOocContent(content);
    expect(result).toBe('[OUT OF CHARACTER — Author direction, not in-story]\nline one\nline two\nline three\n[END OOC]');
  });
});
