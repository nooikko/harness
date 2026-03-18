import type { ToolResult } from '@harness/plugin-contract';
import { describe, expect, it } from 'vitest';
import { formatLikedSongs } from '../format-liked-songs';

const textOf = (r: ToolResult): string => (typeof r === 'string' ? r : r.text);

const blocksOf = (r: ToolResult) => (typeof r === 'string' ? [] : r.blocks);

describe('formatLikedSongs', () => {
  it('formats a single song with title, artist, and videoId', () => {
    const result = formatLikedSongs([{ title: 'Bohemian Rhapsody', artist: 'Queen', videoId: 'vid-br' }]);
    const text = textOf(result);
    expect(text).toContain('Bohemian Rhapsody');
    expect(text).toContain('Queen');
    expect(text).toContain('vid-br');
  });

  it('formats multiple songs as a numbered list', () => {
    const songs = [
      { title: 'Song A', artist: 'Artist A', videoId: 'v1' },
      { title: 'Song B', artist: 'Artist B', videoId: 'v2' },
    ];
    const result = formatLikedSongs(songs);
    const text = textOf(result);
    expect(text).toContain('1. **Song A** by Artist A (videoId: v1)');
    expect(text).toContain('2. **Song B** by Artist B (videoId: v2)');
  });

  it('includes count in header', () => {
    const songs = [
      { title: 'X', artist: 'Y', videoId: 'z1' },
      { title: 'A', artist: 'B', videoId: 'z2' },
      { title: 'C', artist: 'D', videoId: 'z3' },
    ];
    const result = formatLikedSongs(songs);
    expect(textOf(result)).toContain('Liked songs (3):');
  });

  it('header shows count of 1 for single song', () => {
    const result = formatLikedSongs([{ title: 'Solo', artist: 'One', videoId: 's1' }]);
    expect(textOf(result)).toContain('Liked songs (1):');
  });

  it('returns a music-search block as first block', () => {
    const result = formatLikedSongs([{ title: 'X', artist: 'Y', videoId: 'z' }]);
    const blocks = blocksOf(result);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('music-search');
  });

  it('block data results map songs correctly', () => {
    const songs = [
      { title: 'Track 1', artist: 'Art 1', videoId: 'tv1' },
      { title: 'Track 2', artist: 'Art 2', videoId: 'tv2' },
    ];
    const result = formatLikedSongs(songs);
    const block = blocksOf(result)[0];
    expect(block?.data).toEqual({
      results: [
        { title: 'Track 1', artist: 'Art 1', videoId: 'tv1' },
        { title: 'Track 2', artist: 'Art 2', videoId: 'tv2' },
      ],
    });
  });
});
