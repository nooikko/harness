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
    type: 'string' as const,
    label: 'Default Speaker',
    description: 'Name of the default Cast device for announcements. Leave empty to use the first discovered device.',
    default: '',
  },
  audioServerPort: {
    type: 'number' as const,
    label: 'Audio Server Port',
    description: 'Port for the local HTTP server that serves generated audio to Cast devices.',
    default: 9849,
  },
});
