import { describe, expect, it } from 'vitest';
import { formatSearchResults } from '../format-search-results';
import type { MusicTrack } from '../youtube-music-client';

describe('formatSearchResults', () => {
  it('returns no results message for empty array', () => {
    expect(formatSearchResults([])).toBe('No results found.');
  });

  it('formats a single track', () => {
    const tracks: MusicTrack[] = [
      {
        videoId: 'abc123',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        durationSeconds: 354,
        durationText: '5:54',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      },
    ];
    const result = formatSearchResults(tracks);
    expect(result).toContain('Found 1 result(s)');
    expect(result).toContain('**Bohemian Rhapsody**');
    expect(result).toContain('by Queen');
    expect(result).toContain('[5:54]');
    expect(result).toContain('Album: A Night at the Opera');
    expect(result).toContain('videoId: abc123');
  });

  it('formats multiple tracks', () => {
    const tracks: MusicTrack[] = [
      {
        videoId: 'a1',
        title: 'Track One',
        artist: 'Artist A',
        album: undefined,
        durationSeconds: 180,
        durationText: '3:00',
        thumbnailUrl: undefined,
      },
      {
        videoId: 'b2',
        title: 'Track Two',
        artist: 'Artist B',
        album: 'Album B',
        durationSeconds: 240,
        durationText: '4:00',
        thumbnailUrl: undefined,
      },
    ];
    const result = formatSearchResults(tracks);
    expect(result).toContain('Found 2 result(s)');
    expect(result).toContain('1. **Track One**');
    expect(result).toContain('2. **Track Two**');
  });

  it('handles missing duration', () => {
    const tracks: MusicTrack[] = [
      {
        videoId: 'x',
        title: 'No Duration',
        artist: 'Test',
        album: undefined,
        durationSeconds: undefined,
        durationText: undefined,
        thumbnailUrl: undefined,
      },
    ];
    const result = formatSearchResults(tracks);
    expect(result).toContain('[??:??]');
  });

  it('omits album when undefined', () => {
    const tracks: MusicTrack[] = [
      {
        videoId: 'x',
        title: 'Single',
        artist: 'Solo',
        album: undefined,
        durationSeconds: 120,
        durationText: '2:00',
        thumbnailUrl: undefined,
      },
    ];
    const result = formatSearchResults(tracks);
    expect(result).not.toContain('Album:');
  });
});
