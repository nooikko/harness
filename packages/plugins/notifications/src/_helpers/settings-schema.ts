import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  ttsProvider: {
    type: 'select' as const,
    label: 'TTS Provider',
    description: 'Text-to-speech engine for generating announcements. edge-tts is free and fast.',
    default: 'edge-tts',
    options: [{ label: 'Microsoft Edge TTS (free)', value: 'edge-tts' }],
  },
  voice: {
    type: 'string' as const,
    label: 'Voice',
    description: 'Voice name for text-to-speech. Default: en-US-GuyNeural. Run "edge-tts --list-voices" for options.',
    default: 'en-US-GuyNeural',
  },
  volume: {
    type: 'number' as const,
    label: 'Announcement Volume',
    description: 'Volume for announcements (0-100). Cast device volume is set to this percentage.',
    default: 70,
  },
  defaultDevice: {
    type: 'select' as const,
    label: 'Default Speaker',
    description: 'Cast device for announcements. Leave on "First available" to auto-select.',
    default: '',
    options: [{ label: 'First available', value: '' }],
    fetchOptionsUrl: '/api/plugins/notifications/devices',
  },
});
