import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  youtubeAuth: {
    type: 'oauth' as const,
    label: 'YouTube Music Account',
    provider: 'youtube-music',
    description: 'Connect your YouTube Music account for playlists, liked songs, and personalized recommendations.',
  },
  cookie: {
    type: 'string' as const,
    label: 'YouTube Music Cookie (Fallback)',
    description: 'Browser cookie string for fallback authentication. Extract from DevTools Network tab.',
    secret: true,
  },
  poToken: {
    type: 'string' as const,
    label: 'PO Token (Manual Override)',
    description: 'Manual PO token override. Leave empty to auto-fetch from PO token server.',
    secret: true,
  },
  poTokenServerUrl: {
    type: 'string' as const,
    label: 'PO Token Server URL',
    description: 'URL of the bgutil-ytdlp-pot-provider sidecar for automatic PO token generation.',
    default: 'http://localhost:4416',
  },
  defaultVolume: {
    type: 'number' as const,
    label: 'Default Volume',
    description: 'Default volume for new Cast sessions (0-100).',
    default: 50,
  },
  radioEnabled: {
    type: 'boolean' as const,
    label: 'Radio / Autoplay',
    description: 'Automatically play related songs after the current track ends.',
    default: true,
  },
  audioQuality: {
    type: 'select' as const,
    label: 'Audio Quality',
    description: 'Preferred audio quality. "High" requires YouTube Music Premium.',
    default: 'auto',
    options: [
      { label: 'Auto (best available)', value: 'auto' },
      { label: 'High (Premium only)', value: 'high' },
      { label: 'Low (save bandwidth)', value: 'low' },
    ],
  },
});
