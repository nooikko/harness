// Orchestrator configuration

export type { LogLevel, OrchestratorConfig } from '@harness/plugin-contract';

import type { HookTimeouts, LogLevel, OrchestratorConfig } from '@harness/plugin-contract';
import { loadEnv } from './env';

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
  const env = loadEnv();

  const hookTimeouts: HookTimeouts = {
    onMessage: env.HOOK_TIMEOUT_ON_MESSAGE ?? 5_000,
    onBeforeInvoke: env.HOOK_TIMEOUT_ON_BEFORE_INVOKE ?? 2_000,
    onAfterInvoke: env.HOOK_TIMEOUT_ON_AFTER_INVOKE ?? 5_000,
    onBroadcast: env.HOOK_TIMEOUT_ON_BROADCAST ?? 10_000,
    onPipelineStart: env.HOOK_TIMEOUT_ON_PIPELINE_START ?? 5_000,
    onPipelineComplete: env.HOOK_TIMEOUT_ON_PIPELINE_COMPLETE ?? 15_000,
    onSettingsChange: env.HOOK_TIMEOUT_ON_SETTINGS_CHANGE ?? 30_000,
    onIntentClassify: env.HOOK_TIMEOUT_ON_INTENT_CLASSIFY,
  };

  const config: OrchestratorConfig = {
    databaseUrl: env.DATABASE_URL,
    timezone: env.TZ,
    maxConcurrentAgents: env.MAX_CONCURRENT_AGENTS,
    claudeModel: env.CLAUDE_MODEL_DEFAULT,
    claudeTimeout: env.CLAUDE_TIMEOUT,
    discordToken: env.DISCORD_TOKEN,
    discordChannelId: env.DISCORD_CHANNEL_ID,
    port: env.PORT,
    logLevel: parseLogLevel(env.LOG_LEVEL),
    uploadDir: env.UPLOAD_DIR,
    hookTimeouts,
  };

  return validateConfig(config);
};
