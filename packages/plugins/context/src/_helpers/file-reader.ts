// Reads context markdown files from disk using fs (not MCP tools)

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type ContextFile = {
  name: string;
  content: string;
};

export type ContextFileResult = {
  files: ContextFile[];
  errors: Array<{ name: string; error: string }>;
};

const CONTEXT_FILES = ['memory.md', 'world-state.md', 'thread-summaries.md', 'inbox.md'] as const;

type ReadContextFiles = (contextDir: string) => ContextFileResult;

export const readContextFiles: ReadContextFiles = (contextDir) => {
  const files: ContextFile[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const fileName of CONTEXT_FILES) {
    const filePath = resolve(contextDir, fileName);
    try {
      const content = readFileSync(filePath, 'utf-8').trim();
      if (content.length > 0) {
        files.push({ name: fileName, content });
      }
    } catch (err) {
      // Missing files are expected and handled gracefully
      errors.push({ name: fileName, error: String(err) });
    }
  }

  return { files, errors };
};
