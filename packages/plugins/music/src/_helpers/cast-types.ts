/**
 * Type declarations for castv2-client.
 * The library has no native TS types — these cover the subset we use.
 */

export type MediaStatus = {
  mediaSessionId: number;
  playbackRate: number;
  playerState: 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING';
  currentTime: number;
  idleReason?: 'CANCELLED' | 'INTERRUPTED' | 'FINISHED' | 'ERROR';
  volume?: { level: number; muted: boolean };
  media?: {
    contentId: string;
    contentType: string;
    streamType: string;
    duration: number;
    metadata?: Record<string, unknown>;
  };
};

export type CastMedia = {
  contentId: string;
  contentType: string;
  streamType: 'BUFFERED' | 'LIVE';
  metadata?: {
    type?: number;
    metadataType?: number;
    title?: string;
    subtitle?: string;
    artist?: string;
    albumName?: string;
    images?: Array<{ url: string }>;
  };
};

export type LoadOptions = {
  autoplay?: boolean;
  currentTime?: number;
};

export type MediaController = {
  load: (media: CastMedia, options: LoadOptions, callback: (err: Error | null, status: MediaStatus) => void) => void;
  play: (callback?: (err: Error | null, status: MediaStatus) => void) => void;
  pause: (callback?: (err: Error | null, status: MediaStatus) => void) => void;
  stop: (callback?: (err: Error | null, status: MediaStatus) => void) => void;
  seek: (currentTime: number, callback?: (err: Error | null, status: MediaStatus) => void) => void;
  getStatus: (callback: (err: Error | null, status: MediaStatus) => void) => void;
  on: (event: 'status', listener: (status: MediaStatus) => void) => void;
  removeAllListeners: (event?: string) => void;
};

export type ReceiverController = {
  setVolume: (options: { level?: number; muted?: boolean }, callback: (err: Error | null, volume: { level: number; muted: boolean }) => void) => void;
  getStatus: (callback: (err: Error | null, status: { volume: { level: number; muted: boolean } }) => void) => void;
};

export type CastClient = {
  connect: (host: string, callback: () => void) => void;
  launch: (app: unknown, callback: (err: Error | null, player: MediaController) => void) => void;
  receiver: ReceiverController;
  close: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  removeAllListeners: (event?: string) => void;
};
