import { createSettingsSchema, type SettingsFieldDefs } from '@harness/plugin-contract';

export const settingsFields = {
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
} satisfies SettingsFieldDefs;

export const settingsSchema = createSettingsSchema(settingsFields);
