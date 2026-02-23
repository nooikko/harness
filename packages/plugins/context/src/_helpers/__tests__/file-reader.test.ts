import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readContextFiles } from '../file-reader';

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(resolve(tmpdir(), 'harness-ctx-fr-'));
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('readContextFiles', () => {
  it('reads all context files when present', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), 'Memory content');
    writeFileSync(resolve(TEST_DIR, 'world-state.md'), 'World state');
    writeFileSync(resolve(TEST_DIR, 'thread-summaries.md'), 'Summaries');
    writeFileSync(resolve(TEST_DIR, 'inbox.md'), 'Inbox items');

    const result = readContextFiles(TEST_DIR);

    expect(result.files).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
    // Priority files should come first in default order
    expect(result.files[0]?.name).toBe('memory.md');
    expect(result.files[0]?.content).toBe('Memory content');
    expect(result.files[1]?.name).toBe('world-state.md');
    expect(result.files[2]?.name).toBe('thread-summaries.md');
    expect(result.files[3]?.name).toBe('inbox.md');
  });

  it('handles missing files gracefully (empty directory)', () => {
    const result = readContextFiles(TEST_DIR);

    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('handles partial context files (some present, some missing)', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), 'Some memory');
    writeFileSync(resolve(TEST_DIR, 'inbox.md'), 'Inbox data');

    const result = readContextFiles(TEST_DIR);

    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.name).toBe('memory.md');
    expect(result.files[1]?.name).toBe('inbox.md');
  });

  it('skips empty files', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), '');
    writeFileSync(resolve(TEST_DIR, 'inbox.md'), 'Has content');

    const result = readContextFiles(TEST_DIR);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.name).toBe('inbox.md');
  });

  it('skips files that are only whitespace', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), '   \n\n  ');
    writeFileSync(resolve(TEST_DIR, 'inbox.md'), 'Real content');

    const result = readContextFiles(TEST_DIR);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.name).toBe('inbox.md');
  });

  it('trims whitespace from file content', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), '\n  Content here  \n\n');

    const result = readContextFiles(TEST_DIR);

    expect(result.files[0]?.content).toBe('Content here');
  });

  it('handles nonexistent directory', () => {
    const result = readContextFiles('/nonexistent/directory/path');

    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('discovers files in subdirectories', () => {
    mkdirSync(resolve(TEST_DIR, 'sub'), { recursive: true });
    writeFileSync(resolve(TEST_DIR, 'root.md'), 'Root content');
    writeFileSync(resolve(TEST_DIR, 'sub', 'nested.md'), 'Nested content');

    const result = readContextFiles(TEST_DIR);

    expect(result.files).toHaveLength(2);
    const names = result.files.map((f) => f.name);
    expect(names).toContain('root.md');
    expect(names).toContain('sub/nested.md');
  });

  it('includes file metadata', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), 'Some content');

    const result = readContextFiles(TEST_DIR);

    const file = result.files[0];
    expect(file?.size).toBeGreaterThan(0);
    expect(file?.relativePath).toBe('memory.md');
    expect(file?.lastModified).toBeInstanceOf(Date);
  });

  it('truncates large files to maxFileSize', () => {
    const largeContent = 'x'.repeat(200);
    writeFileSync(resolve(TEST_DIR, 'large.md'), largeContent);

    const result = readContextFiles(TEST_DIR, { maxFileSize: 50 });

    expect(result.files[0]?.content).toContain('[... truncated at 50 bytes]');
    expect(result.files[0]?.content.length).toBeLessThan(largeContent.length);
  });

  it('does not truncate files within size limit', () => {
    writeFileSync(resolve(TEST_DIR, 'small.md'), 'Short content');

    const result = readContextFiles(TEST_DIR, { maxFileSize: 1000 });

    expect(result.files[0]?.content).toBe('Short content');
  });

  it('respects custom priority files ordering', () => {
    writeFileSync(resolve(TEST_DIR, 'alpha.md'), 'Alpha');
    writeFileSync(resolve(TEST_DIR, 'beta.md'), 'Beta');
    writeFileSync(resolve(TEST_DIR, 'gamma.md'), 'Gamma');

    const result = readContextFiles(TEST_DIR, {
      priorityFiles: ['gamma.md', 'alpha.md'],
    });

    expect(result.files[0]?.name).toBe('gamma.md');
    expect(result.files[1]?.name).toBe('alpha.md');
    expect(result.files[2]?.name).toBe('beta.md');
  });

  it('respects custom file discovery patterns', () => {
    writeFileSync(resolve(TEST_DIR, 'notes.md'), 'notes');
    writeFileSync(resolve(TEST_DIR, 'data.txt'), 'data');

    const result = readContextFiles(TEST_DIR, {
      fileDiscovery: { includePatterns: ['*.txt'] },
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.name).toBe('data.txt');
  });

  it('discovers additional files beyond default four', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), 'Memory');
    writeFileSync(resolve(TEST_DIR, 'custom-notes.md'), 'Notes');
    writeFileSync(resolve(TEST_DIR, 'project-plan.md'), 'Plan');

    const result = readContextFiles(TEST_DIR);

    expect(result.files.length).toBe(3);
    // memory.md should come first due to priority
    expect(result.files[0]?.name).toBe('memory.md');
  });

  it('excludes draft files by default', () => {
    writeFileSync(resolve(TEST_DIR, 'notes.md'), 'Notes');
    writeFileSync(resolve(TEST_DIR, 'notes.draft.md'), 'Draft');

    const result = readContextFiles(TEST_DIR);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.name).toBe('notes.md');
  });
});
