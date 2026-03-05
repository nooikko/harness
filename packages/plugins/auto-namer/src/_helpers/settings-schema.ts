import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  customPrompt: {
    type: 'string' as const,
    label: 'Custom Naming Prompt',
    description: 'Override the default thread naming prompt. The user message will be appended. Leave empty for the default prompt.',
  },
});
