import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  apiKey: {
    type: 'string',
    label: 'Govee API Key',
    description: 'API key from Govee Home App (Settings → Apply for API Key).',
    secret: true,
  },
  defaultTransitionMs: {
    type: 'number',
    label: 'Default Transition (ms)',
    description: 'Default transition duration for light changes in milliseconds. 0 for instant.',
    default: 400,
  },
});

export type GoveeSettings = {
  apiKey?: string;
  defaultTransitionMs?: number;
};
