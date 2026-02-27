import { describe, expect, it } from 'vitest';
import { settingsSchema } from '../settings-schema';

describe('settingsSchema', () => {
  it('botToken is a required secret string field', () => {
    const fields = settingsSchema.toFieldArray();
    const botToken = fields.find((f) => f.name === 'botToken');
    expect(botToken).toMatchObject({
      type: 'string',
      secret: true,
      required: true,
    });
  });

  it('toFieldArray returns at least one field', () => {
    expect(settingsSchema.toFieldArray().length).toBeGreaterThan(0);
  });
});
