// Orchestrator configuration

export type { LogLevel, OrchestratorConfig } from '@harness/plugin-contract';

import type { LogLevel, OrchestratorConfig } from '@harness/plugin-contract';

const LOG_LEVELS: ReadonlySet<string> = new Set(['debug', 'info', 'warn', 'error']);

type ParseLogLevel = (raw: string | undefined) => LogLevel;

const parseLogLevel: ParseLogLevel = (raw) => {
  const normalized = raw?.toLowerCase();
  if (normalized && LOG_LEVELS.has(normalized)) {
    return normalized as LogLevel;
  }
  return 'info';
};

type ValidateConfig = (config: OrchestratorConfig) => OrchestratorConfig;

const validateConfig: ValidateConfig = (config) => {
  if (!config.databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL. ' + 'Set it in your .env file or environment.');
  }
  return config;
};

type LoadConfig = () => OrchestratorConfig;

export const loadConfig: LoadConfig = () => {
  const config: OrchestratorConfig = {
    databaseUrl: process.env.DATABASE_URL ?? '',
    timezone: process.env.TZ ?? 'America/Phoenix',
    maxConcurrentAgents: Number(process.env.MAX_CONCURRENT_AGENTS ?? '3'),
    claudeModel: process.env.CLAUDE_MODEL_DEFAULT ?? 'haiku',
    claudeTimeout: Number(process.env.CLAUDE_TIMEOUT ?? '300000'),
    discordToken: process.env.DISCORD_TOKEN,
    discordChannelId: process.env.DISCORD_CHANNEL_ID,
    port: Number(process.env.PORT ?? '4001'),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
  };

  return validateConfig(config);
};
