import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
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
});
