import { createSettingsSchema, type SettingsFieldDefs } from '@harness/plugin-contract';

export const settingsFields = {
  customPrompt: {
    type: 'string' as const,
    label: 'Custom Naming Prompt',
    description: 'Override the default thread naming prompt. The user message will be appended. Leave empty for the default prompt.',
  },
} satisfies SettingsFieldDefs;

export const settingsSchema = createSettingsSchema(settingsFields);
