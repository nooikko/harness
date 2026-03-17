import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupAll, cleanupTrace, ensureTraceDir, getTrackedFiles, trackFile } from '../temp-tracker';

const BASE_DIR = join(tmpdir(), 'harness-playwright');

afterEach(() => {
  cleanupAll();
});

describe('ensureTraceDir', () => {
  it('creates a directory for the given traceId', () => {
    const dir = ensureTraceDir('trace-1');
    expect(dir).toBe(join(BASE_DIR, 'trace-1'));
    expect(existsSync(dir)).toBe(true);
  });

  it('is idempotent', () => {
    const dir1 = ensureTraceDir('trace-2');
    const dir2 = ensureTraceDir('trace-2');
    expect(dir1).toBe(dir2);
  });
});

describe('trackFile / getTrackedFiles', () => {
  it('tracks files for a traceId', () => {
    trackFile('trace-3', '/tmp/a.png');
    trackFile('trace-3', '/tmp/b.png');
    expect(getTrackedFiles('trace-3')).toEqual(['/tmp/a.png', '/tmp/b.png']);
  });

  it('returns empty array for unknown traceId', () => {
    expect(getTrackedFiles('unknown')).toEqual([]);
  });
});

describe('cleanupTrace', () => {
  it('removes the trace directory and clears tracked files', () => {
    const dir = ensureTraceDir('trace-4');
    writeFileSync(join(dir, 'test.txt'), 'data');
    trackFile('trace-4', join(dir, 'test.txt'));

    cleanupTrace('trace-4');
    expect(existsSync(dir)).toBe(false);
    expect(getTrackedFiles('trace-4')).toEqual([]);
  });

  it('handles non-existent trace directory gracefully', () => {
    trackFile('trace-5', '/tmp/nonexistent');
    expect(() => cleanupTrace('trace-5')).not.toThrow();
    expect(getTrackedFiles('trace-5')).toEqual([]);
  });
});

describe('cleanupAll', () => {
  it('removes the base directory and clears all tracking', () => {
    ensureTraceDir('trace-6');
    ensureTraceDir('trace-7');
    trackFile('trace-6', '/tmp/a');
    trackFile('trace-7', '/tmp/b');

    cleanupAll();
    expect(existsSync(BASE_DIR)).toBe(false);
    expect(getTrackedFiles('trace-6')).toEqual([]);
    expect(getTrackedFiles('trace-7')).toEqual([]);
  });
});
