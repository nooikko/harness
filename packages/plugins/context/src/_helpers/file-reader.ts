// Reads context markdown files from disk using dynamic file discovery
// Supports configurable patterns, file size limits, priority files, and caching

import type { FileCache } from './file-cache';
import { createFileCache } from './file-cache';
import type { DiscoveredFile, FileDiscoveryConfig } from './file-discovery';
import { discoverContextFiles } from './file-discovery';

export type ContextFile = {
  name: string;
  content: string;
  size: number;
  relativePath: string;
  lastModified: Date;
};

export type ContextFileResult = {
  files: ContextFile[];
  errors: Array<{ name: string; error: string }>;
};

export type ReadContextFilesOptions = {
  fileDiscovery?: Partial<FileDiscoveryConfig>;
  maxFileSize?: number;
  priorityFiles?: string[];
  cache?: FileCache;
};

const DEFAULT_MAX_FILE_SIZE = 50 * 1024; // 50KB

const DEFAULT_PRIORITY_FILES = ['memory.md', 'world-state.md', 'thread-summaries.md', 'inbox.md'];

type TruncateContent = (content: string, maxSize: number) => string;

const truncateContent: TruncateContent = (content, maxSize) => {
  if (content.length <= maxSize) {
    return content;
  }
  const truncated = content.slice(0, maxSize);
  return `${truncated}\n\n[... truncated at ${maxSize} bytes]`;
};

type SortDiscoveredFiles = (files: DiscoveredFile[], priorityFiles: string[]) => DiscoveredFile[];

const sortDiscoveredFiles: SortDiscoveredFiles = (files, priorityFiles) => {
  const priorityMap = new Map<string, number>();
  for (let i = 0; i < priorityFiles.length; i++) {
    const file = priorityFiles[i];
    if (file !== undefined) {
      priorityMap.set(file, i);
    }
  }

  return [...files].sort((a, b) => {
    const aPriority = priorityMap.get(a.relativePath) ?? Number.MAX_SAFE_INTEGER;
    const bPriority = priorityMap.get(b.relativePath) ?? Number.MAX_SAFE_INTEGER;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return a.relativePath.localeCompare(b.relativePath);
  });
};

type ReadContextFiles = (contextDir: string, options?: ReadContextFilesOptions) => ContextFileResult;

export const readContextFiles: ReadContextFiles = (contextDir, options) => {
  const maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const priorityFiles = options?.priorityFiles ?? DEFAULT_PRIORITY_FILES;
  const cache = options?.cache ?? createFileCache();

  const discovered = discoverContextFiles(contextDir, options?.fileDiscovery);
  const sorted = sortDiscoveredFiles(discovered, priorityFiles);

  const files: ContextFile[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const entry of sorted) {
    try {
      const rawContent = cache.get(entry.absolutePath);
      if (rawContent === undefined) {
        errors.push({
          name: entry.relativePath,
          error: 'File could not be read',
        });
        continue;
      }

      const trimmed = rawContent.trim();
      if (trimmed.length === 0) {
        continue;
      }

      const content = truncateContent(trimmed, maxFileSize);

      files.push({
        name: entry.relativePath,
        content,
        size: entry.size,
        relativePath: entry.relativePath,
        lastModified: entry.lastModified,
      });
    } catch (err) {
      errors.push({ name: entry.relativePath, error: String(err) });
    }
  }

  return { files, errors };
};
