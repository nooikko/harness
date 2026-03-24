import { describe, expect, it } from 'vitest';
import { createTtsProvider } from '../tts-provider';

describe('createTtsProvider', () => {
  it('returns the edge-tts provider by default', () => {
    const provider = createTtsProvider();
    expect(provider.name).toBe('edge-tts');
  });

  it('returns the edge-tts provider when explicitly requested', () => {
    const provider = createTtsProvider('edge-tts');
    expect(provider.name).toBe('edge-tts');
  });

  it('throws for unknown provider names', () => {
    expect(() => createTtsProvider('unknown-engine')).toThrow('Unknown TTS provider: "unknown-engine"');
  });

  it('returns a provider with generate and listVoices methods', () => {
    const provider = createTtsProvider();
    expect(typeof provider.generate).toBe('function');
    expect(typeof provider.listVoices).toBe('function');
  });
});
