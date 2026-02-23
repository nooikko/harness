// Context plugin — reads context files and conversation history,
// injects them into prompts before invocation via onBeforeInvoke hook

import { resolve } from "node:path";
import type {
  PluginContext,
  PluginDefinition,
  PluginHooks,
} from "@/plugin-contract";
import { formatContextSection, readContextFiles } from "./_helpers/file-reader";
import { formatHistorySection, loadHistory } from "./_helpers/history-loader";

export type ContextPluginOptions = {
  contextDir?: string;
  historyLimit?: number;
};

type BuildPrompt = (parts: string[]) => string;

const buildPrompt: BuildPrompt = (parts) => {
  const nonEmpty = parts.filter((p) => p.length > 0);
  return nonEmpty.join("\n\n---\n\n");
};

type CreateRegister = (
  options?: ContextPluginOptions
) => PluginDefinition["register"];

const createRegister: CreateRegister = (options) => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    const contextDir = options?.contextDir ?? resolve(process.cwd(), "context");
    const historyLimit = options?.historyLimit;

    ctx.logger.info("Context plugin registered", { contextDir });

    return {
      onBeforeInvoke: async (threadId, prompt) => {
        // Read context files from disk
        const contextResult = readContextFiles(contextDir);

        if (contextResult.errors.length > 0) {
          ctx.logger.debug("Some context files not found", {
            missing: contextResult.errors.map((e) => e.name),
          });
        }

        const contextSection = formatContextSection(contextResult.files);

        // Load conversation history from Prisma
        const historyResult = await loadHistory(ctx.db, threadId, historyLimit);
        const historySection = formatHistorySection(historyResult);

        // Concatenate: context + history + original prompt
        return buildPrompt([contextSection, historySection, prompt]);
      },
    };
  };

  return register;
};

export const name = "context";
export const version = "1.0.0";

export const register: PluginDefinition["register"] = createRegister();

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
