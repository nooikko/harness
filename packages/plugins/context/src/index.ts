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
import { formatSummarySection } from './_helpers/format-summary-section';
import { formatUserProfileSection } from './_helpers/format-user-profile-section';
import { loadHistory } from './_helpers/history-loader';
import { settingsSchema } from './_helpers/settings-schema';

const DEFAULT_HISTORY_LIMIT_WITH_SUMMARY = 25;
const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_SUMMARY_LOOKBACK = 2;

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

    let settings = await ctx.getSettings(settingsSchema);

    ctx.logger.info('Context plugin registered', { contextDir });

    return {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'context') {
          return;
        }
        settings = await ctx.getSettings(settingsSchema);
        ctx.logger.info('Context plugin: settings reloaded');
      },

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
        // Also fetch project instructions/memory for context injection
        let userProfileSection = '';
        let thread: { sessionId: string | null; project: { instructions: string | null; memory: string | null } | null } | null = null;
        let dbAvailable = true;
        try {
          thread = await ctx.db.thread.findUnique({
            where: { id: threadId },
            select: {
              sessionId: true,
              project: {
                select: { instructions: true, memory: true },
              },
            },
          });
          const profile = await ctx.db.userProfile.findUnique({ where: { id: 'singleton' } });
          userProfileSection = formatUserProfileSection(profile);
        } catch (err) {
          dbAvailable = false;
          ctx.logger.warn(
            `Context plugin: DB unavailable during onBeforeInvoke [thread=${threadId}], skipping history: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        // Build project-level sections (XML-tagged per Anthropic's context engineering recommendations)
        const projectInstructionsSection = thread?.project?.instructions
          ? `<project_instructions>\n${thread.project.instructions}\n</project_instructions>`
          : null;

        const projectMemorySection = thread?.project?.memory ? `<project_memory>\n${thread.project.memory}\n</project_memory>` : null;

        let summarySection = '';
        let historySection = '';

        const summaryLookback = settings.summaryLookback ?? DEFAULT_SUMMARY_LOOKBACK;
        const histLimitWithSummary = settings.historyLimitWithSummary ?? DEFAULT_HISTORY_LIMIT_WITH_SUMMARY;
        const histLimitDefault = settings.historyLimit ?? DEFAULT_HISTORY_LIMIT;

        if (thread?.sessionId) {
          ctx.logger.info(`Skipping history injection for resumed session [thread=${threadId}]`);
        } else if (dbAvailable) {
          // Check for existing summaries to use smart injection
          const summaries = await ctx.db.message.findMany({
            where: { threadId, kind: 'summary' },
            orderBy: { createdAt: 'desc' },
            take: summaryLookback,
            select: { content: true, createdAt: true },
          });

          const hasSummaries = summaries.length > 0;
          const rawLimit = historyLimit ?? (hasSummaries ? histLimitWithSummary : histLimitDefault);

          if (hasSummaries) {
            // Inject summaries oldest-first so Claude reads them in chronological order
            summarySection = formatSummarySection([...summaries].reverse());
          }

          const historyResult = await loadHistory(ctx.db, threadId, rawLimit);
          historySection = formatHistorySection(historyResult);
        }

        // Concatenate: project instructions + project memory + context + summary + history + prompt
        return buildPrompt([
          projectInstructionsSection ?? '',
          projectMemorySection ?? '',
          userProfileSection,
          contextSection,
          summarySection,
          historySection,
          prompt,
        ]);
      },
    };
  };

  return register;
};

export const name = 'context';
export const version = '1.0.0';

export const register: PluginDefinition['register'] = createRegister();

export const plugin: PluginDefinition = {
  name,
  version,
  settingsSchema,
  register,
};

type CreateContextPlugin = (options?: ContextPluginOptions) => PluginDefinition;

export const createContextPlugin: CreateContextPlugin = (options) => ({
  name,
  version,
  settingsSchema,
  register: createRegister(options),
});
