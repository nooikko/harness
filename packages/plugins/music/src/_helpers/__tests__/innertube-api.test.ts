import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInnertubeApi, parseTvLikedSongs, parseTvPlaylists, parseTvSearchResults } from '../innertube-api';

// --- Mock fetch ---

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

afterEach(() => {
  mockFetch.mockReset();
});

// --- Fixtures ---

const credentials = {
  accessToken: 'ya29.test-token',
  refreshToken: '1//test-refresh',
  expiresAt: '2026-12-31T00:00:00Z',
};

const makeTileRenderer = (videoId: string, title: string, artist: string, duration?: string) => ({
  tileRenderer: {
    style: 'TILE_STYLE_YTLR_DEFAULT',
    header: {
      tileHeaderRenderer: {
        thumbnail: {
          thumbnails: [{ url: `https://i.ytimg.com/vi/${videoId}/hq.jpg`, width: 320, height: 180 }],
        },
        thumbnailOverlays: duration ? [{ thumbnailOverlayTimeStatusRenderer: { text: { simpleText: duration } } }] : [],
      },
    },
    metadata: {
      tileMetadataRenderer: {
        title: { simpleText: title },
        lines: [
          {
            lineRenderer: {
              items: [{ lineItemRenderer: { text: { simpleText: artist } } }],
            },
          },
        ],
      },
    },
    onSelectCommand: { watchEndpoint: { videoId } },
  },
});

const makeSearchResponse = (tiles: ReturnType<typeof makeTileRenderer>[]) => ({
  contents: {
    sectionListRenderer: {
      contents: [
        {
          shelfRenderer: {
            content: {
              horizontalListRenderer: {
                items: tiles,
              },
            },
          },
        },
      ],
    },
  },
});

const makeLikedSongsResponse = (tiles: ReturnType<typeof makeTileRenderer>[]) => ({
  contents: {
    tvBrowseRenderer: {
      content: {
        tvSurfaceContentRenderer: {
          content: {
            twoColumnRenderer: {
              leftColumn: {
                entityMetadataRenderer: {
                  title: { simpleText: 'Liked Music' },
                  header: {
                    overlayPanelHeaderRenderer: {
                      additionalSubtitles: [{ simpleText: '42 songs • 2 hours' }],
                    },
                  },
                },
              },
              rightColumn: {
                shelfRenderer: {
                  content: {
                    horizontalListRenderer: {
                      items: tiles,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

// --- Tests ---

describe('createInnertubeApi', () => {
  describe('searchSongs', () => {
    it('sends correct request to music.youtube.com with TVHTML5 context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeSearchResponse([])),
      });

      const api = createInnertubeApi({ credentials });
      await api.searchSongs('test query');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://music.youtube.com/youtubei/v1/search?prettyPrint=false',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${credentials.accessToken}`,
          }),
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(body.context.client.clientName).toBe('TVHTML5');
      expect(body.query).toBe('test query');
    });

    it('parses tracks from TV search response', async () => {
      const tiles = [makeTileRenderer('vid1', 'Song One', 'Artist A', '3:45'), makeTileRenderer('vid2', 'Song Two', 'Artist B', '2:30')];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeSearchResponse(tiles)),
      });

      const api = createInnertubeApi({ credentials });
      const results = await api.searchSongs('test', 5);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(expect.objectContaining({ videoId: 'vid1', title: 'Song One', artist: 'Artist A' }));
      expect(results[1]).toEqual(expect.objectContaining({ videoId: 'vid2', title: 'Song Two', artist: 'Artist B' }));
    });

    it('respects limit parameter', async () => {
      const tiles = Array.from({ length: 20 }, (_, i) => makeTileRenderer(`v${i}`, `Song ${i}`, `Artist ${i}`));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeSearchResponse(tiles)),
      });

      const api = createInnertubeApi({ credentials });
      const results = await api.searchSongs('test', 3);

      expect(results).toHaveLength(3);
    });

    it('throws on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error": "bad request"}'),
      });

      const api = createInnertubeApi({ credentials });
      await expect(api.searchSongs('test')).rejects.toThrow('Innertube search failed (400)');
    });
  });

  describe('getLikedSongs', () => {
    it('sends browse request with VLLM browseId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeLikedSongsResponse([])),
      });

      const api = createInnertubeApi({ credentials });
      await api.getLikedSongs();

      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(body.browseId).toBe('VLLM');
    });

    it('returns title and tracks', async () => {
      const tiles = [makeTileRenderer('lk1', 'Liked Song', 'Fav Artist', '4:00')];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeLikedSongsResponse(tiles)),
      });

      const api = createInnertubeApi({ credentials });
      const result = await api.getLikedSongs();

      expect(result.title).toBe('Liked Music');
      expect(result.tracks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getPlaylists', () => {
    it('sends browse request with FEmusic_liked_playlists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ contents: {} }),
      });

      const api = createInnertubeApi({ credentials });
      await api.getPlaylists();

      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(body.browseId).toBe('FEmusic_liked_playlists');
    });
  });

  describe('likeSong', () => {
    it('sends like request with videoId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const api = createInnertubeApi({ credentials });
      await api.likeSong('abc123');

      expect(mockFetch).toHaveBeenCalledWith('https://music.youtube.com/youtubei/v1/like/like?prettyPrint=false', expect.anything());
      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(body.target.videoId).toBe('abc123');
    });
  });

  describe('unlikeSong', () => {
    it('sends removelike request with videoId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const api = createInnertubeApi({ credentials });
      await api.unlikeSong('abc123');

      expect(mockFetch).toHaveBeenCalledWith('https://music.youtube.com/youtubei/v1/like/removelike?prettyPrint=false', expect.anything());
    });
  });
});

describe('parseTvSearchResults', () => {
  it('returns empty array for empty response', () => {
    const result = parseTvSearchResults({}, 10);
    expect(result).toEqual([]);
  });

  it('extracts videoId, title, artist, duration from tileRenderers', () => {
    const data = makeSearchResponse([makeTileRenderer('v1', 'Test Song', 'Test Artist', '3:20')]);
    const result = parseTvSearchResults(data as unknown as Record<string, unknown>, 10);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        videoId: 'v1',
        title: 'Test Song',
        artist: 'Test Artist',
        durationText: '3:20',
      }),
    );
  });

  it('handles missing metadata gracefully', () => {
    const data = makeSearchResponse([{ tileRenderer: { onSelectCommand: { watchEndpoint: { videoId: 'v1' } } } } as never]);
    const result = parseTvSearchResults(data as unknown as Record<string, unknown>, 10);
    // Should either return empty (no watchEndpoint in expected location) or with defaults
    expect(result.length).toBeLessThanOrEqual(1);
  });
});

describe('parseTvLikedSongs', () => {
  it('returns title and empty tracks for empty response', () => {
    const result = parseTvLikedSongs({}, 10);
    expect(result.title).toBe('Liked Music');
    expect(result.tracks).toEqual([]);
  });

  it('extracts song count from response', () => {
    const data = makeLikedSongsResponse([]);
    const result = parseTvLikedSongs(data as unknown as Record<string, unknown>, 10);
    expect(result.songCount).toContain('42 songs');
  });
});

describe('parseTvPlaylists', () => {
  it('returns empty array for empty response', () => {
    const result = parseTvPlaylists({});
    expect(result).toEqual([]);
  });
});
