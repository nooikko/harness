import { describe, expect, it } from 'vitest';
import { settingsSchema } from '../settings-schema';

describe('settingsSchema', () => {
  it('exports a valid settings schema with toFieldArray', () => {
    expect(settingsSchema).toBeDefined();
    expect(typeof settingsSchema.toFieldArray).toBe('function');
  });

  it('returns all 7 fields', () => {
    const fields = settingsSchema.toFieldArray();
    expect(fields).toHaveLength(7);
  });

  it('includes youtubeAuth as oauth type', () => {
    const fields = settingsSchema.toFieldArray();
    const authField = fields.find((f) => f.name === 'youtubeAuth');
    expect(authField).toBeDefined();
    expect(authField?.type).toBe('oauth');
    expect((authField as { provider?: string }).provider).toBe('youtube-music');
  });

  it('includes cookie as secret string', () => {
    const fields = settingsSchema.toFieldArray();
    const cookieField = fields.find((f) => f.name === 'cookie');
    expect(cookieField).toBeDefined();
    expect(cookieField?.type).toBe('string');
    expect(cookieField?.secret).toBe(true);
  });

  it('includes poToken as secret string', () => {
    const fields = settingsSchema.toFieldArray();
    const poField = fields.find((f) => f.name === 'poToken');
    expect(poField).toBeDefined();
    expect(poField?.type).toBe('string');
    expect(poField?.secret).toBe(true);
  });

  it('includes defaultVolume as number with default 50', () => {
    const fields = settingsSchema.toFieldArray();
    const volField = fields.find((f) => f.name === 'defaultVolume');
    expect(volField).toBeDefined();
    expect(volField?.type).toBe('number');
    expect(volField?.default).toBe(50);
  });

  it('includes radioEnabled as boolean with default true', () => {
    const fields = settingsSchema.toFieldArray();
    const radioField = fields.find((f) => f.name === 'radioEnabled');
    expect(radioField).toBeDefined();
    expect(radioField?.type).toBe('boolean');
    expect(radioField?.default).toBe(true);
  });

  it('includes audioQuality as select with 3 options', () => {
    const fields = settingsSchema.toFieldArray();
    const qualityField = fields.find((f) => f.name === 'audioQuality');
    expect(qualityField).toBeDefined();
    expect(qualityField?.type).toBe('select');
    expect(qualityField?.default).toBe('auto');
    expect((qualityField as { options?: unknown[] }).options).toHaveLength(3);
  });
});
