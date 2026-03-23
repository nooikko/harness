// Direct Innertube API client using TVHTML5 client context.
// YouTube's device-code OAuth tokens are scoped for TV clients.
// youtubei.js's yt.music.* methods force WEB_REMIX context, which
// is incompatible with TV tokens (400 INVALID_ARGUMENT on all endpoints).
// This module bypasses youtubei.js for authenticated operations by
// sending requests directly with the correct TVHTML5 client context.

// --- Types ---

export type InnertubeCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type InnertubeApiOptions = {
  credentials: InnertubeCredentials;
  onTokenRefreshed?: (updated: InnertubeCredentials) => void;
};

export type TvTrack = {
  videoId: string;
  title: string;
  artist: string;
  durationText: string | undefined;
  thumbnailUrl: string | undefined;
};

export type LikedSongsResult = {
  title: string;
  songCount: string | undefined;
  tracks: TvTrack[];
};

export type PlaylistSummary = {
  playlistId: string;
  title: string;
  trackCount: string | undefined;
  thumbnailUrl: string | undefined;
};

// --- Constants ---

const INNERTUBE_BASE = 'https://music.youtube.com/youtubei/v1';

const TV_CONTEXT = {
  client: {
    clientName: 'TVHTML5' as const,
    clientVersion: '7.20260101.00.00',
    hl: 'en',
    gl: 'US',
  },
};

// Song filter param for search (encoded protobuf: musicSearchType.song = true)
const SONG_FILTER_PARAMS = 'EgWKAQIIAWoKEAMQBBAJEAoQBQ%3D%3D';

// --- API client ---

type InnertubeApiRequest = (endpoint: string, body: Record<string, unknown>) => Promise<unknown>;

type CreateInnertubeApi = (options: InnertubeApiOptions) => {
  searchSongs: (query: string, limit?: number) => Promise<TvTrack[]>;
  getLikedSongs: (limit?: number) => Promise<LikedSongsResult>;
  getPlaylists: () => Promise<PlaylistSummary[]>;
  likeSong: (videoId: string) => Promise<void>;
  unlikeSong: (videoId: string) => Promise<void>;
};

export const createInnertubeApi: CreateInnertubeApi = (options) => {
  const request: InnertubeApiRequest = async (endpoint, body) => {
    const response = await fetch(`${INNERTUBE_BASE}/${endpoint}?prettyPrint=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.credentials.accessToken}`,
      },
      body: JSON.stringify({ context: TV_CONTEXT, ...body }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Innertube ${endpoint} failed (${response.status}): ${text.slice(0, 200)}`);
    }

    return response.json();
  };

  return {
    searchSongs: async (query, limit = 10) => {
      const data = (await request('search', {
        query,
        params: SONG_FILTER_PARAMS,
      })) as Record<string, unknown>;

      return parseTvSearchResults(data, limit);
    },

    getLikedSongs: async (limit = 50) => {
      const data = (await request('browse', {
        browseId: 'VLLM',
      })) as Record<string, unknown>;

      return parseTvLikedSongs(data, limit);
    },

    getPlaylists: async () => {
      const data = (await request('browse', {
        browseId: 'FEmusic_liked_playlists',
      })) as Record<string, unknown>;

      return parseTvPlaylists(data);
    },

    likeSong: async (videoId) => {
      await request('like/like', { target: { videoId } });
    },

    unlikeSong: async (videoId) => {
      await request('like/removelike', { target: { videoId } });
    },
  };
};

// --- Response parsers ---

type ParseTvSearchResults = (data: Record<string, unknown>, limit: number) => TvTrack[];

export const parseTvSearchResults: ParseTvSearchResults = (data, limit) => {
  const contents = data.contents as Record<string, unknown> | undefined;
  const sectionList = contents?.sectionListRenderer as Record<string, unknown> | undefined;
  const sections = sectionList?.contents as Array<Record<string, unknown>> | undefined;
  const shelf = sections?.[0]?.shelfRenderer as Record<string, unknown> | undefined;
  const list = shelf?.content as Record<string, unknown> | undefined;
  const horizontal = list?.horizontalListRenderer as Record<string, unknown> | undefined;
  const items = (horizontal?.items ?? []) as Array<Record<string, unknown>>;

  const tracks: TvTrack[] = [];

  for (const item of items) {
    if (tracks.length >= limit) {
      break;
    }

    const tile = item.tileRenderer as Record<string, unknown> | undefined;
    if (!tile) {
      continue;
    }

    const track = parseTvTile(tile);
    if (track) {
      tracks.push(track);
    }
  }

  return tracks;
};

type ParseTvLikedSongs = (data: Record<string, unknown>, limit: number) => LikedSongsResult;

export const parseTvLikedSongs: ParseTvLikedSongs = (data, limit) => {
  const str = JSON.stringify(data);

  // Extract metadata
  const titleMatch = str.match(/"title":\{"simpleText":"([^"]+)"\}/);
  const countMatch = str.match(/"(\d+ songs?[^"]*)"/);

  // Extract tracks from tileRenderers
  const tracks = extractTilesFromJson(data, limit);

  return {
    title: titleMatch?.[1] ?? 'Liked Music',
    songCount: countMatch?.[1],
    tracks,
  };
};

type ParseTvPlaylists = (data: Record<string, unknown>) => PlaylistSummary[];

export const parseTvPlaylists: ParseTvPlaylists = (data) => {
  const str = JSON.stringify(data);
  const playlists: PlaylistSummary[] = [];

  // Extract playlistIds and titles from tileRenderers
  const tileMatches = [
    ...str.matchAll(/"tileRenderer":\{"style":"[^"]*","header":\{"tileHeaderRenderer":\{"thumbnail":\{"thumbnails":\[\{"url":"([^"]+)"/g),
  ];

  // Simpler approach: find all playlistId + title pairs
  const idMatches = [...str.matchAll(/"playlistId":"([^"]+)"/g)];
  const titleMatches = [...str.matchAll(/"title":\{"simpleText":"([^"]+)"\}/g)];

  // Deduplicate playlistIds
  const seen = new Set<string>();
  for (const match of idMatches) {
    const id = match[1]!;
    if (seen.has(id) || id === 'LM') {
      continue; // Skip LM (liked music) and dupes
    }
    seen.add(id);

    playlists.push({
      playlistId: id,
      title: titleMatches[playlists.length]?.[1] ?? 'Unknown Playlist',
      trackCount: undefined,
      thumbnailUrl: tileMatches[playlists.length]?.[1],
    });
  }

  return playlists;
};

// --- Helpers ---

type ParseTvTile = (tile: Record<string, unknown>) => TvTrack | null;

const parseTvTile: ParseTvTile = (tile) => {
  const str = JSON.stringify(tile);

  // Extract videoId from watchEndpoint
  const videoIdMatch = str.match(/"watchEndpoint":\{[^}]*"videoId":"([^"]+)"/);
  if (!videoIdMatch) {
    return null;
  }

  const metadata = tile.metadata as Record<string, unknown> | undefined;
  const tileMetadata = metadata?.tileMetadataRenderer as Record<string, unknown> | undefined;
  const titleObj = tileMetadata?.title as Record<string, unknown> | undefined;
  const title = (titleObj?.simpleText as string) ?? 'Unknown';

  const lines = tileMetadata?.lines as Array<Record<string, unknown>> | undefined;
  const firstLine = lines?.[0]?.lineRenderer as Record<string, unknown> | undefined;
  const firstLineItems = firstLine?.items as Array<Record<string, unknown>> | undefined;
  const artistItem = firstLineItems?.[0]?.lineItemRenderer as Record<string, unknown> | undefined;
  const artistText = artistItem?.text as Record<string, unknown> | undefined;
  const artist = (artistText?.simpleText as string) ?? 'Unknown';

  const durationMatch = str.match(/"simpleText":"(\d+:\d+)"/);
  const thumbnailMatch = str.match(/"thumbnails":\[\{"url":"([^"]+)"/);

  return {
    videoId: videoIdMatch[1]!,
    title,
    artist,
    durationText: durationMatch?.[1],
    thumbnailUrl: thumbnailMatch?.[1],
  };
};

type ExtractTilesFromJson = (data: Record<string, unknown>, limit: number) => TvTrack[];

const extractTilesFromJson: ExtractTilesFromJson = (data, limit) => {
  const str = JSON.stringify(data);
  const tracks: TvTrack[] = [];

  // Find all tileRenderer blocks by matching videoId + title pairs
  const videoIds = [...str.matchAll(/"watchEndpoint":\{[^}]*"videoId":"([^"]+)"/g)];
  const titles = [...str.matchAll(/"tileMetadataRenderer":\{"title":\{"simpleText":"([^"]+)"\}/g)];

  for (let i = 0; i < Math.min(videoIds.length, titles.length, limit); i++) {
    tracks.push({
      videoId: videoIds[i]![1]!,
      title: titles[i]![1] ?? 'Unknown',
      artist: 'Unknown', // Will be refined by parseTvTile when available
      durationText: undefined,
      thumbnailUrl: undefined,
    });
  }

  return tracks;
};
