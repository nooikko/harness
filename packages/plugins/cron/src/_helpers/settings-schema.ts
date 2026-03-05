import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  timezone: {
    type: 'string' as const,
    label: 'Timezone',
    description: 'IANA timezone for cron schedule evaluation (e.g. America/Phoenix, UTC). Defaults to UTC.',
    default: 'UTC',
  },
});
