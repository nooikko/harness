declare module 'castv2-client' {
  export class Client {
    connect(host: string, callback: () => void): void;
    launch(app: DefaultMediaReceiver, callback: (err: Error | null, player: MediaPlayer) => void): void;
    close(): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
  }

  export class DefaultMediaReceiver {
    static APP_ID: string;
  }

  export interface MediaPlayer {
    load(media: MediaInfo, options: LoadOptions, callback: (err: Error | null, status: PlayerStatus) => void): void;
    pause(callback: (err: Error | null) => void): void;
    play(callback: (err: Error | null) => void): void;
    stop(callback: (err: Error | null) => void): void;
    seek(time: number, callback: (err: Error | null) => void): void;
    getStatus(callback: (err: Error | null, status: PlayerStatus) => void): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
  }

  export interface MediaInfo {
    contentId: string;
    contentType: string;
    streamType: string;
    metadata?: Record<string, unknown>;
  }

  export interface LoadOptions {
    autoplay?: boolean;
    currentTime?: number;
  }

  export interface PlayerStatus {
    playerState: string;
    currentTime: number;
    media?: {
      duration: number;
    };
  }
}
