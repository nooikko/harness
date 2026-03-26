import { describe, expect, it } from 'vitest';
import { VOICE_OPTIONS } from '../edge-tts-provider';
import { settingsSchema } from '../settings-schema';

describe('settingsSchema', () => {
  it('exports a valid settings schema with toFieldArray', () => {
    const fields = settingsSchema.toFieldArray();
    expect(fields.length).toBeGreaterThan(0);
  });

  describe('voice field', () => {
    it('is a select type, not a string', () => {
      const fields = settingsSchema.toFieldArray();
      const voiceField = fields.find((f) => f.name === 'voice');
      expect(voiceField).toBeDefined();
      expect(voiceField?.type).toBe('select');
    });

    it('has options matching the exported VOICE_OPTIONS', () => {
      const fields = settingsSchema.toFieldArray();
      const voiceField = fields.find((f) => f.name === 'voice');
      expect(voiceField).toHaveProperty('options');
      const options = (voiceField as { options?: { label: string; value: string }[] }).options;
      expect(options).toEqual(VOICE_OPTIONS);
    });

    it('has a default that exists in the options', () => {
      const fields = settingsSchema.toFieldArray();
      const voiceField = fields.find((f) => f.name === 'voice');
      const options = (voiceField as { options?: { label: string; value: string }[] }).options;
      const values = options?.map((o) => o.value) ?? [];
      expect(values).toContain(voiceField?.default);
    });

    it('only contains valid edge-tts voices', () => {
      const validVoices = [
        'en-US-AnaNeural',
        'en-US-AndrewMultilingualNeural',
        'en-US-AndrewNeural',
        'en-US-AriaNeural',
        'en-US-AvaMultilingualNeural',
        'en-US-AvaNeural',
        'en-US-BrianMultilingualNeural',
        'en-US-BrianNeural',
        'en-US-ChristopherNeural',
        'en-US-EmmaMultilingualNeural',
        'en-US-EmmaNeural',
        'en-US-EricNeural',
        'en-US-GuyNeural',
        'en-US-JennyNeural',
        'en-US-MichelleNeural',
        'en-US-RogerNeural',
        'en-US-SteffanNeural',
        'en-AU-NatashaNeural',
        'en-AU-WilliamMultilingualNeural',
        'en-GB-LibbyNeural',
        'en-GB-MaisieNeural',
        'en-GB-RyanNeural',
        'en-GB-SoniaNeural',
        'en-GB-ThomasNeural',
      ];

      for (const opt of VOICE_OPTIONS) {
        expect(validVoices).toContain(opt.value);
      }
    });
  });
});
