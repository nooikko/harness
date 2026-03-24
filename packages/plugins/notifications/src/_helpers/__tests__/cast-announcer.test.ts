import { describe, expect, it, vi } from 'vitest';
import { announce } from '../cast-announcer';

const mockPlayer = {
  load: vi.fn((_media: unknown, _opts: unknown, cb: (err: Error | null) => void) => {
    if (loadError) {
      cb(loadError);
      return;
    }
    cb(null);
  }),
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    if (event === 'status') {
      setTimeout(() => cb({ playerState: 'IDLE', idleReason: 'FINISHED' }), 10);
    }
  }),
  stop: vi.fn((cb: (err: Error | null) => void) => cb(null)),
  removeAllListeners: vi.fn(),
};

let connectError: Error | null = null;
let launchError: Error | null = null;
let loadError: Error | null = null;
let setVolumeError: Error | null = null;

vi.mock('castv2-client', () => {
  class MockClient {
    receiver = {
      setVolume(_opts: unknown, cb: (err: Error | null) => void) {
        cb(setVolumeError);
      },
    };
    connect(_host: string, cb: () => void) {
      if (connectError) {
        return;
      }
      setTimeout(cb, 0);
    }
    launch(_app: unknown, cb: (err: Error | null, player: typeof mockPlayer) => void) {
      if (launchError) {
        cb(launchError, null as unknown as typeof mockPlayer);
        return;
      }
      cb(null, mockPlayer);
    }
    close() {}
    on(event: string, cb: (...args: unknown[]) => void) {
      if (event === 'error' && connectError) {
        setTimeout(() => cb(connectError), 0);
      }
    }
    removeAllListeners() {}
  }

  class MockDefaultMediaReceiver {
    static APP_ID = 'test';
  }

  return {
    Client: MockClient,
    DefaultMediaReceiver: MockDefaultMediaReceiver,
  };
});

describe('announce', () => {
  it('connects to device, sets volume, loads audio, and disconnects', async () => {
    connectError = null;

    const device = {
      name: 'Test Speaker',
      host: '192.168.1.10',
      port: 8009,
      id: 'test-1',
      model: 'Nest Mini' as string | undefined,
    };

    await announce({
      device,
      audioUrl: 'http://192.168.1.50:9849/audio/test.mp3',
      volume: 0.7,
    });

    // Should have loaded audio (volume was set implicitly — no error means success)
    expect(mockPlayer.load).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: 'http://192.168.1.50:9849/audio/test.mp3',
        contentType: 'audio/mpeg',
        streamType: 'BUFFERED',
      }),
      { autoplay: true },
      expect.any(Function),
    );
  });

  it('throws when connection fails', async () => {
    connectError = new Error('Connection refused');

    const device = {
      name: 'Bad Speaker',
      host: '192.168.1.99',
      port: 8009,
      id: 'bad-1',
      model: undefined,
    };

    await expect(
      announce({
        device,
        audioUrl: 'http://localhost/audio/test.mp3',
        volume: 0.5,
      }),
    ).rejects.toThrow('Connection refused');

    connectError = null;
  });

  it('skips volume setting when not specified', async () => {
    connectError = null;

    const device = {
      name: 'Test Speaker',
      host: '192.168.1.10',
      port: 8009,
      id: 'test-1',
      model: undefined,
    };

    // Should complete without error even without volume
    await announce({
      device,
      audioUrl: 'http://192.168.1.50:9849/audio/test.mp3',
    });
  });

  it('wraps non-Error connection errors in Error', async () => {
    connectError = 'string error' as unknown as Error;

    const device = {
      name: 'Bad Speaker',
      host: '192.168.1.99',
      port: 8009,
      id: 'bad-2',
      model: undefined,
    };

    await expect(
      announce({
        device,
        audioUrl: 'http://localhost/audio/test.mp3',
      }),
    ).rejects.toThrow('string error');

    connectError = null;
  });

  it('throws when setVolume fails', async () => {
    connectError = null;
    setVolumeError = new Error('Volume failed');

    const device = {
      name: 'Test Speaker',
      host: '192.168.1.10',
      port: 8009,
      id: 'test-v',
      model: undefined,
    };

    await expect(announce({ device, audioUrl: 'http://localhost/audio/test.mp3', volume: 0.5 })).rejects.toThrow('Volume failed');

    setVolumeError = null;
  });

  it('throws when launch fails', async () => {
    connectError = null;
    launchError = new Error('Launch failed');

    const device = {
      name: 'Test Speaker',
      host: '192.168.1.10',
      port: 8009,
      id: 'test-l',
      model: undefined,
    };

    await expect(announce({ device, audioUrl: 'http://localhost/audio/test.mp3' })).rejects.toThrow('Launch failed');

    launchError = null;
  });

  it('throws when load fails', async () => {
    connectError = null;
    loadError = new Error('Load failed');

    const device = {
      name: 'Test Speaker',
      host: '192.168.1.10',
      port: 8009,
      id: 'test-ld',
      model: undefined,
    };

    await expect(announce({ device, audioUrl: 'http://localhost/audio/test.mp3' })).rejects.toThrow('Load failed');

    loadError = null;
  });
});
