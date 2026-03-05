import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  messageLimit: {
    type: 'number' as const,
    label: 'Message Extraction Limit',
    description: 'Maximum number of messages extracted during an audit. Higher values capture more history but use more tokens.',
    default: 200,
  },
  duplicateGuardSeconds: {
    type: 'number' as const,
    label: 'Duplicate Guard (seconds)',
    description: 'Minimum seconds between audit extractions for the same thread.',
    default: 60,
  },
});
