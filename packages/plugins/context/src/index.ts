// Context plugin — reads context files and conversation history,
// injects them into prompts before invocation via onBeforeInvoke hook

import { resolve } from 'node:path';
import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { createFileCache } from './_helpers/file-cache';
import type { FileDiscoveryConfig } from './_helpers/file-discovery';
import type { ReadContextFilesOptions } from './_helpers/file-reader';
import { readContextFiles } from './_helpers/file-reader';
import { formatContextSection } from './_helpers/format-context-section';
import { formatHistorySection } from './_helpers/format-history-section';
import { loadHistory } from './_helpers/history-loader';

export type ContextPluginOptions = {
  contextDir?: string;
  historyLimit?: number;
  fileDiscovery?: Partial<FileDiscoveryConfig>;
  maxFileSize?: number;
  priorityFiles?: string[];
};

type BuildPrompt = (parts: string[]) => string;

const buildPrompt: BuildPrompt = (parts) => {
  const nonEmpty = parts.filter((p) => p.length > 0);
  return nonEmpty.join('\n\n---\n\n');
};

type CreateRegister = (options?: ContextPluginOptions) => PluginDefinition['register'];

const createRegister: CreateRegister = (options) => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    const contextDir = options?.contextDir ?? resolve(process.cwd(), 'context');
    const historyLimit = options?.historyLimit;

    // Create a shared cache instance for the lifetime of the plugin registration
    const cache = createFileCache();

    const readerOptions: ReadContextFilesOptions = {
      fileDiscovery: options?.fileDiscovery,
      maxFileSize: options?.maxFileSize,
      priorityFiles: options?.priorityFiles,
      cache,
    };

    ctx.logger.info('Context plugin registered', { contextDir });

    return {
      onBeforeInvoke: async (threadId, prompt) => {
        // Read context files from disk using dynamic discovery
        const contextResult = readContextFiles(contextDir, readerOptions);

        if (contextResult.errors.length > 0) {
          ctx.logger.debug('Some context files not found', {
            missing: contextResult.errors.map((e) => e.name),
          });
        }

        const contextSection = formatContextSection(contextResult.files);

        // Check if thread has an active session — if so, Claude already has history via --resume
        const thread = await ctx.db.thread.findUnique({
          where: { id: threadId },
          select: { sessionId: true },
        });

        let historySection = '';
        if (thread?.sessionId) {
          ctx.logger.info(`Skipping history injection for resumed session [thread=${threadId}]`);
        } else {
          const historyResult = await loadHistory(ctx.db, threadId, historyLimit);
          historySection = formatHistorySection(historyResult);
        }

        // Concatenate: context + history (if not resuming) + original prompt
        return buildPrompt([contextSection, historySection, prompt]);
      },
    };
  };

  return register;
};

export const name = 'context';
export const version = '1.0.0';

export const register: PluginDefinition['register'] = createRegister();

export const contextPlugin: PluginDefinition = {
  name,
  version,
  register,
};

type CreateContextPlugin = (options?: ContextPluginOptions) => PluginDefinition;

export const createContextPlugin: CreateContextPlugin = (options) => ({
  name,
  version,
  register: createRegister(options),
});
