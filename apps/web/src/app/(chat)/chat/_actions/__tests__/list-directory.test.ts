import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReaddir = vi.fn();
const mockStat = vi.fn();
const mockHomedir = vi.fn(() => '/Users/testuser');

vi.mock('node:fs/promises', () => {
  const mocks = {
    readdir: (...args: unknown[]) => mockReaddir(...args),
    stat: (...args: unknown[]) => mockStat(...args),
  };
  return { ...mocks, default: mocks };
});

vi.mock('node:os', () => {
  const mocks = {
    homedir: () => mockHomedir(),
  };
  return { ...mocks, default: mocks };
});

const { listDirectory } = await import('../list-directory');

const makeDirent = (name: string, isDir: boolean) => ({
  name,
  isDirectory: () => isDir,
});

describe('listDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue('/Users/testuser');
    mockStat.mockResolvedValue({ isDirectory: () => true });
  });

  it('defaults to home directory when no path is given', async () => {
    mockReaddir.mockResolvedValue([makeDirent('Documents', true), makeDirent('file.txt', false)]);

    const result = await listDirectory('');

    expect(mockReaddir).toHaveBeenCalledWith('/Users/testuser', {
      withFileTypes: true,
    });
    expect(result.currentPath).toBe('/Users/testuser');
  });

  it('returns only directories, not files', async () => {
    mockReaddir.mockResolvedValue([
      makeDirent('src', true),
      makeDirent('README.md', false),
      makeDirent('lib', true),
      makeDirent('package.json', false),
    ]);

    const result = await listDirectory('/project');

    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((e) => e.name)).toEqual(['lib', 'src']);
  });

  it('sorts directories alphabetically', async () => {
    mockReaddir.mockResolvedValue([makeDirent('zeta', true), makeDirent('alpha', true), makeDirent('beta', true)]);

    const result = await listDirectory('/test');

    expect(result.entries.map((e) => e.name)).toEqual(['alpha', 'beta', 'zeta']);
  });

  it('hides dotfiles except .claude', async () => {
    mockReaddir.mockResolvedValue([makeDirent('.git', true), makeDirent('.claude', true), makeDirent('.config', true), makeDirent('src', true)]);

    const result = await listDirectory('/project');

    expect(result.entries.map((e) => e.name)).toEqual(['.claude', 'src']);
  });

  it('hides noise directories like node_modules, coverage, dist', async () => {
    mockReaddir.mockResolvedValue([
      makeDirent('node_modules', true),
      makeDirent('coverage', true),
      makeDirent('dist', true),
      makeDirent('.next', true),
      makeDirent('src', true),
      makeDirent('packages', true),
    ]);

    const result = await listDirectory('/project');

    expect(result.entries.map((e) => e.name)).toEqual(['packages', 'src']);
  });

  it('returns full paths for each entry', async () => {
    mockReaddir.mockResolvedValue([makeDirent('src', true)]);

    const result = await listDirectory('/project');

    expect(result.entries[0]?.path).toBe(join('/project', 'src'));
  });

  it('returns parent path for navigation', async () => {
    mockReaddir.mockResolvedValue([]);

    const result = await listDirectory('/Users/testuser/projects/my-app');

    expect(result.parent).toBe('/Users/testuser/projects');
  });

  it('returns null parent for root directory', async () => {
    mockReaddir.mockResolvedValue([]);

    const result = await listDirectory('/');

    expect(result.parent).toBeNull();
  });

  it('returns error when path does not exist', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const result = await listDirectory('/nonexistent/path');

    expect(result.error).toBeDefined();
    expect(result.entries).toEqual([]);
  });

  it('returns error when readdir fails (permission denied)', async () => {
    mockReaddir.mockRejectedValue(new Error('EACCES: permission denied'));

    const result = await listDirectory('/root/secret');

    expect(result.error).toBeDefined();
    expect(result.entries).toEqual([]);
  });
});
