import { describe, expect, it } from 'vitest';
import { buildSourceId } from '../build-source-id';

describe('buildSourceId', () => {
  it('creates a sourceId from a channel id', () => {
    expect(buildSourceId('123456789')).toBe('discord:123456789');
  });

  it('creates a sourceId from a thread id', () => {
    expect(buildSourceId('987654321')).toBe('discord:987654321');
  });
});
