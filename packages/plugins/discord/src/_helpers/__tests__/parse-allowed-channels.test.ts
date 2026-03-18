import { describe, expect, it } from 'vitest';
import { parseAllowedChannels } from '../parse-allowed-channels';

describe('parseAllowedChannels', () => {
  it('returns empty set for undefined', () => {
    expect(parseAllowedChannels(undefined)).toEqual(new Set());
  });

  it('returns empty set for empty string', () => {
    expect(parseAllowedChannels('')).toEqual(new Set());
  });

  it('returns empty set for whitespace-only string', () => {
    expect(parseAllowedChannels('   ')).toEqual(new Set());
  });

  it('parses single channel ID', () => {
    expect(parseAllowedChannels('123456')).toEqual(new Set(['123456']));
  });

  it('parses comma-separated channel IDs', () => {
    expect(parseAllowedChannels('111,222,333')).toEqual(new Set(['111', '222', '333']));
  });

  it('trims whitespace from IDs', () => {
    expect(parseAllowedChannels(' 111 , 222 , 333 ')).toEqual(new Set(['111', '222', '333']));
  });

  it('ignores empty segments from trailing/double commas', () => {
    expect(parseAllowedChannels('111,,222,')).toEqual(new Set(['111', '222']));
  });
});
