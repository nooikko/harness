// Orchestrator configuration

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type OrchestratorConfig = {
  databaseUrl: string;
  timezone: string;
  maxConcurrentAgents: number;
  claudeModel: string;
  claudeTimeout: number;
  discordToken: string | undefined;
  discordChannelId: string | undefined;
  port: number;
  logLevel: LogLevel;
  pluginsDir: string;
};

const LOG_LEVELS: ReadonlySet<string> = new Set([
  "debug",
  "info",
  "warn",
  "error",
]);

type ParseLogLevel = (raw: string | undefined) => LogLevel;

const parseLogLevel: ParseLogLevel = (raw) => {
  const normalized = raw?.toLowerCase();
  if (normalized && LOG_LEVELS.has(normalized)) {
    return normalized as LogLevel;
  }
  return "info";
};

type DefaultPluginsDir = () => string;

const defaultPluginsDir: DefaultPluginsDir = () => {
  const currentDir = resolve(fileURLToPath(import.meta.url), "..");
  return resolve(currentDir, "..", "plugins");
};

type ValidateConfig = (config: OrchestratorConfig) => OrchestratorConfig;

const validateConfig: ValidateConfig = (config) => {
  if (!config.databaseUrl) {
    throw new Error(
      "Missing required environment variable: DATABASE_URL. " +
        "Set it in your .env file or environment."
    );
  }
  return config;
};

type LoadConfig = () => OrchestratorConfig;

export const loadConfig: LoadConfig = () => {
  const config: OrchestratorConfig = {
    databaseUrl: process.env.DATABASE_URL ?? "",
    timezone: process.env.TZ ?? "America/Phoenix",
    maxConcurrentAgents: Number(process.env.MAX_CONCURRENT_AGENTS ?? "3"),
    claudeModel: process.env.CLAUDE_MODEL_DEFAULT ?? "sonnet",
    claudeTimeout: Number(process.env.CLAUDE_TIMEOUT ?? "300000"),
    discordToken: process.env.DISCORD_TOKEN,
    discordChannelId: process.env.DISCORD_CHANNEL_ID,
    port: Number(process.env.PORT ?? "3001"),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    pluginsDir: process.env.PLUGINS_DIR ?? defaultPluginsDir(),
  };

  return validateConfig(config);
};
