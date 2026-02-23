import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverContextFiles } from '../file-discovery';

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(resolve(tmpdir(), 'harness-ctx-fd-'));
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('discoverContextFiles', () => {
  it('discovers markdown files in the root directory', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), 'content');
    writeFileSync(resolve(TEST_DIR, 'inbox.md'), 'content');

    const result = discoverContextFiles(TEST_DIR);

    expect(result).toHaveLength(2);
    const paths = result.map((f) => f.relativePath);
    expect(paths).toContain('memory.md');
    expect(paths).toContain('inbox.md');
  });

  it('discovers files in subdirectories', () => {
    mkdirSync(resolve(TEST_DIR, 'sub'), { recursive: true });
    writeFileSync(resolve(TEST_DIR, 'root.md'), 'content');
    writeFileSync(resolve(TEST_DIR, 'sub', 'nested.md'), 'content');

    const result = discoverContextFiles(TEST_DIR);

    expect(result).toHaveLength(2);
    const paths = result.map((f) => f.relativePath);
    expect(paths).toContain('root.md');
    expect(paths).toContain('sub/nested.md');
  });

  it('respects maxDepth setting', () => {
    mkdirSync(resolve(TEST_DIR, 'a', 'b', 'c', 'd'), { recursive: true });
    writeFileSync(resolve(TEST_DIR, 'a', 'level1.md'), 'content');
    writeFileSync(resolve(TEST_DIR, 'a', 'b', 'level2.md'), 'content');
    writeFileSync(resolve(TEST_DIR, 'a', 'b', 'c', 'level3.md'), 'content');
    writeFileSync(resolve(TEST_DIR, 'a', 'b', 'c', 'd', 'level4.md'), 'content');

    const result = discoverContextFiles(TEST_DIR, { maxDepth: 2 });

    const paths = result.map((f) => f.relativePath);
    expect(paths).toContain('a/level1.md');
    expect(paths).toContain('a/b/level2.md');
    // depth 2 means base(0) -> a(1) -> b(2), so c(3) is beyond maxDepth
    expect(paths).not.toContain('a/b/c/level3.md');
  });

  it('excludes files matching exclude patterns', () => {
    writeFileSync(resolve(TEST_DIR, 'notes.md'), 'content');
    writeFileSync(resolve(TEST_DIR, 'notes.draft.md'), 'draft content');

    const result = discoverContextFiles(TEST_DIR, {
      excludePatterns: ['*.draft.md'],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.relativePath).toBe('notes.md');
  });

  it('only includes files matching include patterns', () => {
    writeFileSync(resolve(TEST_DIR, 'notes.md'), 'content');
    writeFileSync(resolve(TEST_DIR, 'data.json'), '{}');
    writeFileSync(resolve(TEST_DIR, 'script.ts'), 'code');

    const result = discoverContextFiles(TEST_DIR, {
      includePatterns: ['*.md'],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.relativePath).toBe('notes.md');
  });

  it('skips hidden directories', () => {
    mkdirSync(resolve(TEST_DIR, '.hidden'), { recursive: true });
    writeFileSync(resolve(TEST_DIR, '.hidden', 'secret.md'), 'hidden');
    writeFileSync(resolve(TEST_DIR, 'visible.md'), 'visible');

    const result = discoverContextFiles(TEST_DIR);

    expect(result).toHaveLength(1);
    expect(result[0]?.relativePath).toBe('visible.md');
  });

  it('excludes hidden files by default', () => {
    writeFileSync(resolve(TEST_DIR, '.hidden.md'), 'hidden');
    writeFileSync(resolve(TEST_DIR, 'visible.md'), 'visible');

    const result = discoverContextFiles(TEST_DIR);

    expect(result).toHaveLength(1);
    expect(result[0]?.relativePath).toBe('visible.md');
  });

  it('returns file metadata', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), 'some content');

    const result = discoverContextFiles(TEST_DIR);

    expect(result).toHaveLength(1);
    const file = result[0];
    expect(file?.relativePath).toBe('memory.md');
    expect(file?.absolutePath).toBe(resolve(TEST_DIR, 'memory.md'));
    expect(file?.size).toBeGreaterThan(0);
    expect(file?.lastModified).toBeInstanceOf(Date);
  });

  it('handles nonexistent directory gracefully', () => {
    const result = discoverContextFiles('/nonexistent/directory/path');

    expect(result).toHaveLength(0);
  });

  it('handles empty directory', () => {
    const result = discoverContextFiles(TEST_DIR);

    expect(result).toHaveLength(0);
  });

  it('supports multiple include patterns', () => {
    writeFileSync(resolve(TEST_DIR, 'notes.md'), 'content');
    writeFileSync(resolve(TEST_DIR, 'data.txt'), 'content');
    writeFileSync(resolve(TEST_DIR, 'script.ts'), 'code');

    const result = discoverContextFiles(TEST_DIR, {
      includePatterns: ['*.md', '*.txt'],
    });

    expect(result).toHaveLength(2);
    const paths = result.map((f) => f.relativePath);
    expect(paths).toContain('notes.md');
    expect(paths).toContain('data.txt');
  });

  it('supports glob patterns for nested files', () => {
    mkdirSync(resolve(TEST_DIR, 'sub'), { recursive: true });
    writeFileSync(resolve(TEST_DIR, 'root.md'), 'content');
    writeFileSync(resolve(TEST_DIR, 'sub', 'nested.md'), 'content');

    const result = discoverContextFiles(TEST_DIR, {
      includePatterns: ['**/*.md'],
    });

    expect(result).toHaveLength(2);
  });
});
