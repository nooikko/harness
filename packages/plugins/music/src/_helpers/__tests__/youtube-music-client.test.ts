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

const mockResolveStreamUrl = vi.fn();
vi.mock('../resolve-stream-url', () => ({
  resolveStreamUrl: (...args: unknown[]) => mockResolveStreamUrl(...args),
}));

vi.mock('../fetch-po-token', () => ({
  fetchPoToken: vi.fn().mockResolvedValue('mock-po-token'),
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

  const setupMockClient = (options?: { logged_in?: boolean }) => {
    mockCreate.mockResolvedValue({
      music: {
        search: mockMusicSearch,
        getInfo: mockMusicGetInfo,
      },
      session: { logged_in: options?.logged_in ?? false },
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
    it('delegates to yt-dlp and returns resolved stream', async () => {
      mockResolveStreamUrl.mockResolvedValueOnce({
        url: 'https://stream.googlevideo.com/playback',
        mimeType: 'audio/webm',
        bitrate: 128000,
        durationMs: 210000,
      });

      const stream = await getAudioStreamUrl('vid1');
      expect(stream.url).toBe('https://stream.googlevideo.com/playback');
      expect(stream.mimeType).toBe('audio/webm');
      expect(mockResolveStreamUrl).toHaveBeenCalledWith('vid1');
    });

    it('throws when yt-dlp fails', async () => {
      mockResolveStreamUrl.mockRejectedValueOnce(new Error('yt-dlp failed for vid1: Video unavailable'));

      await expect(getAudioStreamUrl('vid1')).rejects.toThrow('yt-dlp failed');
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

    it('falls back to anonymous client when authenticated client fails getInfo', async () => {
      const anonymousGetInfo = vi.fn().mockResolvedValue({
        getUpNext: vi.fn().mockResolvedValue({
          contents: [
            {
              video_id: 'next1',
              title: { toString: () => 'Fallback Track' },
              artists: [{ name: 'FB Artist' }],
              duration: { seconds: 180, text: '3:00' },
              thumbnail: [],
            },
          ],
        }),
      });

      mockCreate.mockResolvedValueOnce({
        music: { search: mockMusicSearch, getInfo: mockMusicGetInfo },
        session: { logged_in: true },
      });
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockRejectedValueOnce(new Error('400 bad request'));
      mockCreate.mockResolvedValueOnce({
        music: { search: vi.fn(), getInfo: anonymousGetInfo },
      });

      const tracks = await getUpNextTracks('current', 10);
      expect(tracks).toHaveLength(1);
      expect(tracks[0]?.title).toBe('Fallback Track');
    });

    it('throws when already anonymous and getInfo fails', async () => {
      mockCreate.mockResolvedValueOnce({
        music: { search: mockMusicSearch, getInfo: mockMusicGetInfo },
        session: { logged_in: false },
      });
      await initYouTubeMusicClient();

      mockMusicGetInfo.mockRejectedValueOnce(new Error('400 bad request'));

      await expect(getUpNextTracks('vid1')).rejects.toThrow('400 bad request');
    });
  });

  describe('destroyYouTubeMusicClient', () => {
    it('is safe to call when client was never initialized', () => {
      expect(() => destroyYouTubeMusicClient()).not.toThrow();
    });
  });

  describe('getClient guard', () => {
    // getAudioStreamUrl no longer uses getClient() — it delegates to yt-dlp.

    it('throws from getUpNextTracks when client not initialized', async () => {
      await expect(getUpNextTracks('vid1')).rejects.toThrow('not initialized');
    });
  });

  describe('searchSongs fallback to anonymous client', () => {
    it('retries with anonymous client when authenticated client returns 400', async () => {
      const anonymousSearch = vi.fn().mockResolvedValue({
        songs: { contents: [{ id: 'v1', title: 'Fallback Song', artists: [{ name: 'Artist' }] }] },
      });
      // First call: set up authenticated client that fails search
      mockCreate.mockResolvedValueOnce({
        music: { search: mockMusicSearch, getInfo: mockMusicGetInfo },
        session: { logged_in: true },
      });
      await initYouTubeMusicClient();

      mockMusicSearch.mockRejectedValueOnce(new Error('Request failed with status code 400'));
      // Second call: anonymous fallback client
      mockCreate.mockResolvedValueOnce({
        music: { search: anonymousSearch, getInfo: vi.fn() },
      });

      const results = await searchSongs('test query', 5);
      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe('Fallback Song');
      expect(mockCreate).toHaveBeenCalledTimes(2); // original + fallback
    });

    it('throws if anonymous client also fails (no fallback loop)', async () => {
      mockCreate.mockResolvedValueOnce({
        music: { search: mockMusicSearch, getInfo: mockMusicGetInfo },
        session: { logged_in: false },
      });
      await initYouTubeMusicClient();

      mockMusicSearch.mockRejectedValueOnce(new Error('400 bad request'));

      await expect(searchSongs('test')).rejects.toThrow('400 bad request');
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

  describe('replaceYouTubeMusicClient with logger', () => {
    const setupMockClientWithSession = (loggedIn = false) => {
      mockCreate.mockResolvedValue({
        music: { search: mockMusicSearch, getInfo: mockMusicGetInfo },
        session: { logged_in: loggedIn },
      });
    };

    it('logs client creation details when logger is provided', async () => {
      setupMockClientWithSession(true);
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

      await replaceYouTubeMusicClient({
        credentials: { authMethod: 'oauth' as const, accessToken: 'a', refreshToken: 'r', expiresAt: '' },
        logger: mockLogger,
        poTokenServerUrl: 'http://localhost:4416',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'music: creating Innertube client',
        expect.objectContaining({ hasOAuth: true, poTokenServerUrl: 'http://localhost:4416' }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith('music: OAuth sign-in completed', { logged_in: true });
      expect(mockLogger.info).toHaveBeenCalledWith('music: client ready', { logged_in: true });
    });

    it('logs without OAuth when no credentials', async () => {
      setupMockClientWithSession(false);
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

      await replaceYouTubeMusicClient({ logger: mockLogger });

      expect(mockLogger.info).toHaveBeenCalledWith('music: creating Innertube client', expect.objectContaining({ hasOAuth: false }));
      expect(mockLogger.info).not.toHaveBeenCalledWith('music: OAuth sign-in completed', expect.anything());
    });
  });

  // getAudioStreamUrl edge cases are now covered by resolve-stream-url.test.ts
  // since the function delegates entirely to yt-dlp.

  describe('setAuthenticatedSearchApi', () => {
    it('uses TVHTML5 API for search when set, skipping youtubei.js entirely', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      const tvSearch = vi
        .fn()
        .mockResolvedValue([{ videoId: 'tv1', title: 'TV Result', artist: 'TV Artist', durationText: '3:45', thumbnailUrl: undefined }]);

      const { setAuthenticatedSearchApi } = await import('../youtube-music-client');
      setAuthenticatedSearchApi(tvSearch);

      const results = await searchSongs('jazz', 5);

      // Should use TVHTML5 API, NOT youtubei.js
      expect(tvSearch).toHaveBeenCalledWith('jazz', 5);
      expect(mockMusicSearch).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0]?.videoId).toBe('tv1');
      expect(results[0]?.title).toBe('TV Result');

      // Clean up
      setAuthenticatedSearchApi(null);
    });

    it('falls back to youtubei.js when TVHTML5 API search fails', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      const tvSearch = vi.fn().mockRejectedValue(new Error('TVHTML5 search failed'));
      mockMusicSearch.mockResolvedValue({
        songs: { contents: [{ id: 'yt1', title: 'YT Fallback', artists: [{ name: 'A' }] }] },
      });

      const { setAuthenticatedSearchApi } = await import('../youtube-music-client');
      setAuthenticatedSearchApi(tvSearch);

      const results = await searchSongs('jazz', 5);

      // Should fall back to youtubei.js after TVHTML5 fails
      expect(tvSearch).toHaveBeenCalled();
      expect(mockMusicSearch).toHaveBeenCalled();
      expect(results[0]?.title).toBe('YT Fallback');

      setAuthenticatedSearchApi(null);
    });

    it('uses youtubei.js directly when no TVHTML5 API is set', async () => {
      setupMockClient();
      await initYouTubeMusicClient();

      mockMusicSearch.mockResolvedValue({
        songs: { contents: [{ id: 'yt1', title: 'Normal Result', artists: [{ name: 'A' }] }] },
      });

      const { setAuthenticatedSearchApi } = await import('../youtube-music-client');
      setAuthenticatedSearchApi(null);

      const results = await searchSongs('jazz', 5);
      expect(mockMusicSearch).toHaveBeenCalled();
      expect(results[0]?.title).toBe('Normal Result');
    });
  });
});
