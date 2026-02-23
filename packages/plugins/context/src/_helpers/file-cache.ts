// Caches file contents with TTL and mtime-based invalidation
// Reduces file system operations on frequent invocations

import { readFileSync, statSync } from 'node:fs';

export type CacheEntry = {
  content: string;
  mtime: number;
  cachedAt: number;
};

export type FileCacheOptions = {
  ttlMs: number;
};

const DEFAULT_TTL_MS = 5000;

type CreateFileCache = (options?: Partial<FileCacheOptions>) => FileCache;

export type FileCache = {
  get: (filePath: string) => string | undefined;
  clear: () => void;
  size: () => number;
};

export const createFileCache: CreateFileCache = (options) => {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const cache = new Map<string, CacheEntry>();

  type Get = (filePath: string) => string | undefined;

  const get: Get = (filePath) => {
    const now = Date.now();
    const existing = cache.get(filePath);

    // Check if entry exists and TTL has not expired
    if (existing && now - existing.cachedAt < ttlMs) {
      // Validate mtime to catch external changes
      try {
        const stats = statSync(filePath);
        if (stats.mtimeMs === existing.mtime) {
          return existing.content;
        }
      } catch {
        // File was deleted, remove from cache
        cache.delete(filePath);
        return undefined;
      }
    }

    // Cache miss or expired — read fresh
    try {
      const content = readFileSync(filePath, 'utf-8');
      const stats = statSync(filePath);
      cache.set(filePath, {
        content,
        mtime: stats.mtimeMs,
        cachedAt: now,
      });
      return content;
    } catch {
      cache.delete(filePath);
      return undefined;
    }
  };

  type Clear = () => void;

  const clear: Clear = () => {
    cache.clear();
  };

  type Size = () => number;

  const size: Size = () => cache.size;

  return { get, clear, size };
};
