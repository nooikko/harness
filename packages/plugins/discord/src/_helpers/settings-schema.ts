import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  botToken: {
    type: 'string' as const,
    label: 'Bot Token',
    description: 'Discord bot token from the Developer Portal. Stored encrypted at rest.',
    secret: true,
    required: true,
  },
  allowedChannelIds: {
    type: 'string' as const,
    label: 'Allowed Channel IDs',
    description: 'Comma-separated Discord channel IDs. When set, the bot only responds in these channels. Leave empty to allow all channels.',
    required: false,
  },
});
