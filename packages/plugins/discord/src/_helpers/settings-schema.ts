import { createSettingsSchema, type SettingsFieldDefs } from '@harness/plugin-contract';

export const settingsFields = {
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
  ownerDiscordUserId: {
    type: 'string' as const,
    label: 'Owner Discord User ID',
    description:
      'Your Discord user ID. Enables proactive DM delivery for cron outputs and notifications. Right-click your profile in Discord → Copy User ID.',
    required: false,
  },
} satisfies SettingsFieldDefs;

export const settingsSchema = createSettingsSchema(settingsFields);
