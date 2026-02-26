// Time plugin — injects current time when user types /current-time
// Also provides a current_time MCP tool for Claude to check the time

import type { PluginContext, PluginDefinition, PluginHooks, PluginTool } from '@harness/plugin-contract';
import { formatTime } from './_helpers/format-time';

const COMMAND_PATTERN = /\/current-time/g;

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Time plugin registered');

    return {
      onBeforeInvoke: async (_threadId, prompt) => {
        if (!COMMAND_PATTERN.test(prompt)) {
          COMMAND_PATTERN.lastIndex = 0;
          return prompt;
        }
        COMMAND_PATTERN.lastIndex = 0;

        const timeStr = formatTime({ timezone: ctx.config.timezone });

        // Detect if /current-time is the entire User Message section (standalone use).
        // When standalone, the replacement would leave Claude with no actionable content —
        // just a timestamp annotation. Rewrite the whole section to include user intent.
        const userMessageContent = /## User Message\s*\n\n(.+)$/s.exec(prompt)?.[1]?.trim();
        if (userMessageContent === '/current-time') {
          return prompt.replace(/## User Message\s*\n\n.+$/s, `## User Message\n\nThe current time is ${timeStr}. Please tell me the current time.`);
        }

        return prompt.replace(COMMAND_PATTERN, `[Current time: ${timeStr}]`);
      },
    };
  };

  return register;
};

type CreateTools = () => PluginTool[];

const createTools: CreateTools = () => [
  {
    name: 'current_time',
    description: 'Get the current date and time in the configured timezone.',
    schema: {
      type: 'object',
      properties: {},
    },
    handler: async (ctx) => {
      return formatTime({ timezone: ctx.config.timezone });
    },
  },
];

export const plugin: PluginDefinition = {
  name: 'time',
  version: '1.0.0',
  register: createRegister(),
  tools: createTools(),
};
