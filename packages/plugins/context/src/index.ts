// Context plugin — injects file references, conversation history,
// and project context into prompts via onBeforeInvoke hook

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { formatFileReferences } from './_helpers/format-file-references';
import { formatHistorySection } from './_helpers/format-history-section';
import { formatSummarySection } from './_helpers/format-summary-section';
import { formatUserProfileSection } from './_helpers/format-user-profile-section';
import { loadHistory } from './_helpers/history-loader';
import { loadFileReferences } from './_helpers/load-file-references';
import { settingsSchema } from './_helpers/settings-schema';

const DEFAULT_HISTORY_LIMIT_WITH_SUMMARY = 25;
const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_SUMMARY_LOOKBACK = 2;

type BuildPrompt = (parts: string[]) => string;

const buildPrompt: BuildPrompt = (parts) => {
  const nonEmpty = parts.filter((p) => p.length > 0);
  return nonEmpty.join('\n\n---\n\n');
};

const register = async (ctx: PluginContext): Promise<PluginHooks> => {
  let settings = await ctx.getSettings(settingsSchema);

  ctx.logger.info('Context plugin registered');

  return {
    onSettingsChange: async (pluginName: string) => {
      if (pluginName !== 'context') {
        return;
      }
      settings = await ctx.getSettings(settingsSchema);
      ctx.logger.info('Context plugin: settings reloaded');
    },

    onBeforeInvoke: async (threadId, prompt) => {
      // Snapshot settings at invocation start — prevents torn reads if onSettingsChange fires mid-hook
      const snap = settings;

      let userProfileSection = '';
      let thread: {
        sessionId: string | null;
        projectId: string | null;
        project: { instructions: string | null; memory: string | null } | null;
      } | null = null;
      let dbAvailable = true;

      try {
        thread = await ctx.db.thread.findUnique({
          where: { id: threadId },
          select: {
            sessionId: true,
            projectId: true,
            project: { select: { instructions: true, memory: true } },
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

      // File references — always injected, even when session exists
      let fileReferencesSection = '';
      if (dbAvailable && thread) {
        try {
          const { files: fileRefs, truncated } = await loadFileReferences(ctx.db, ctx.config.uploadDir, threadId, thread.projectId);
          fileReferencesSection = formatFileReferences(fileRefs, truncated);
        } catch (err) {
          ctx.logger.warn(`Context plugin: failed to load file references [thread=${threadId}]: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Project-level sections
      const projectInstructionsSection = thread?.project?.instructions
        ? `<project_instructions>\n${thread.project.instructions}\n</project_instructions>`
        : null;

      const projectMemorySection = thread?.project?.memory ? `<project_memory>\n${thread.project.memory}\n</project_memory>` : null;

      let summarySection = '';
      let historySection = '';

      const summaryLookback = snap.summaryLookback ?? DEFAULT_SUMMARY_LOOKBACK;
      const histLimitWithSummary = snap.historyLimitWithSummary ?? DEFAULT_HISTORY_LIMIT_WITH_SUMMARY;
      const histLimitDefault = snap.historyLimit ?? DEFAULT_HISTORY_LIMIT;

      if (thread?.sessionId) {
        ctx.logger.info(`Skipping history injection for resumed session [thread=${threadId}]`);
      } else if (dbAvailable) {
        const rawSummaries = await ctx.db.message.findMany({
          where: { threadId, kind: 'summary' },
          orderBy: { createdAt: 'desc' },
          take: summaryLookback,
          select: { content: true, createdAt: true },
        });
        const summaries = rawSummaries.filter((s) => s.content != null && s.content.length > 0);

        const hasSummaries = summaries.length > 0;

        if (hasSummaries) {
          summarySection = formatSummarySection([...summaries].reverse());
          // Hard cutoff: only load messages created AFTER the most recent summary.
          // The summary replaces everything before it — no duplicate context.
          const mostRecentSummary = summaries[0]!;
          const historyResult = await loadHistory(ctx.db, threadId, histLimitWithSummary, mostRecentSummary.createdAt);
          historySection = formatHistorySection(historyResult);
        } else {
          const historyResult = await loadHistory(ctx.db, threadId, histLimitDefault);
          historySection = formatHistorySection(historyResult);
        }
      }

      return buildPrompt([
        projectInstructionsSection ?? '',
        projectMemorySection ?? '',
        userProfileSection,
        fileReferencesSection,
        summarySection,
        historySection,
        prompt,
      ]);
    },
  };
};

export const plugin: PluginDefinition = {
  name: 'context',
  version: '1.0.0',
  settingsSchema,
  register,
};
