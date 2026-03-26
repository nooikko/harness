// Time plugin — injects ambient clock metadata into every prompt
// Also handles /current-time token replacement and provides a current_time MCP tool

import type { PluginContext, PluginDefinition, PluginHooks, PluginTool } from '@harness/plugin-contract';
import { formatTime } from './_helpers/format-time';

const COMMAND_PATTERN = /\/current-time/g;

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Time plugin registered');

    return {
      onBeforeInvoke: async (_threadId, prompt) => {
        const timeStr = formatTime({ timezone: ctx.config.timezone });

        // Always inject ambient clock metadata before ## User Message
        const clockTag = `[clock: ${timeStr}]`;
        const userMsgMarker = '## User Message';
        const markerIdx = prompt.indexOf(userMsgMarker);
        const withClock = markerIdx !== -1 ? `${prompt.slice(0, markerIdx)}${clockTag}\n\n${prompt.slice(markerIdx)}` : `${clockTag}\n\n${prompt}`;

        // Handle /current-time token replacement (backward compat)
        if (!COMMAND_PATTERN.test(withClock)) {
          COMMAND_PATTERN.lastIndex = 0;
          return withClock;
        }
        COMMAND_PATTERN.lastIndex = 0;

        // Detect if /current-time is the entire User Message section (standalone use).
        const userMessageContent = /## User Message\s*\n\n(.+)$/s.exec(withClock)?.[1]?.trim();
        if (userMessageContent === '/current-time') {
          return withClock.replace(
            /## User Message\s*\n\n.+$/s,
            `## User Message\n\nThe current time is ${timeStr}. Please tell me the current time.`,
          );
        }

        return withClock.replace(COMMAND_PATTERN, `[Current time: ${timeStr}]`);
      },
    };
  };

  return register;
};

type CreateTools = () => PluginTool[];

const createTools: CreateTools = () => [
  {
    name: 'current_time',
    audience: 'agent',
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

type StartFn = NonNullable<PluginDefinition['start']>;

const start: StartFn = async (ctx) => {
  const tz = ctx.config.timezone;
  const supported = Intl.supportedValuesOf('timeZone');
  if (!supported.includes(tz)) {
    ctx.logger.error(
      `Time plugin: invalid timezone "${tz}" — time reporting will fall back to UTC. Update OrchestratorConfig.timezone to a valid IANA timezone string.`,
    );
  }
};

export const plugin: PluginDefinition = {
  name: 'time',
  version: '1.0.0',
  register: createRegister(),
  start,
  tools: createTools(),
};
