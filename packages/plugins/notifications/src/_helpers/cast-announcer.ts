import type { CastDevice } from './device-resolver';

// --- Types ---

type AnnounceOptions = {
  device: CastDevice;
  audioUrl: string;
  volume?: number;
};

type Announce = (options: AnnounceOptions) => Promise<void>;

// --- Constants ---

const CONNECT_TIMEOUT_MS = 10_000;
const PLAYBACK_TIMEOUT_MS = 60_000;

// --- Dynamic import for castv2-client (CommonJS module) ---

type CastClient = {
  connect: (host: string, callback: () => void) => void;
  launch: (app: unknown, callback: (err: Error | null, player: CastPlayer) => void) => void;
  receiver: {
    setVolume: (opts: { level?: number; muted?: boolean }, callback: (err: Error | null) => void) => void;
  };
  close: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  removeAllListeners: (event?: string) => void;
};

type CastPlayer = {
  load: (
    media: { contentId: string; contentType: string; streamType: string },
    options: { autoplay: boolean },
    callback: (err: Error | null) => void,
  ) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  stop: (callback: (err: Error | null) => void) => void;
  removeAllListeners: (event?: string) => void;
};

type PlayerStatus = {
  playerState: string;
  idleReason?: string;
};

const loadCastv2 = async (): Promise<{
  Client: new () => CastClient;
  DefaultMediaReceiver: unknown;
}> => {
  const mod = await import('castv2-client');
  return mod as unknown as {
    Client: new () => CastClient;
    DefaultMediaReceiver: unknown;
  };
};

// --- Implementation ---

export const announce: Announce = async ({ device, audioUrl, volume }) => {
  const { Client, DefaultMediaReceiver } = await loadCastv2();
  const client = new Client();

  try {
    // Connect to device
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection to ${device.name} timed out`));
      }, CONNECT_TIMEOUT_MS);

      client.on('error', (err: unknown) => {
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      client.connect(device.host, () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Set volume if specified
    if (volume !== undefined) {
      await new Promise<void>((resolve, reject) => {
        client.receiver.setVolume({ level: volume }, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    }

    // Launch media receiver and load audio
    const player = await new Promise<CastPlayer>((resolve, reject) => {
      client.launch(DefaultMediaReceiver, (err, p) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(p);
      });
    });

    await new Promise<void>((resolve, reject) => {
      player.load(
        {
          contentId: audioUrl,
          contentType: 'audio/mpeg',
          streamType: 'BUFFERED',
        },
        { autoplay: true },
        (err) => {
          if (err) {
            reject(err);
            return;
          }
        },
      );

      // Wait for playback to finish
      const timeout = setTimeout(() => {
        resolve(); // Don't reject on timeout — the audio probably played
      }, PLAYBACK_TIMEOUT_MS);

      player.on('status', (status: unknown) => {
        const s = status as PlayerStatus;
        if (s.playerState === 'IDLE' && s.idleReason === 'FINISHED') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  } finally {
    client.close();
  }
};
