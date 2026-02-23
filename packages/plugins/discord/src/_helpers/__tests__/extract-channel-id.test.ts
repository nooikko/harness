import { describe, expect, it } from 'vitest';
import { extractChannelId } from '../extract-channel-id';

describe('extractChannelId', () => {
  it('extracts channel id from a discord sourceId', () => {
    expect(extractChannelId('discord:123456789')).toBe('123456789');
  });

  it('returns null for non-discord sourceIds', () => {
    expect(extractChannelId('web:session-abc')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractChannelId('')).toBeNull();
  });

  it('handles sourceId with only prefix', () => {
    expect(extractChannelId('discord:')).toBe('');
  });
});
