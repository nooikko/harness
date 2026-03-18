// Formats prior conversation summaries into a markdown section

import type { Message } from '@harness/database';

type FormatSummarySection = (summaries: Pick<Message, 'content' | 'createdAt'>[]) => string;

export const formatSummarySection: FormatSummarySection = (summaries) => {
  if (summaries.length === 0) {
    return '';
  }

  const items = summaries.map((s) => `[Summary from ${s.createdAt.toISOString()}]:\n${s.content}`).join('\n\n---\n\n');
  return `# Prior Conversation Summary\n\n${items}`;
};
