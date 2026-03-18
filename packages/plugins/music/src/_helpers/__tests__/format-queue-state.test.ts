import type { ToolResult } from '@harness/plugin-contract';
import { describe, expect, it } from 'vitest';
import { formatQueueState } from '../format-queue-state';
import type { DevicePlaybackState } from '../playback-controller';

const textOf = (r: ToolResult): string => (typeof r === 'string' ? r : r.text);

const blocksOf = (r: ToolResult) => (typeof r === 'string' ? [] : r.blocks);

const makeTrack = (title: string, artist: string, videoId: string) => ({
  videoId,
  title,
  artist,
  album: undefined,
  durationSeconds: undefined,
  durationText: undefined,
  thumbnailUrl: undefined,
});

const makeState = (overrides: Partial<DevicePlaybackState> = {}): DevicePlaybackState => ({
  device: { name: 'Living Room', host: '192.168.1.10', port: 8009, id: 'abc', model: undefined },
  currentTrack: makeTrack('Song A', 'Artist A', 'vid-1'),
  queue: [],
  radioEnabled: false,
  playerState: 'PLAYING',
  ...overrides,
});

describe('formatQueueState', () => {
  it('includes track title and artist when current track is present', () => {
    const result = formatQueueState(makeState());
    const text = textOf(result);
    expect(text).toContain('Song A');
    expect(text).toContain('Artist A');
  });

  it('shows (nothing) when current track is null', () => {
    const result = formatQueueState(makeState({ currentTrack: null }));
    expect(textOf(result)).toContain('(nothing)');
  });

  it('shows numbered queue items when queue is non-empty', () => {
    const queue = [makeTrack('Track 1', 'Art 1', 'v1'), makeTrack('Track 2', 'Art 2', 'v2')];
    const result = formatQueueState(makeState({ queue }));
    const text = textOf(result);
    expect(text).toContain('Up Next (2):');
    expect(text).toContain('1. Track 1 by Art 1');
    expect(text).toContain('2. Track 2 by Art 2');
  });

  it('shows (empty) when queue is empty', () => {
    const result = formatQueueState(makeState({ queue: [] }));
    expect(textOf(result)).toContain('Up Next:** (empty)');
  });

  it('shows radio on when enabled', () => {
    const result = formatQueueState(makeState({ radioEnabled: true }));
    expect(textOf(result)).toContain('**Radio:** on');
  });

  it('shows radio off when disabled', () => {
    const result = formatQueueState(makeState({ radioEnabled: false }));
    expect(textOf(result)).toContain('**Radio:** off');
  });

  it.each(['IDLE', 'PLAYING', 'PAUSED', 'BUFFERING'] as const)('includes playerState %s in text', (playerState) => {
    const result = formatQueueState(makeState({ playerState }));
    expect(textOf(result)).toContain(`**State:** ${playerState}`);
  });

  it('includes device name in text', () => {
    const result = formatQueueState(makeState());
    expect(textOf(result)).toContain('**Device:** Living Room');
  });

  it('returns a now-playing block as first block', () => {
    const result = formatQueueState(makeState());
    const blocks = blocksOf(result);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('now-playing');
  });

  it('block data contains device name, state, radio, current track, and queue', () => {
    const queue = [makeTrack('Q1', 'QA1', 'qv1')];
    const result = formatQueueState(
      makeState({
        radioEnabled: true,
        playerState: 'PAUSED',
        queue,
      }),
    );
    const block = blocksOf(result)[0];
    expect(block?.data).toEqual({
      deviceName: 'Living Room',
      state: 'PAUSED',
      radioEnabled: true,
      currentTrack: { title: 'Song A', artist: 'Artist A', videoId: 'vid-1' },
      queue: [{ title: 'Q1', artist: 'QA1', videoId: 'qv1' }],
    });
  });

  it('block data has currentTrack null when no track is playing', () => {
    const result = formatQueueState(makeState({ currentTrack: null }));
    const block = blocksOf(result)[0];
    expect(block?.data).toHaveProperty('currentTrack', null);
  });
});
