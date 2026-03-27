import { createSettingsSchema, type SettingsFieldDefs } from '@harness/plugin-contract';

export const settingsFields = {
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
} satisfies SettingsFieldDefs;

export const settingsSchema = createSettingsSchema(settingsFields);
