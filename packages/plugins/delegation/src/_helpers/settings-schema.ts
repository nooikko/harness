import { createSettingsSchema, type SettingsFieldDefs } from '@harness/plugin-contract';

export const settingsFields = {
  maxIterations: {
    type: 'number' as const,
    label: 'Max Iterations',
    description: 'Maximum number of invoke-validate cycles per delegation before accepting the result.',
    default: 5,
  },
  costCapUsd: {
    type: 'number' as const,
    label: 'Cost Cap (USD)',
    description: 'Maximum cost in USD for a single delegation. The loop aborts if this limit is exceeded.',
    default: 5,
  },
} satisfies SettingsFieldDefs;

export const settingsSchema = createSettingsSchema(settingsFields);
