import type { OAuthStoredCredentials } from '@harness/plugin-contract';
import Innertube, { UniversalCache } from 'youtubei.js';
import { initWithCredentials } from './youtube-music-auth';

// --- Types ---

export type MusicTrack = {
  videoId: string;
  title: string;
  artist: string;
  album: string | undefined;
  durationSeconds: number | undefined;
  durationText: string | undefined;
  thumbnailUrl: string | undefined;
};

export type MusicClientOptions = {
  credentials?: OAuthStoredCredentials;
  cookie?: string;
  poToken?: string;
};

type InnertubeClient = Awaited<ReturnType<typeof Innertube.create>>;

// --- State ---

let innertube: InnertubeClient | null = null;

// --- Lifecycle ---

export const initYouTubeMusicClient = async (options?: MusicClientOptions): Promise<void> => {
  innertube = await Innertube.create({
    cache: new UniversalCache(true),
    generate_session_locally: false,
    retrieve_player: true,
    lang: 'en',
    location: 'US',
    ...(options?.cookie ? { cookie: options.cookie } : {}),
    ...(options?.poToken ? { po_token: options.poToken } : {}),
  });

  // Sign in with OAuth credentials if provided (cookie auth is handled above)
  if (options?.credentials && options.credentials.authMethod === 'oauth') {
    await initWithCredentials(innertube as unknown as Parameters<typeof initWithCredentials>[0], options.credentials);
  }
};

export const destroyYouTubeMusicClient = (): void => {
  innertube = null;
};

export const replaceYouTubeMusicClient = async (options?: MusicClientOptions): Promise<void> => {
  const newClient = await Innertube.create({
    cache: new UniversalCache(true),
    generate_session_locally: false,
    retrieve_player: true,
    lang: 'en',
    location: 'US',
    ...(options?.cookie ? { cookie: options.cookie } : {}),
    ...(options?.poToken ? { po_token: options.poToken } : {}),
  });

  if (options?.credentials && options.credentials.authMethod === 'oauth') {
    await initWithCredentials(newClient as unknown as Parameters<typeof initWithCredentials>[0], options.credentials);
  }

  // Atomic swap — old client is GC'd, no window where innertube is null
  innertube = newClient;
};

// --- Helpers ---

const getClient = (): InnertubeClient => {
  if (!innertube) {
    throw new Error('YouTube Music client not initialized. Call initYouTubeMusicClient() first.');
  }
  return innertube;
};

export const getRawClient = (): InnertubeClient | null => innertube;

// --- Search ---

export const searchSongs = async (query: string, limit = 10): Promise<MusicTrack[]> => {
  const yt = getClient();
  const results = await yt.music.search(query, { type: 'song' });

  const items = results.songs?.contents ?? [];
  const tracks: MusicTrack[] = [];

  for (const item of items) {
    if (tracks.length >= limit) {
      break;
    }
    const videoId = item.id;
    if (!videoId) {
      continue;
    }

    tracks.push({
      videoId,
      title: item.title ?? 'Unknown',
      artist: item.artists?.[0]?.name ?? item.author?.name ?? 'Unknown',
      album: item.album?.name,
      durationSeconds: item.duration?.seconds,
      durationText: item.duration?.text,
      thumbnailUrl: item.thumbnails?.at(-1)?.url,
    });
  }

  return tracks;
};

// --- Stream URL ---

export type AudioStream = {
  url: string;
  mimeType: string;
  bitrate: number;
  durationMs: number | undefined;
};

export const getAudioStreamUrl = async (videoId: string): Promise<AudioStream> => {
  const yt = getClient();
  const info = await yt.music.getInfo(videoId);

  const adaptiveFormats = info.streaming_data?.adaptive_formats ?? [];
  const audioFormats = adaptiveFormats.filter((f) => f.has_audio && !f.has_video);

  if (audioFormats.length === 0) {
    throw new Error(`No audio streams found for videoId: ${videoId}`);
  }

  // Prefer opus/webm (higher quality), fall back to others
  const opus = audioFormats.filter((f) => f.mime_type?.includes('opus'));
  const candidates = opus.length > 0 ? opus : audioFormats;

  // Sort by bitrate descending
  candidates.sort((a, b) => (b.average_bitrate ?? b.bitrate ?? 0) - (a.average_bitrate ?? a.bitrate ?? 0));

  const best = candidates[0];
  if (!best) {
    throw new Error(`No suitable audio format for videoId: ${videoId}`);
  }

  // v17+: URLs may not be pre-deciphered — call decipher() if needed
  let url = best.url;
  if (!url && typeof best.decipher === 'function') {
    url = await best.decipher();
  }
  if (!url) {
    throw new Error(`Failed to decipher stream URL for videoId: ${videoId}`);
  }

  return {
    url,
    mimeType: best.mime_type ?? 'audio/webm',
    bitrate: best.average_bitrate ?? best.bitrate ?? 0,
    durationMs: best.approx_duration_ms,
  };
};

// --- Radio / Up Next ---

export const getUpNextTracks = async (videoId: string, limit = 10): Promise<MusicTrack[]> => {
  const yt = getClient();
  const info = await yt.music.getInfo(videoId);
  const upNext = await info.getUpNext();

  if (!upNext?.contents) {
    return [];
  }

  const tracks: MusicTrack[] = [];
  for (const item of upNext.contents) {
    if (tracks.length >= limit) {
      break;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- youtubei.js union types lack shared interface
    const vid = item as unknown as Record<string, unknown>;
    const id = vid.video_id as string | undefined;
    if (!id || id === videoId) {
      continue; // skip the current track
    }

    tracks.push({
      videoId: id,
      title: String((vid.title as { toString?: () => string })?.toString?.() ?? 'Unknown'),
      artist: String(((vid.artists as Array<{ name: string }>) ?? [])[0]?.name ?? vid.author ?? 'Unknown'),
      album: (vid.album as { name?: string })?.name,
      durationSeconds: (vid.duration as { seconds?: number })?.seconds,
      durationText: (vid.duration as { text?: string })?.text,
      thumbnailUrl: ((vid.thumbnail as Array<{ url: string }>) ?? []).at(-1)?.url,
    });
  }

  return tracks;
};
