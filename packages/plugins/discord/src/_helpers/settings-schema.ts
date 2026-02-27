import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  botToken: {
    type: 'string' as const,
    label: 'Bot Token',
    description: 'Discord bot token from the Developer Portal. Stored encrypted at rest.',
    secret: true,
    required: true,
  },
});
