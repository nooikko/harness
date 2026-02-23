import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileCache } from '../file-cache';

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(resolve(tmpdir(), 'harness-ctx-fc-'));
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('createFileCache', () => {
  it('reads and caches file content', () => {
    const filePath = resolve(TEST_DIR, 'test.md');
    writeFileSync(filePath, 'cached content');

    const cache = createFileCache();
    const content = cache.get(filePath);

    expect(content).toBe('cached content');
  });

  it('returns cached content on subsequent reads', () => {
    const filePath = resolve(TEST_DIR, 'test.md');
    writeFileSync(filePath, 'original');

    const cache = createFileCache();

    const first = cache.get(filePath);
    expect(first).toBe('original');

    // Reading again should return cached value
    const second = cache.get(filePath);
    expect(second).toBe('original');
  });

  it('returns undefined for nonexistent files', () => {
    const cache = createFileCache();
    const content = cache.get('/nonexistent/file.md');

    expect(content).toBeUndefined();
  });

  it('invalidates cache when file is modified', () => {
    const filePath = resolve(TEST_DIR, 'test.md');
    writeFileSync(filePath, 'original');

    const cache = createFileCache();
    const first = cache.get(filePath);
    expect(first).toBe('original');

    // Modify the file with a different mtime
    // Need to ensure mtime actually changes
    const futureTime = Date.now() + 1000;
    writeFileSync(filePath, 'modified');
    utimesSync(filePath, futureTime / 1000, futureTime / 1000);

    const second = cache.get(filePath);
    expect(second).toBe('modified');
  });

  it('invalidates cache when file is deleted', () => {
    const filePath = resolve(TEST_DIR, 'test.md');
    writeFileSync(filePath, 'content');

    const cache = createFileCache();
    const first = cache.get(filePath);
    expect(first).toBe('content');

    rmSync(filePath);

    const second = cache.get(filePath);
    expect(second).toBeUndefined();
  });

  it('respects TTL expiration', () => {
    const filePath = resolve(TEST_DIR, 'test.md');
    writeFileSync(filePath, 'content');

    // Use very short TTL
    const cache = createFileCache({ ttlMs: 0 });

    const first = cache.get(filePath);
    expect(first).toBe('content');

    // With TTL=0, cache always checks mtime
    const second = cache.get(filePath);
    expect(second).toBe('content');
  });

  it('clears the cache', () => {
    const filePath = resolve(TEST_DIR, 'test.md');
    writeFileSync(filePath, 'content');

    const cache = createFileCache();
    cache.get(filePath);
    expect(cache.size()).toBe(1);

    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('tracks cache size correctly', () => {
    const cache = createFileCache();

    writeFileSync(resolve(TEST_DIR, 'a.md'), 'a');
    writeFileSync(resolve(TEST_DIR, 'b.md'), 'b');

    expect(cache.size()).toBe(0);

    cache.get(resolve(TEST_DIR, 'a.md'));
    expect(cache.size()).toBe(1);

    cache.get(resolve(TEST_DIR, 'b.md'));
    expect(cache.size()).toBe(2);
  });
});
