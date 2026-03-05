import type { CastDevice } from './cast-device-manager';
import { setDefaultDevice } from './cast-device-manager';
import type { CastClient, CastMedia, MediaController, MediaStatus } from './cast-types';
import type { MusicTrack } from './youtube-music-client';
import { getAudioStreamUrl, getUpNextTracks } from './youtube-music-client';

// --- Types ---

export type DevicePlaybackState = {
  device: CastDevice;
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  radioEnabled: boolean;
  playerState: 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING';
};

type ActiveSession = {
  device: CastDevice;
  client: CastClient;
  player: MediaController;
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  radioEnabled: boolean;
  playerState: 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING';
};

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
};

// Dynamic import for castv2-client (CommonJS module)
const loadCastv2 = async (): Promise<{
  Client: new () => CastClient;
  DefaultMediaReceiver: unknown;
}> => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = await import('castv2-client');
  return mod as unknown as {
    Client: new () => CastClient;
    DefaultMediaReceiver: unknown;
  };
};

// --- State ---

const sessions = new Map<string, ActiveSession>();
let logger: Logger | null = null;

// --- Lifecycle ---

export const initPlaybackController = (log: Logger): void => {
  logger = log;
};

export const destroyPlaybackController = (): void => {
  for (const session of sessions.values()) {
    try {
      session.player.removeAllListeners();
      session.client.removeAllListeners();
      session.client.close();
    } catch {
      // best effort cleanup
    }
  }
  sessions.clear();
  logger = null;
};

// --- Connection ---

const connectToDevice = async (device: CastDevice): Promise<ActiveSession> => {
  const existing = sessions.get(device.id);
  if (existing) {
    return existing;
  }

  const { Client, DefaultMediaReceiver } = await loadCastv2();
  const client = new Client() as CastClient;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.close();
      reject(new Error(`Connection to "${device.name}" timed out after 10s`));
    }, 10_000);

    client.on('error', (err) => {
      clearTimeout(timeout);
      sessions.delete(device.id);
      logger?.error(`music: Cast client error for "${device.name}": ${err}`);
    });

    client.connect(device.host, () => {
      clearTimeout(timeout);
      client.launch(DefaultMediaReceiver, (err, player) => {
        if (err) {
          client.close();
          reject(new Error(`Failed to launch receiver on "${device.name}": ${err.message}`));
          return;
        }

        const session: ActiveSession = {
          device,
          client,
          player,
          currentTrack: null,
          queue: [],
          radioEnabled: true,
          playerState: 'IDLE',
        };

        // Listen for status changes (track end, state changes)
        player.on('status', (status: MediaStatus) => {
          session.playerState = status.playerState;

          if (status.playerState === 'IDLE' && status.idleReason === 'FINISHED') {
            void playNextInQueue(session);
          }
        });

        sessions.set(device.id, session);
        setDefaultDevice(device.name);
        resolve(session);
      });
    });
  });
};

// --- Playback ---

export const playTrack = async (device: CastDevice, track: MusicTrack, radioEnabled = true): Promise<string> => {
  const session = await connectToDevice(device);
  session.radioEnabled = radioEnabled;

  // Get audio stream URL (must be fresh — URLs expire)
  const stream = await getAudioStreamUrl(track.videoId);

  const media: CastMedia = {
    contentId: stream.url,
    contentType: stream.mimeType,
    streamType: 'BUFFERED',
    metadata: {
      type: 0, // MusicTrackMediaMetadata
      metadataType: 3, // MUSIC_TRACK
      title: track.title,
      artist: track.artist,
      albumName: track.album,
      images: track.thumbnailUrl ? [{ url: track.thumbnailUrl }] : [],
    },
  };

  return new Promise((resolve, reject) => {
    session.player.load(media, { autoplay: true }, (err, _status) => {
      if (err) {
        reject(new Error(`Failed to play "${track.title}": ${err.message}`));
        return;
      }

      session.currentTrack = track;
      session.playerState = 'PLAYING';

      // Pre-fetch radio tracks in background
      if (radioEnabled && session.queue.length < 2) {
        void prefetchRadioTracks(session, track.videoId);
      }

      resolve(`Now playing: ${track.title} by ${track.artist} on ${device.name}`);
    });
  });
};

export const pausePlayback = async (device: CastDevice): Promise<string> => {
  const session = sessions.get(device.id);
  if (!session) {
    return `No active playback on "${device.name}".`;
  }

  return new Promise((resolve) => {
    session.player.pause((err) => {
      if (err) {
        resolve(`Failed to pause: ${err.message}`);
        return;
      }
      session.playerState = 'PAUSED';
      resolve(`Paused on ${device.name}.`);
    });
  });
};

export const resumePlayback = async (device: CastDevice): Promise<string> => {
  const session = sessions.get(device.id);
  if (!session) {
    return `No active playback on "${device.name}".`;
  }

  return new Promise((resolve) => {
    session.player.play((err) => {
      if (err) {
        resolve(`Failed to resume: ${err.message}`);
        return;
      }
      session.playerState = 'PLAYING';
      resolve(`Resumed on ${device.name}.`);
    });
  });
};

export const stopPlayback = async (device: CastDevice): Promise<string> => {
  const session = sessions.get(device.id);
  if (!session) {
    return `No active playback on "${device.name}".`;
  }

  session.queue = [];
  session.currentTrack = null;

  return new Promise((resolve) => {
    session.player.stop((err) => {
      if (err) {
        resolve(`Failed to stop: ${err.message}`);
        return;
      }
      session.playerState = 'IDLE';
      resolve(`Stopped playback and cleared queue on ${device.name}.`);
    });
  });
};

export const skipTrack = async (device: CastDevice): Promise<string> => {
  const session = sessions.get(device.id);
  if (!session) {
    return `No active playback on "${device.name}".`;
  }

  if (session.queue.length === 0) {
    return `Queue is empty on ${device.name}. Nothing to skip to.`;
  }

  const next = session.queue[0];
  if (!next) {
    return `Queue is empty on ${device.name}.`;
  }

  return playNextInQueue(session);
};

export const setVolume = async (device: CastDevice, level: number): Promise<string> => {
  const session = sessions.get(device.id);
  if (!session) {
    return `No active session on "${device.name}".`;
  }

  const clamped = Math.max(0, Math.min(1, level));

  return new Promise((resolve) => {
    session.client.receiver.setVolume({ level: clamped }, (err) => {
      if (err) {
        resolve(`Failed to set volume: ${err.message}`);
        return;
      }
      resolve(`Volume set to ${Math.round(clamped * 100)}% on ${device.name}.`);
    });
  });
};

// --- Queue ---

export const addToQueue = (device: CastDevice, track: MusicTrack): string => {
  const session = sessions.get(device.id);
  if (!session) {
    return `No active session on "${device.name}". Play a song first.`;
  }

  session.queue.push(track);
  return `Added "${track.title}" by ${track.artist} to queue. Queue length: ${session.queue.length}`;
};

export const getQueueState = (device: CastDevice): DevicePlaybackState | null => {
  const session = sessions.get(device.id);
  if (!session) {
    return null;
  }

  return {
    device: session.device,
    currentTrack: session.currentTrack,
    queue: [...session.queue],
    radioEnabled: session.radioEnabled,
    playerState: session.playerState,
  };
};

// --- Internal ---

const playNextInQueue = async (session: ActiveSession): Promise<string> => {
  const next = session.queue.shift();
  if (!next) {
    if (session.radioEnabled && session.currentTrack) {
      // Fetch more radio tracks
      const radioTracks = await fetchRadioTracks(session.currentTrack.videoId);
      if (radioTracks.length > 0) {
        session.queue.push(...radioTracks);
        const first = session.queue.shift();
        if (first) {
          return playTrackOnSession(session, first);
        }
      }
    }
    session.currentTrack = null;
    session.playerState = 'IDLE';
    return 'Queue finished.';
  }

  return playTrackOnSession(session, next);
};

const playTrackOnSession = async (session: ActiveSession, track: MusicTrack): Promise<string> => {
  try {
    const stream = await getAudioStreamUrl(track.videoId);

    const media: CastMedia = {
      contentId: stream.url,
      contentType: stream.mimeType,
      streamType: 'BUFFERED',
      metadata: {
        type: 0,
        metadataType: 3,
        title: track.title,
        artist: track.artist,
        albumName: track.album,
        images: track.thumbnailUrl ? [{ url: track.thumbnailUrl }] : [],
      },
    };

    return new Promise((resolve) => {
      session.player.load(media, { autoplay: true }, (err) => {
        if (err) {
          logger?.warn(`music: Failed to play next track "${track.title}": ${err.message}`);
          // Try next track in queue
          void playNextInQueue(session);
          resolve(`Skipped "${track.title}" (error), trying next...`);
          return;
        }
        session.currentTrack = track;
        session.playerState = 'PLAYING';

        // Pre-fetch more if queue is getting low
        if (session.radioEnabled && session.queue.length < 2) {
          void prefetchRadioTracks(session, track.videoId);
        }

        resolve(`Now playing: ${track.title} by ${track.artist}`);
      });
    });
  } catch (err) {
    logger?.warn(`music: Stream extraction failed for "${track.title}": ${err instanceof Error ? err.message : err}`);
    // Try next track
    return playNextInQueue(session);
  }
};

const fetchRadioTracks = async (videoId: string): Promise<MusicTrack[]> => {
  try {
    return await getUpNextTracks(videoId, 5);
  } catch (err) {
    logger?.warn(`music: Failed to fetch radio tracks: ${err instanceof Error ? err.message : err}`);
    return [];
  }
};

const prefetchRadioTracks = async (session: ActiveSession, videoId: string): Promise<void> => {
  const tracks = await fetchRadioTracks(videoId);
  // Only add tracks not already in queue
  const existingIds = new Set(session.queue.map((t) => t.videoId));
  const newTracks = tracks.filter((t) => !existingIds.has(t.videoId));
  session.queue.push(...newTracks);
  logger?.debug(`music: Pre-fetched ${newTracks.length} radio tracks for queue`);
};
