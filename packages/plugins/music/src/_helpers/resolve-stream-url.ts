// Resolves a playable audio stream URL for a YouTube Music video using yt-dlp.
// yt-dlp handles cipher rotation, PO tokens, and all YouTube-side auth internally.
// This replaces youtubei.js's broken decipher() which returns empty strings as of v17.0.1.

import { execFile } from 'node:child_process';
import type { AudioStream } from './youtube-music-client';

const TIMEOUT_MS = 15_000;

const EXT_TO_MIME: Record<string, string> = {
  webm: 'audio/webm',
  opus: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
};

type YtDlpOutput = {
  url?: string;
  ext?: string;
  abr?: number;
  duration?: number;
  acodec?: string;
};

type ResolveStreamUrl = (videoId: string) => Promise<AudioStream>;

export const resolveStreamUrl: ResolveStreamUrl = (videoId) => {
  const args = ['--dump-json', '--no-download', '--no-warnings', '--format', 'bestaudio', `https://music.youtube.com/watch?v=${videoId}`];

  return new Promise((resolve, reject) => {
    execFile('yt-dlp', args, { timeout: TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err) {
        const detail = stderr?.trim() || err.message;
        reject(new Error(`yt-dlp failed for ${videoId}: ${detail}`));
        return;
      }

      let data: YtDlpOutput;
      try {
        data = JSON.parse(stdout) as YtDlpOutput;
      } catch {
        reject(new Error(`yt-dlp returned invalid JSON for ${videoId}: ${stdout.slice(0, 100)}`));
        return;
      }

      if (!data.url) {
        reject(new Error(`yt-dlp returned no stream URL for ${videoId}`));
        return;
      }

      const ext = data.ext ?? 'webm';

      resolve({
        url: data.url,
        mimeType: EXT_TO_MIME[ext] ?? 'audio/webm',
        bitrate: Math.round((data.abr ?? 0) * 1000),
        durationMs: data.duration ? Math.round(data.duration * 1000) : undefined,
      });
    });
  });
};
