import type { OAuthStoredCredentials } from '@harness/plugin-contract';
import Innertube, { UniversalCache } from 'youtubei.js';
import { fetchPoToken } from './fetch-po-token';
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

type MusicLogger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
};

// --- State ---

let innertube: InnertubeClient | null = null;
let poTokenServerUrl: string | undefined;
let log: MusicLogger | null = null;

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

export type MusicClientInitOptions = MusicClientOptions & {
  poTokenServerUrl?: string;
  logger?: MusicLogger;
};

const getFreshPoToken = async (): Promise<string | undefined> => {
  if (!poTokenServerUrl) {
    log?.debug('music: no PO token server configured, skipping');
    return undefined;
  }
  try {
    const token = await fetchPoToken(poTokenServerUrl);
    log?.debug('music: PO token acquired', { serverUrl: poTokenServerUrl, tokenLength: token.length });
    return token;
  } catch (err) {
    log?.warn('music: PO token fetch failed', {
      serverUrl: poTokenServerUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
};

export const replaceYouTubeMusicClient = async (options?: MusicClientInitOptions): Promise<void> => {
  poTokenServerUrl = options?.poTokenServerUrl;
  log = options?.logger ?? null;

  log?.info('music: creating Innertube client', {
    hasOAuth: !!(options?.credentials?.authMethod === 'oauth'),
    hasCookie: !!options?.cookie,
    hasPoToken: !!options?.poToken,
    poTokenServerUrl: poTokenServerUrl ?? '(none)',
    cookieLength: options?.cookie?.length ?? 0,
  });

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
    log?.info('music: OAuth sign-in completed', { logged_in: newClient.session.logged_in });
  }

  // Atomic swap — old client is GC'd, no window where innertube is null
  innertube = newClient;
  log?.info('music: client ready', { logged_in: newClient.session.logged_in });
};

// --- Helpers ---

const getClient = (): InnertubeClient => {
  if (!innertube) {
    throw new Error('YouTube Music client not initialized. Call initYouTubeMusicClient() first.');
  }
  return innertube;
};

export const getRawClient = (): InnertubeClient | null => innertube;

// --- Authenticated search API (TVHTML5) ---
// YouTube's device-code OAuth tokens are scoped for TV clients.
// youtubei.js forces WEB_REMIX context which returns 400 with TV tokens.
// When set, searchSongs uses this API first, falling back to youtubei.js.

type AuthenticatedSearchFn = (query: string, limit: number) => Promise<MusicTrack[]>;

let authenticatedSearchApi: AuthenticatedSearchFn | null = null;

export const setAuthenticatedSearchApi = (api: AuthenticatedSearchFn | null): void => {
  authenticatedSearchApi = api;
};

// --- Search ---

const parseSearchResults = (results: Awaited<ReturnType<InnertubeClient['music']['search']>>, limit: number): MusicTrack[] => {
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

export const searchSongs = async (query: string, limit = 10): Promise<MusicTrack[]> => {
  const yt = getClient();
  log?.debug('music: searchSongs', { query, limit, logged_in: yt.session.logged_in });

  // Use TVHTML5 API when available (avoids WEB_REMIX 400 errors with TV OAuth tokens)
  if (authenticatedSearchApi) {
    try {
      return await authenticatedSearchApi(query, limit);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log?.warn('music: searchSongs TVHTML5 failed, falling back to youtubei.js', { query, error: errMsg });
    }
  }

  try {
    const results = await yt.music.search(query, { type: 'song' });
    return parseSearchResults(results, limit);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.warn('music: searchSongs primary failed', { query, error: errMsg, logged_in: yt.session.logged_in });

    if (!yt.session.logged_in) {
      throw err;
    }

    log?.info('music: searchSongs falling back to anonymous', { query });
    const freshPo = await getFreshPoToken();
    const anonymous = await Innertube.create({
      cache: new UniversalCache(true),
      generate_session_locally: false,
      retrieve_player: true,
      lang: 'en',
      location: 'US',
      ...(freshPo ? { po_token: freshPo } : {}),
    });
    const results = await anonymous.music.search(query, { type: 'song' });
    return parseSearchResults(results, limit);
  }
};

// --- Stream URL ---

export type AudioStream = {
  url: string;
  mimeType: string;
  bitrate: number;
  durationMs: number | undefined;
};

export const getAudioStreamUrl = async (videoId: string): Promise<AudioStream> => {
  log?.info('music: getAudioStreamUrl via yt-dlp', { videoId });

  try {
    const { resolveStreamUrl } = await import('./resolve-stream-url');
    const stream = await resolveStreamUrl(videoId);
    log?.info('music: stream resolved via yt-dlp', {
      videoId,
      mimeType: stream.mimeType,
      bitrate: stream.bitrate,
      urlLength: stream.url.length,
    });
    return stream;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error('music: yt-dlp stream resolution failed', { videoId, error: errMsg });
    throw err;
  }
};

// --- Radio / Up Next ---

export const getUpNextTracks = async (videoId: string, limit = 10): Promise<MusicTrack[]> => {
  const yt = getClient();
  log?.debug('music: getUpNextTracks', { videoId, limit, logged_in: yt.session.logged_in });

  let info: Awaited<ReturnType<InnertubeClient['music']['getInfo']>>;
  try {
    info = await yt.music.getInfo(videoId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.warn('music: getUpNextTracks primary getInfo failed', { videoId, error: errMsg });
    if (!yt.session.logged_in) {
      throw err;
    }
    log?.info('music: getUpNextTracks falling back to anonymous', { videoId });
    const freshPo = await getFreshPoToken();
    const anonymous = await Innertube.create({
      cache: new UniversalCache(true),
      generate_session_locally: true,
      retrieve_player: true,
      lang: 'en',
      location: 'US',
      ...(freshPo ? { po_token: freshPo } : {}),
    });
    info = await anonymous.music.getInfo(videoId);
  }

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
