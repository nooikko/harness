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

  it('allowedChannelIds is an optional string field', () => {
    const fields = settingsSchema.toFieldArray();
    const allowedChannelIds = fields.find((f) => f.name === 'allowedChannelIds');
    expect(allowedChannelIds).toMatchObject({
      type: 'string',
      required: false,
    });
  });
});
