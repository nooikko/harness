import { execFile } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);

import { resolveStreamUrl } from '../resolve-stream-url';

// Helper to simulate execFile callback
const simulateExecFile = (stdout: string, stderr = '', exitCode = 0) => {
  mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
    const callback = cb as (err: Error | null, stdout: string, stderr: string) => void;
    if (exitCode !== 0) {
      const err = new Error(stderr || 'Process failed') as Error & {
        code: number;
      };
      err.code = exitCode;
      callback(err, stdout, stderr);
    } else {
      callback(null, stdout, stderr);
    }
    return {} as ReturnType<typeof execFile>;
  });
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('resolveStreamUrl', () => {
  it('returns stream URL from yt-dlp JSON output', async () => {
    simulateExecFile(
      JSON.stringify({
        url: 'https://rr6---sn-xxx.googlevideo.com/videoplayback?expire=123',
        ext: 'webm',
        abr: 128.5,
        duration: 210,
        acodec: 'opus',
      }),
    );

    const result = await resolveStreamUrl('fQuhs498lzI');

    expect(result.url).toContain('googlevideo.com');
    expect(result.mimeType).toBe('audio/webm');
    expect(result.bitrate).toBe(128500);
    expect(result.durationMs).toBe(210000);
  });

  it('passes correct arguments to yt-dlp', async () => {
    simulateExecFile(
      JSON.stringify({
        url: 'https://example.com/stream',
        ext: 'm4a',
        abr: 256,
        duration: 180,
      }),
    );

    await resolveStreamUrl('abc123');

    expect(mockExecFile).toHaveBeenCalledWith(
      'yt-dlp',
      expect.arrayContaining(['--dump-json', '--no-download', '--format', 'bestaudio', 'https://music.youtube.com/watch?v=abc123']),
      expect.objectContaining({ timeout: expect.any(Number) }),
      expect.any(Function),
    );
  });

  it('maps m4a extension to audio/mp4 mime type', async () => {
    simulateExecFile(
      JSON.stringify({
        url: 'https://example.com/stream',
        ext: 'm4a',
        abr: 256,
        duration: 180,
      }),
    );

    const result = await resolveStreamUrl('abc123');
    expect(result.mimeType).toBe('audio/mp4');
  });

  it('maps opus extension to audio/webm', async () => {
    simulateExecFile(
      JSON.stringify({
        url: 'https://example.com/stream',
        ext: 'opus',
        abr: 128,
        duration: 200,
      }),
    );

    const result = await resolveStreamUrl('abc123');
    expect(result.mimeType).toBe('audio/webm');
  });

  it('defaults to audio/webm for unknown extensions', async () => {
    simulateExecFile(
      JSON.stringify({
        url: 'https://example.com/stream',
        ext: 'ogg',
        abr: 96,
        duration: 150,
      }),
    );

    const result = await resolveStreamUrl('abc123');
    expect(result.mimeType).toBe('audio/webm');
  });

  it('throws when yt-dlp exits with error', async () => {
    simulateExecFile('', 'ERROR: Video unavailable', 1);

    await expect(resolveStreamUrl('bad-id')).rejects.toThrow('yt-dlp failed');
  });

  it('throws when yt-dlp returns invalid JSON', async () => {
    simulateExecFile('not json at all');

    await expect(resolveStreamUrl('abc123')).rejects.toThrow('yt-dlp returned invalid JSON');
  });

  it('throws when yt-dlp returns no URL', async () => {
    simulateExecFile(
      JSON.stringify({
        ext: 'webm',
        abr: 128,
        duration: 200,
      }),
    );

    await expect(resolveStreamUrl('abc123')).rejects.toThrow('yt-dlp returned no stream URL');
  });

  it('handles missing duration gracefully', async () => {
    simulateExecFile(
      JSON.stringify({
        url: 'https://example.com/stream',
        ext: 'webm',
        abr: 128,
      }),
    );

    const result = await resolveStreamUrl('abc123');
    expect(result.durationMs).toBeUndefined();
  });

  it('handles missing abr gracefully', async () => {
    simulateExecFile(
      JSON.stringify({
        url: 'https://example.com/stream',
        ext: 'webm',
        duration: 200,
      }),
    );

    const result = await resolveStreamUrl('abc123');
    expect(result.bitrate).toBe(0);
  });
});
