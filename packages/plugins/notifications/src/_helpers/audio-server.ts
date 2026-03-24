import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { resolveLanIp } from './resolve-lan-ip';

// --- Types ---

type AudioEntry = {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
};

type AudioServerOptions = {
  port?: number;
  ttlMs?: number;
};

type AudioServerInfo = {
  host: string;
  port: number;
};

type AudioServer = {
  start: () => Promise<AudioServerInfo>;
  stop: () => Promise<void>;
  register: (buffer: Buffer, contentType: string) => string;
};

type CreateAudioServer = (options?: AudioServerOptions) => AudioServer;

// --- Constants ---

const DEFAULT_TTL_MS = 60_000; // 1 minute
const DEFAULT_CLEANUP_INTERVAL_MS = 10_000; // check every 10s

// --- Implementation ---

export const createAudioServer: CreateAudioServer = (options = {}) => {
  const port = options.port ?? 9849;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  const entries = new Map<string, AudioEntry>();
  let server: Server | null = null;
  let cleanupTimer: ReturnType<typeof setInterval> | null = null;
  let resolvedHost = '';
  let resolvedPort = 0;

  const cleanup = () => {
    const now = Date.now();
    for (const [id, entry] of entries) {
      if (now - entry.createdAt > ttlMs) {
        entries.delete(id);
      }
    }
  };

  const start = async (): Promise<AudioServerInfo> => {
    resolvedHost = resolveLanIp();

    return new Promise((resolve, reject) => {
      server = createServer((req, res) => {
        const match = req.url?.match(/^\/audio\/([^/]+)\.mp3$/);
        if (!match?.[1]) {
          res.writeHead(404);
          res.end();
          return;
        }

        const entry = entries.get(match[1]);
        if (!entry || Date.now() - entry.createdAt > ttlMs) {
          if (entry) {
            entries.delete(match[1]);
          }
          res.writeHead(404);
          res.end();
          return;
        }

        res.writeHead(200, {
          'Content-Type': entry.contentType,
          'Content-Length': entry.buffer.length,
          'Cache-Control': 'no-cache',
        });
        res.end(entry.buffer);
      });

      server.on('error', reject);

      server.listen(port, '0.0.0.0', () => {
        const addr = server?.address();
        if (addr && typeof addr === 'object') {
          resolvedPort = addr.port;
        }
        cleanupTimer = setInterval(cleanup, DEFAULT_CLEANUP_INTERVAL_MS);
        resolve({ host: resolvedHost, port: resolvedPort });
      });
    });
  };

  const stop = async (): Promise<void> => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
    entries.clear();

    return new Promise((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => {
        server = null;
        resolve();
      });
    });
  };

  const register = (buffer: Buffer, contentType: string): string => {
    const id = randomUUID();
    entries.set(id, { buffer, contentType, createdAt: Date.now() });
    return `http://${resolvedHost}:${resolvedPort}/audio/${id}.mp3`;
  };

  return { start, stop, register };
};
