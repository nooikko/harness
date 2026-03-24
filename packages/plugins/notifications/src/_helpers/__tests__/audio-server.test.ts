import { afterEach, describe, expect, it } from 'vitest';
import { createAudioServer } from '../audio-server';

describe('createAudioServer', () => {
  let server: ReturnType<typeof createAudioServer>;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('starts on a specified port', async () => {
    server = createAudioServer({ port: 0 }); // port 0 = random available port
    const info = await server.start();
    expect(info.port).toBeGreaterThan(0);
    expect(info.host).toBeTruthy();
  });

  it('serves a registered audio buffer and returns a URL', async () => {
    server = createAudioServer({ port: 0 });
    const info = await server.start();
    const audioBuffer = Buffer.from('fake-mp3-data');

    const url = server.register(audioBuffer, 'audio/mpeg');

    expect(url).toContain(`http://${info.host}:${info.port}/audio/`);
    expect(url).toContain('.mp3');

    // Verify the audio is actually served
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    const body = Buffer.from(await response.arrayBuffer());
    expect(body).toEqual(audioBuffer);
  });

  it('returns 404 for unknown audio IDs', async () => {
    server = createAudioServer({ port: 0 });
    const info = await server.start();

    const response = await fetch(`http://${info.host}:${info.port}/audio/nonexistent.mp3`);
    expect(response.status).toBe(404);
  });

  it('auto-cleans expired audio files', async () => {
    server = createAudioServer({ port: 0, ttlMs: 50 }); // 50ms TTL for test
    const _info = await server.start();
    const url = server.register(Buffer.from('data'), 'audio/mpeg');

    // Should be available immediately
    const res1 = await fetch(url);
    expect(res1.status).toBe(200);

    // Wait for TTL + cleanup interval
    await new Promise((r) => setTimeout(r, 200));

    // Should be gone
    const res2 = await fetch(url);
    expect(res2.status).toBe(404);
  });

  it('returns 404 for non-audio paths', async () => {
    server = createAudioServer({ port: 0 });
    const info = await server.start();

    const response = await fetch(`http://${info.host}:${info.port}/other/path`);
    expect(response.status).toBe(404);
  });

  it('returns 404 for root path', async () => {
    server = createAudioServer({ port: 0 });
    const info = await server.start();

    const response = await fetch(`http://${info.host}:${info.port}/`);
    expect(response.status).toBe(404);
  });

  it('stops cleanly', async () => {
    server = createAudioServer({ port: 0 });
    await server.start();

    await server.stop();

    // Attempting to register after stop should still work (in-memory)
    // but fetching should fail since the server is closed
    // We just verify stop() doesn't throw
  });
});
