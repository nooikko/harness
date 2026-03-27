import { createSettingsSchema } from '@harness/plugin-contract';
import { VOICE_OPTIONS } from './edge-tts-provider';

export const settingsFields = {
  ttsProvider: {
    type: 'select' as const,
    label: 'TTS Provider',
    description: 'Text-to-speech engine for generating announcements. edge-tts is free and fast.',
    default: 'edge-tts',
    options: [{ label: 'Microsoft Edge TTS (free)', value: 'edge-tts' }],
  },
  voice: {
    type: 'select' as const,
    label: 'Voice',
    description: 'Voice for text-to-speech announcements.',
    default: 'en-US-AvaMultilingualNeural',
    options: VOICE_OPTIONS,
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
    default: '__auto__',
    options: [{ label: 'First available', value: '__auto__' }],
    fetchOptionsUrl: '/api/plugins/notifications/devices',
  },
};

export const settingsSchema = createSettingsSchema(settingsFields);
