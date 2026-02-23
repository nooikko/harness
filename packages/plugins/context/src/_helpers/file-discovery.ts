// Dynamically discovers context files in a directory using recursive traversal
// and pattern matching for include/exclude filtering

import type { Stats } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { matchPattern } from './match-pattern';

export type FileDiscoveryConfig = {
  includePatterns: string[];
  excludePatterns: string[];
  maxDepth: number;
  followSymlinks: boolean;
};

export type DiscoveredFile = {
  relativePath: string;
  absolutePath: string;
  size: number;
  lastModified: Date;
};

export const DEFAULT_DISCOVERY_CONFIG: FileDiscoveryConfig = {
  includePatterns: ['**/*.md'],
  excludePatterns: ['**/*.draft.md', '.*'],
  maxDepth: 3,
  followSymlinks: false,
};

type ShouldInclude = (relativePath: string, config: FileDiscoveryConfig) => boolean;

const shouldInclude: ShouldInclude = (relativePath, config) => {
  const matchesInclude = config.includePatterns.some((pattern) => matchPattern(relativePath, pattern));
  if (!matchesInclude) {
    return false;
  }

  const matchesExclude = config.excludePatterns.some((pattern) => matchPattern(relativePath, pattern));
  return !matchesExclude;
};

type WalkDirectory = (baseDir: string, currentDir: string, config: FileDiscoveryConfig, currentDepth: number) => DiscoveredFile[];

const walkDirectory: WalkDirectory = (baseDir, currentDir, config, currentDepth) => {
  if (currentDepth > config.maxDepth) {
    return [];
  }

  const results: DiscoveredFile[] = [];

  let entries: string[];
  try {
    entries = readdirSync(currentDir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    const absolutePath = resolve(currentDir, entry);

    let stats: Stats;
    try {
      stats = statSync(absolutePath);
    } catch {
      continue;
    }

    if (stats.isSymbolicLink() && !config.followSymlinks) {
      continue;
    }

    if (stats.isDirectory()) {
      // Skip hidden directories
      if (entry.startsWith('.')) {
        continue;
      }
      const nested = walkDirectory(baseDir, absolutePath, config, currentDepth + 1);
      results.push(...nested);
    } else if (stats.isFile()) {
      const relativePath = relative(baseDir, absolutePath);

      if (shouldInclude(relativePath, config)) {
        results.push({
          relativePath,
          absolutePath,
          size: stats.size,
          lastModified: stats.mtime,
        });
      }
    }
  }

  return results;
};

type DiscoverContextFiles = (contextDir: string, config?: Partial<FileDiscoveryConfig>) => DiscoveredFile[];

export const discoverContextFiles: DiscoverContextFiles = (contextDir, config) => {
  const mergedConfig: FileDiscoveryConfig = {
    ...DEFAULT_DISCOVERY_CONFIG,
    ...config,
  };

  return walkDirectory(contextDir, contextDir, mergedConfig, 0);
};
