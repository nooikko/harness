// Formats a history result into a markdown conversation section

import type { HistoryResult } from './history-loader';

type FormatHistorySection = (result: HistoryResult) => string;

export const formatHistorySection: FormatHistorySection = (result) => {
  if (result.messages.length === 0) {
    return '';
  }

  const formatted = result.messages.map((m) => `[${m.role}]: ${m.content}`).join('\n\n');

  return `# Conversation History\n\n${formatted}`;
};
