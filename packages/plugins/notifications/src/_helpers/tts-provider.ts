// --- Types ---

export type TtsProvider = {
  name: string;
  generate: (text: string, voice: string) => Promise<Buffer>;
  listVoices: () => Promise<string[]>;
};

type CreateTtsProvider = (providerName?: string) => TtsProvider;

import { edgeTtsProvider } from './edge-tts-provider';

// --- Provider registry ---

const providers: Record<string, TtsProvider> = {
  'edge-tts': edgeTtsProvider,
};

// --- Factory ---

export const createTtsProvider: CreateTtsProvider = (providerName = 'edge-tts') => {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unknown TTS provider: "${providerName}"`);
  }
  return provider;
};
