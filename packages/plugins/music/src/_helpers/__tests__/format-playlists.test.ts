import type { ToolResult } from '@harness/plugin-contract';
import { describe, expect, it } from 'vitest';
import { formatPlaylists } from '../format-playlists';

const textOf = (r: ToolResult): string => (typeof r === 'string' ? r : r.text);

const blocksOf = (r: ToolResult) => (typeof r === 'string' ? [] : r.blocks);

describe('formatPlaylists', () => {
  it('formats a single playlist with title and ID', () => {
    const result = formatPlaylists([{ title: 'Chill Vibes', id: 'pl-1' }]);
    const text = textOf(result);
    expect(text).toContain('Chill Vibes');
    expect(text).toContain('pl-1');
  });

  it('formats multiple playlists as a numbered list', () => {
    const playlists = [
      { title: 'Playlist A', id: 'id-a' },
      { title: 'Playlist B', id: 'id-b' },
      { title: 'Playlist C', id: 'id-c' },
    ];
    const result = formatPlaylists(playlists);
    const text = textOf(result);
    expect(text).toContain('1. **Playlist A** (ID: id-a)');
    expect(text).toContain('2. **Playlist B** (ID: id-b)');
    expect(text).toContain('3. **Playlist C** (ID: id-c)');
  });

  it("starts text with 'Your playlists:'", () => {
    const result = formatPlaylists([{ title: 'X', id: 'y' }]);
    expect(textOf(result)).toMatch(/^Your playlists:/);
  });

  it('returns a music-search block as first block', () => {
    const result = formatPlaylists([{ title: 'X', id: 'y' }]);
    const blocks = blocksOf(result);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('music-search');
  });

  it('block data results map title to title, empty artist, and id to videoId', () => {
    const playlists = [
      { title: 'My Mix', id: 'mix-1' },
      { title: 'Favorites', id: 'fav-2' },
    ];
    const result = formatPlaylists(playlists);
    const block = blocksOf(result)[0];
    expect(block?.data).toEqual({
      results: [
        { title: 'My Mix', artist: '', videoId: 'mix-1' },
        { title: 'Favorites', artist: '', videoId: 'fav-2' },
      ],
    });
  });
});
