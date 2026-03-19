import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  customRubric: {
    type: 'string' as const,
    label: 'Custom Validation Rubric',
    description: 'Override the default validation rubric prompt used to evaluate delegated task outputs. Leave empty for the default rubric.',
  },
  model: {
    type: 'string' as const,
    label: 'Validation Model',
    description: 'Model to use for validation invocations. Defaults to claude-opus-4-6.',
  },
});
