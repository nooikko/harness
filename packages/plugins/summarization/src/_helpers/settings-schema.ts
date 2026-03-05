import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  triggerCount: {
    type: 'number' as const,
    label: 'Trigger Count',
    description: 'Number of messages between automatic summarizations. Lower values summarize more frequently.',
    default: 50,
  },
  duplicateGuardSeconds: {
    type: 'number' as const,
    label: 'Duplicate Guard (seconds)',
    description: 'Minimum seconds between summaries to prevent double-summarization.',
    default: 60,
  },
  customPrompt: {
    type: 'string' as const,
    label: 'Custom Summarization Prompt',
    description: 'Override the default summarization prompt. The conversation history will be appended after this text.',
  },
});
