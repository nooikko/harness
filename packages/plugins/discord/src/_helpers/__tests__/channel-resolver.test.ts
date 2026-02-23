import { describe, expect, it } from 'vitest';
import { resolveChannel } from '../channel-resolver';

describe('resolveChannel', () => {
  it('resolves a text channel to a sourceId', () => {
    const mockChannel = {
      id: '123456789',
      name: 'general',
      isThread: () => false,
    };

    const result = resolveChannel(mockChannel as never);

    expect(result).toEqual({
      sourceId: 'discord:123456789',
      channelName: 'general',
      isThread: false,
      parentChannelId: null,
    });
  });

  it('resolves a thread channel with parent reference', () => {
    const mockThread = {
      id: '987654321',
      name: 'task-thread',
      isThread: () => true,
      parentId: '123456789',
    };

    const result = resolveChannel(mockThread as never);

    expect(result).toEqual({
      sourceId: 'discord:987654321',
      channelName: 'task-thread',
      isThread: true,
      parentChannelId: '123456789',
    });
  });

  it('handles thread with null name', () => {
    const mockThread = {
      id: '987654321',
      name: null,
      isThread: () => true,
      parentId: '123456789',
    };

    const result = resolveChannel(mockThread as never);

    expect(result.channelName).toBe('thread-987654321');
  });

  it('falls back to channel id when name is not present', () => {
    const mockChannel = {
      id: '111222333',
      isThread: () => false,
    };

    const result = resolveChannel(mockChannel as never);

    expect(result.channelName).toBe('111222333');
  });
});
