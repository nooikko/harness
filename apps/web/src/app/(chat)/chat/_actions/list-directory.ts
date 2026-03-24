'use server';

import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

type DirectoryEntry = {
  name: string;
  path: string;
};

type ListDirectoryResult = {
  entries: DirectoryEntry[];
  currentPath: string;
  parent: string | null;
  error?: string;
};

type ListDirectory = (path: string) => Promise<ListDirectoryResult>;

export const listDirectory: ListDirectory = async (path) => {
  const resolvedPath = path.trim() || homedir();
  const parent = resolvedPath === '/' ? null : dirname(resolvedPath);

  try {
    await stat(resolvedPath);
  } catch {
    return { entries: [], currentPath: resolvedPath, parent, error: `Directory not found: ${resolvedPath}` };
  }

  try {
    const dirents = await readdir(resolvedPath, { withFileTypes: true });

    const HIDDEN = new Set(['node_modules', '.git', '.next', '.turbo', '.cache', '.yarn', '.pnpm', '__pycache__', 'coverage', 'dist', '.DS_Store']);

    const entries = dirents
      .filter((d) => d.isDirectory())
      .filter((d) => !d.name.startsWith('.') || d.name === '.claude')
      .filter((d) => !HIDDEN.has(d.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({
        name: d.name,
        path: join(resolvedPath, d.name),
      }));

    return { entries, currentPath: resolvedPath, parent };
  } catch {
    return { entries: [], currentPath: resolvedPath, parent, error: `Cannot read directory: ${resolvedPath}` };
  }
};
