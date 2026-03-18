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

vi.mock('../youtube-music-auth', () => ({
  initWithCredentials: vi.fn().mockResolvedValue(undefined),
}));

import { initWithCredentials } from '../youtube-music-auth';
import {
  destroyYouTubeMusicClient,
  getAudioStreamUrl,
  getRawClient,
  getUpNextTracks,
  initYouTubeMusicClient,
  replaceYouTubeMusicClient,
  searchSongs,
} from '../youtube-music-client';

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
          generate_session_locally: false,
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

    it('returns empty array when upNext.contents is undefined', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        getUpNext: vi.fn().mockResolvedValue({ contents: undefined }),
      });

      const tracks = await getUpNextTracks('vid1');
      expect(tracks).toEqual([]);
    });

    it('skips items with no video_id', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        getUpNext: vi.fn().mockResolvedValue({
          contents: [
            {
              video_id: undefined,
              title: { toString: () => 'No ID Track' },
              artists: [{ name: 'C' }],
            },
            {
              video_id: 'valid-id',
              title: { toString: () => 'Valid Track' },
              artists: [{ name: 'D' }],
              duration: { seconds: 120, text: '2:00' },
              thumbnail: [],
            },
          ],
        }),
      });

      const tracks = await getUpNextTracks('other-id');
      expect(tracks).toHaveLength(1);
      expect(tracks[0]?.videoId).toBe('valid-id');
    });

    it('respects limit parameter', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        getUpNext: vi.fn().mockResolvedValue({
          contents: [
            { video_id: 'a', title: { toString: () => 'A' }, artists: [{ name: 'X' }], duration: {}, thumbnail: [] },
            { video_id: 'b', title: { toString: () => 'B' }, artists: [{ name: 'X' }], duration: {}, thumbnail: [] },
            { video_id: 'c', title: { toString: () => 'C' }, artists: [{ name: 'X' }], duration: {}, thumbnail: [] },
          ],
        }),
      });

      const tracks = await getUpNextTracks('other', 2);
      expect(tracks).toHaveLength(2);
    });

    it('falls back to author when artists array is empty', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        getUpNext: vi.fn().mockResolvedValue({
          contents: [
            {
              video_id: 'track-1',
              title: { toString: () => 'Author Track' },
              artists: [],
              author: 'Fallback Author',
              duration: { seconds: 100, text: '1:40' },
              thumbnail: [],
            },
          ],
        }),
      });

      const tracks = await getUpNextTracks('other');
      expect(tracks[0]?.artist).toBe('Fallback Author');
    });

    it('uses Unknown when both artists and author are missing', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        getUpNext: vi.fn().mockResolvedValue({
          contents: [
            {
              video_id: 'track-2',
              title: { toString: () => 'Mystery Track' },
              duration: {},
              thumbnail: [],
            },
          ],
        }),
      });

      const tracks = await getUpNextTracks('other');
      expect(tracks[0]?.artist).toBe('Unknown');
    });

    it('uses Unknown title when title.toString is missing', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        getUpNext: vi.fn().mockResolvedValue({
          contents: [
            {
              video_id: 'track-3',
              title: undefined,
              artists: [{ name: 'E' }],
              duration: {},
              thumbnail: [],
            },
          ],
        }),
      });

      const tracks = await getUpNextTracks('other');
      expect(tracks[0]?.title).toBe('Unknown');
    });
  });

  describe('destroyYouTubeMusicClient', () => {
    it('is safe to call when client was never initialized', () => {
      expect(() => destroyYouTubeMusicClient()).not.toThrow();
    });
  });

  describe('getClient guard', () => {
    it('throws from getAudioStreamUrl when client not initialized', async () => {
      await expect(getAudioStreamUrl('vid1')).rejects.toThrow('not initialized');
    });

    it('throws from getUpNextTracks when client not initialized', async () => {
      await expect(getUpNextTracks('vid1')).rejects.toThrow('not initialized');
    });
  });

  describe('searchSongs edge cases', () => {
    it('returns empty array when songs.contents is undefined', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({ songs: undefined });

      const results = await searchSongs('test');
      expect(results).toEqual([]);
    });

    it('returns empty array when songs is null', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({ songs: null });

      const results = await searchSongs('test');
      expect(results).toEqual([]);
    });

    it('uses Unknown for title when item.title is null', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({
        songs: {
          contents: [{ id: 'v1', title: null, artists: [{ name: 'A' }], duration: {} }],
        },
      });

      const results = await searchSongs('test');
      expect(results[0]?.title).toBe('Unknown');
    });

    it('falls back to author.name when artists array is empty', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({
        songs: {
          contents: [{ id: 'v1', title: 'T', artists: [], author: { name: 'Author Name' }, duration: {} }],
        },
      });

      const results = await searchSongs('test');
      expect(results[0]?.artist).toBe('Author Name');
    });

    it('uses Unknown when both artists and author are missing', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({
        songs: {
          contents: [{ id: 'v1', title: 'T', artists: null, author: null, duration: {} }],
        },
      });

      const results = await searchSongs('test');
      expect(results[0]?.artist).toBe('Unknown');
    });

    it('thumbnailUrl is undefined when thumbnails array is empty', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({
        songs: {
          contents: [{ id: 'v1', title: 'T', artists: [{ name: 'A' }], duration: {}, thumbnails: [] }],
        },
      });

      const results = await searchSongs('test');
      expect(results[0]?.thumbnailUrl).toBeUndefined();
    });
  });

  describe('getRawClient', () => {
    it('returns null before initialization', () => {
      expect(getRawClient()).toBeNull();
    });

    it('returns the client after initialization', async () => {
      setupMockClient();
      await initYouTubeMusicClient();
      expect(getRawClient()).not.toBeNull();
    });
  });

  describe('replaceYouTubeMusicClient', () => {
    it('sets a non-null client after replace', async () => {
      setupMockClient();
      await replaceYouTubeMusicClient();
      expect(getRawClient()).not.toBeNull();
    });

    it('calls Innertube.create with cookie and poToken options', async () => {
      setupMockClient();
      await replaceYouTubeMusicClient({ cookie: 'my-cookie', poToken: 'my-token' });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          cookie: 'my-cookie',
          po_token: 'my-token',
        }),
      );
    });

    it('calls initWithCredentials when OAuth credentials with authMethod oauth are provided', async () => {
      setupMockClient();
      await replaceYouTubeMusicClient({
        credentials: {
          authMethod: 'oauth',
          accessToken: 'access-123',
          refreshToken: 'refresh-456',
          expiresAt: new Date().toISOString(),
        },
      });
      expect(initWithCredentials).toHaveBeenCalledOnce();
    });

    it('does not call initWithCredentials when no credentials provided', async () => {
      setupMockClient();
      await replaceYouTubeMusicClient();
      expect(initWithCredentials).not.toHaveBeenCalled();
    });

    it('replaces the existing client with a new one', async () => {
      const firstClient = {
        music: { search: mockMusicSearch, getInfo: mockMusicGetInfo },
        __marker: 'first',
      };
      const secondClient = {
        music: { search: mockMusicSearch, getInfo: mockMusicGetInfo },
        __marker: 'second',
      };
      mockCreate.mockResolvedValueOnce(firstClient);
      await initYouTubeMusicClient();
      expect(getRawClient()).toBe(firstClient);

      mockCreate.mockResolvedValueOnce(secondClient);
      await replaceYouTubeMusicClient();
      expect(getRawClient()).toBe(secondClient);
    });
  });

  describe('getAudioStreamUrl edge cases', () => {
    it('falls back to non-opus audio when no opus formats exist', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              has_audio: true,
              has_video: false,
              url: 'https://aac-audio.url',
              mime_type: 'audio/mp4; codecs="mp4a.40.2"',
              average_bitrate: 128000,
              approx_duration_ms: 200000,
            },
          ],
        },
      });

      const stream = await getAudioStreamUrl('vid1');
      expect(stream.url).toBe('https://aac-audio.url');
      expect(stream.mimeType).toContain('mp4');
    });

    it('throws when streaming_data is null', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: null,
      });

      await expect(getAudioStreamUrl('vid1')).rejects.toThrow('No audio streams found');
    });

    it('throws when best candidate has no url', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              has_audio: true,
              has_video: false,
              url: undefined,
              mime_type: 'audio/webm; codecs="opus"',
              average_bitrate: 128000,
            },
          ],
        },
      });

      // No url and no decipher function — should fail at decipher step
      await expect(getAudioStreamUrl('vid1')).rejects.toThrow('Failed to decipher stream URL');
    });

    it('defaults mimeType to audio/webm when mime_type is null', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              has_audio: true,
              has_video: false,
              url: 'https://no-mime.url',
              mime_type: null,
              average_bitrate: 96000,
              approx_duration_ms: 180000,
            },
          ],
        },
      });

      const stream = await getAudioStreamUrl('vid1');
      expect(stream.mimeType).toBe('audio/webm');
    });

    it('falls back to bitrate when average_bitrate is null', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              has_audio: true,
              has_video: false,
              url: 'https://bitrate-fallback.url',
              mime_type: 'audio/mp4',
              average_bitrate: null,
              bitrate: 96000,
              approx_duration_ms: 150000,
            },
          ],
        },
      });

      const stream = await getAudioStreamUrl('vid1');
      expect(stream.bitrate).toBe(96000);
    });

    it('uses 0 for bitrate when both average_bitrate and bitrate are null', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              has_audio: true,
              has_video: false,
              url: 'https://no-bitrate.url',
              mime_type: 'audio/mp4',
              average_bitrate: null,
              bitrate: null,
              approx_duration_ms: 150000,
            },
          ],
        },
      });

      const stream = await getAudioStreamUrl('vid1');
      expect(stream.bitrate).toBe(0);
    });

    it('durationMs is undefined when approx_duration_ms is missing', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              has_audio: true,
              has_video: false,
              url: 'https://no-duration.url',
              mime_type: 'audio/mp4',
              average_bitrate: 128000,
            },
          ],
        },
      });

      const stream = await getAudioStreamUrl('vid1');
      expect(stream.durationMs).toBeUndefined();
    });

    it('sorts candidates by bitrate descending and picks highest', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              has_audio: true,
              has_video: false,
              url: 'https://low.url',
              mime_type: 'audio/mp4',
              average_bitrate: 64000,
            },
            {
              has_audio: true,
              has_video: false,
              url: 'https://high.url',
              mime_type: 'audio/mp4',
              average_bitrate: 256000,
            },
          ],
        },
      });

      const stream = await getAudioStreamUrl('vid1');
      expect(stream.url).toBe('https://high.url');
      expect(stream.bitrate).toBe(256000);
    });
  });
});
