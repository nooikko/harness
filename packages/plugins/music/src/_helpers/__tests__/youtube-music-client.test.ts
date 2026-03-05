import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock youtubei.js
const mockMusicSearch = vi.fn();
const mockMusicGetInfo = vi.fn();
const mockCreate = vi.fn();

vi.mock('youtubei.js', () => ({
  default: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
  UniversalCache: vi.fn(),
}));

import { destroyYouTubeMusicClient, getAudioStreamUrl, getUpNextTracks, initYouTubeMusicClient, searchSongs } from '../youtube-music-client';

describe('youtube-music-client', () => {
  afterEach(() => {
    destroyYouTubeMusicClient();
    vi.clearAllMocks();
  });

  const setupMockClient = () => {
    mockCreate.mockResolvedValue({
      music: {
        search: mockMusicSearch,
        getInfo: mockMusicGetInfo,
      },
    });
  };

  describe('initYouTubeMusicClient', () => {
    it('creates an Innertube instance', async () => {
      setupMockClient();
      await initYouTubeMusicClient();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          generate_session_locally: true,
          retrieve_player: true,
        }),
      );
    });
  });

  describe('searchSongs', () => {
    it('throws if client not initialized', async () => {
      await expect(searchSongs('test')).rejects.toThrow('not initialized');
    });

    it('returns mapped tracks from search results', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({
        songs: {
          contents: [
            {
              id: 'vid1',
              title: 'Song One',
              artists: [{ name: 'Artist A' }],
              album: { name: 'Album X' },
              duration: { seconds: 210, text: '3:30' },
              thumbnails: [{ url: 'https://thumb.jpg', width: 120, height: 120 }],
            },
            {
              id: 'vid2',
              title: 'Song Two',
              artists: [{ name: 'Artist B' }],
              album: undefined,
              duration: { seconds: 180, text: '3:00' },
              thumbnails: [],
            },
          ],
        },
      });

      const results = await searchSongs('test query', 5);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        videoId: 'vid1',
        title: 'Song One',
        artist: 'Artist A',
        album: 'Album X',
        durationSeconds: 210,
        durationText: '3:30',
        thumbnailUrl: 'https://thumb.jpg',
      });
      expect(results[1]?.album).toBeUndefined();
    });

    it('respects limit parameter', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({
        songs: {
          contents: [
            { id: 'v1', title: 'S1', artists: [], duration: {} },
            { id: 'v2', title: 'S2', artists: [], duration: {} },
            { id: 'v3', title: 'S3', artists: [], duration: {} },
          ],
        },
      });

      const results = await searchSongs('test', 2);
      expect(results).toHaveLength(2);
    });

    it('skips items without videoId', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({
        songs: {
          contents: [
            { id: undefined, title: 'No ID' },
            { id: 'valid', title: 'Has ID', artists: [], duration: {} },
          ],
        },
      });

      const results = await searchSongs('test');
      expect(results).toHaveLength(1);
      expect(results[0]?.videoId).toBe('valid');
    });
  });

  describe('getAudioStreamUrl', () => {
    it('returns best audio stream URL', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              has_audio: true,
              has_video: false,
              url: 'https://audio-low.url',
              mime_type: 'audio/mp4',
              average_bitrate: 64000,
              approx_duration_ms: 210000,
            },
            {
              has_audio: true,
              has_video: false,
              url: 'https://audio-high.url',
              mime_type: 'audio/webm; codecs="opus"',
              average_bitrate: 128000,
              approx_duration_ms: 210000,
            },
            {
              has_audio: true,
              has_video: true,
              url: 'https://video.url',
              mime_type: 'video/mp4',
              average_bitrate: 256000,
            },
          ],
        },
      });

      const stream = await getAudioStreamUrl('vid1');
      expect(stream.url).toBe('https://audio-high.url');
      expect(stream.mimeType).toContain('opus');
      expect(stream.bitrate).toBe(128000);
    });

    it('throws when no audio formats available', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: { adaptive_formats: [] },
      });

      await expect(getAudioStreamUrl('vid1')).rejects.toThrow('No audio streams found');
    });
  });

  describe('getUpNextTracks', () => {
    it('returns related tracks excluding current', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        getUpNext: vi.fn().mockResolvedValue({
          contents: [
            {
              video_id: 'current',
              title: { toString: () => 'Current' },
              artists: [{ name: 'A' }],
              duration: { seconds: 200, text: '3:20' },
              thumbnail: [],
            },
            {
              video_id: 'next1',
              title: { toString: () => 'Next One' },
              artists: [{ name: 'B' }],
              album: { name: 'Album' },
              duration: { seconds: 180, text: '3:00' },
              thumbnail: [{ url: 'https://thumb.jpg' }],
            },
          ],
        }),
      });

      const tracks = await getUpNextTracks('current', 10);
      expect(tracks).toHaveLength(1);
      expect(tracks[0]?.videoId).toBe('next1');
      expect(tracks[0]?.title).toBe('Next One');
    });

    it('returns empty array when no up next', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        getUpNext: vi.fn().mockResolvedValue(null),
      });

      const tracks = await getUpNextTracks('vid1');
      expect(tracks).toEqual([]);
    });
  });
});
