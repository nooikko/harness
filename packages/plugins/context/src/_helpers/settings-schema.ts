import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  historyLimit: {
    type: 'number' as const,
    label: 'History Limit',
    description: 'Maximum messages loaded into context when no summaries exist.',
    default: 50,
  },
  historyLimitWithSummary: {
    type: 'number' as const,
    label: 'History Limit (with summary)',
    description: 'Maximum messages loaded when summaries are available. Lower than the default to save context window for the summary.',
    default: 25,
  },
  summaryLookback: {
    type: 'number' as const,
    label: 'Summary Lookback',
    description: 'Maximum number of prior summaries injected into the prompt.',
    default: 2,
  },
  maxFileSizeKb: {
    type: 'number' as const,
    label: 'Max File Size (KB)',
    description: 'Maximum size in KB for individual context files before truncation.',
    default: 50,
  },
});
