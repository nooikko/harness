import { describe, expect, it } from 'vitest';
import { createSettingsSchema, runChainHook, runHook, runHookWithResult } from '../index';

describe('plugin-contract exports', () => {
  it('exports runHook function', () => {
    expect(typeof runHook).toBe('function');
  });

  it('exports runChainHook function', () => {
    expect(typeof runChainHook).toBe('function');
  });

  it('exports runHookWithResult function', () => {
    expect(typeof runHookWithResult).toBe('function');
  });
});

describe('createSettingsSchema', () => {
  it('toFieldArray returns entries with name prepended', () => {
    const schema = createSettingsSchema({
      botToken: { type: 'string' as const, label: 'Bot Token', secret: true, required: true },
      channelId: { type: 'string' as const, label: 'Channel ID' },
    });

    const fields = schema.toFieldArray();
    expect(fields).toHaveLength(2);
    expect(fields[0]).toEqual({ name: 'botToken', type: 'string', label: 'Bot Token', secret: true, required: true });
    expect(fields[1]).toEqual({ name: 'channelId', type: 'string', label: 'Channel ID' });
  });

  it('handles select type with options', () => {
    const schema = createSettingsSchema({
      mode: {
        type: 'select' as const,
        label: 'Mode',
        options: [{ label: 'Production', value: 'prod' }],
      },
    });
    const fields = schema.toFieldArray();
    expect(fields[0]).toMatchObject({
      name: 'mode',
      type: 'select',
      options: expect.arrayContaining([{ label: 'Production', value: 'prod' }]),
    });
  });
});
