// Default configuration for context file discovery

export type FileDiscoveryConfig = {
  includePatterns: string[];
  excludePatterns: string[];
  maxDepth: number;
  followSymlinks: boolean;
};

export const DEFAULT_DISCOVERY_CONFIG: FileDiscoveryConfig = {
  includePatterns: ['**/*.md'],
  excludePatterns: ['**/*.draft.md', '.*'],
  maxDepth: 3,
  followSymlinks: false,
};
