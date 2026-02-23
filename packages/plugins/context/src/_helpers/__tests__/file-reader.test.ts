import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
    expect(result.files[0]).toEqual({
      name: 'memory.md',
      content: 'Memory content',
    });
    expect(result.files[1]).toEqual({
      name: 'world-state.md',
      content: 'World state',
    });
    expect(result.files[2]).toEqual({
      name: 'thread-summaries.md',
      content: 'Summaries',
    });
    expect(result.files[3]).toEqual({
      name: 'inbox.md',
      content: 'Inbox items',
    });
  });

  it('handles missing files gracefully', () => {
    const result = readContextFiles(TEST_DIR);

    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(4);
    expect(result.errors[0]?.name).toBe('memory.md');
    expect(result.errors[1]?.name).toBe('world-state.md');
    expect(result.errors[2]?.name).toBe('thread-summaries.md');
    expect(result.errors[3]?.name).toBe('inbox.md');
  });

  it('handles partial context files (some present, some missing)', () => {
    writeFileSync(resolve(TEST_DIR, 'memory.md'), 'Some memory');
    writeFileSync(resolve(TEST_DIR, 'inbox.md'), 'Inbox data');

    const result = readContextFiles(TEST_DIR);

    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.name).toBe('memory.md');
    expect(result.files[1]?.name).toBe('inbox.md');
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]?.name).toBe('world-state.md');
    expect(result.errors[1]?.name).toBe('thread-summaries.md');
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
    expect(result.errors).toHaveLength(4);
    for (const err of result.errors) {
      expect(err.error).toBeTruthy();
    }
  });

  it('records error messages for missing files', () => {
    const result = readContextFiles(TEST_DIR);

    for (const err of result.errors) {
      expect(err.error).toContain('ENOENT');
    }
  });
});
