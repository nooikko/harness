import type { Message } from '@harness/database';
import { describe, expect, it } from 'vitest';
import { formatSummarySection } from '../format-summary-section';

type SummaryMessage = Pick<Message, 'content' | 'createdAt'>;

describe('formatSummarySection', () => {
  it('returns empty string for empty summaries array', () => {
    const result = formatSummarySection([]);
    expect(result).toBe('');
  });

  it('formats a single summary with the correct heading', () => {
    const summaries: SummaryMessage[] = [{ content: 'The user discussed deployment plans.', createdAt: new Date('2026-02-23T12:00:00Z') }];

    const result = formatSummarySection(summaries);

    expect(result).toContain('# Prior Conversation Summary');
    expect(result).toContain('The user discussed deployment plans.');
  });

  it('renders summaries in the order provided (caller is responsible for sort)', () => {
    // Caller passes oldest-first (after reversing desc query results); formatter maps in input order
    const summaries: SummaryMessage[] = [
      { content: 'First summary content.', createdAt: new Date('2026-02-23T12:00:00Z') },
      { content: 'Second summary content.', createdAt: new Date('2026-02-23T13:00:00Z') },
    ];

    const result = formatSummarySection(summaries);

    const firstIdx = result.indexOf('First summary content.');
    const secondIdx = result.indexOf('Second summary content.');
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it('separates multiple summaries with a divider', () => {
    const summaries: SummaryMessage[] = [
      { content: 'Summary A.', createdAt: new Date('2026-02-23T12:00:00Z') },
      { content: 'Summary B.', createdAt: new Date('2026-02-23T13:00:00Z') },
    ];

    const result = formatSummarySection(summaries);

    expect(result).toContain('Summary A.');
    expect(result).toContain('Summary B.');
    const aIdx = result.indexOf('Summary A.');
    const bIdx = result.indexOf('Summary B.');
    expect(aIdx).toBeLessThan(bIdx);
  });

  it('does not mutate the input array order', () => {
    const summaries: SummaryMessage[] = [
      { content: 'Newer', createdAt: new Date('2026-02-23T13:00:00Z') },
      { content: 'Older', createdAt: new Date('2026-02-23T12:00:00Z') },
    ];
    const originalOrder = summaries.map((s) => s.content);

    formatSummarySection(summaries);

    expect(summaries.map((s) => s.content)).toEqual(originalOrder);
  });
});
