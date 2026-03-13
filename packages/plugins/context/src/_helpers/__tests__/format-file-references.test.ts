import { describe, expect, it } from 'vitest';
import { formatFileReferences } from '../format-file-references';
import type { FileReference } from '../load-file-references';

describe('formatFileReferences', () => {
  it('formats PROJECT files under ## Project Files heading', () => {
    const files: FileReference[] = [
      {
        name: 'spec.md',
        mimeType: 'text/markdown',
        size: 2048,
        fullPath: '/uploads/projects/p1/spec.md',
        scope: 'PROJECT',
      },
    ];

    const result = formatFileReferences(files);

    expect(result).toContain('## Project Files');
    expect(result).toContain('spec.md');
  });

  it('formats THREAD files under ## Thread Files heading', () => {
    const files: FileReference[] = [
      {
        name: 'screenshot.png',
        mimeType: 'image/png',
        size: 512000,
        fullPath: '/uploads/threads/t1/screenshot.png',
        scope: 'THREAD',
      },
    ];

    const result = formatFileReferences(files);

    expect(result).toContain('## Thread Files');
    expect(result).toContain('screenshot.png');
  });

  it('groups both scopes correctly with # Available Files heading', () => {
    const files: FileReference[] = [
      {
        name: 'spec.md',
        mimeType: 'text/markdown',
        size: 2048,
        fullPath: '/uploads/projects/p1/spec.md',
        scope: 'PROJECT',
      },
      {
        name: 'screenshot.png',
        mimeType: 'image/png',
        size: 512000,
        fullPath: '/uploads/threads/t1/screenshot.png',
        scope: 'THREAD',
      },
    ];

    const result = formatFileReferences(files);

    expect(result).toContain('# Available Files');
    expect(result).toContain('## Project Files');
    expect(result).toContain('## Thread Files');
    const projectIdx = result.indexOf('## Project Files');
    const threadIdx = result.indexOf('## Thread Files');
    expect(projectIdx).toBeLessThan(threadIdx);
  });

  it('returns empty string when files array is empty', () => {
    expect(formatFileReferences([])).toBe('');
  });

  it('formats size in human-readable form (KB, MB)', () => {
    const files: FileReference[] = [
      {
        name: 'small.txt',
        mimeType: 'text/plain',
        size: 500,
        fullPath: '/uploads/threads/t1/small.txt',
        scope: 'THREAD',
      },
      {
        name: 'medium.json',
        mimeType: 'application/json',
        size: 15360,
        fullPath: '/uploads/threads/t1/medium.json',
        scope: 'THREAD',
      },
      {
        name: 'large.pdf',
        mimeType: 'application/pdf',
        size: 5242880,
        fullPath: '/uploads/threads/t1/large.pdf',
        scope: 'THREAD',
      },
    ];

    const result = formatFileReferences(files);

    expect(result).toContain('500B');
    expect(result).toContain('15KB');
    expect(result).toContain('5.0MB');
  });

  it('includes MIME type and full path in each line', () => {
    const files: FileReference[] = [
      {
        name: 'data.json',
        mimeType: 'application/json',
        size: 1024,
        fullPath: '/uploads/projects/p1/data.json',
        scope: 'PROJECT',
      },
    ];

    const result = formatFileReferences(files);

    expect(result).toContain('application/json');
    expect(result).toContain('/uploads/projects/p1/data.json');
  });
});
