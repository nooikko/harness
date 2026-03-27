// Validated environment variables for the orchestrator.
// Parsed lazily via loadEnv() so tests can set process.env before validation.

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default(''),
  TZ: z.string().default('America/Phoenix'),
  MAX_CONCURRENT_AGENTS: z.coerce.number().default(3),
  CLAUDE_MODEL_DEFAULT: z.string().default('haiku'),
  CLAUDE_TIMEOUT: z.coerce.number().default(1_800_000), // 30 minutes
  DISCORD_TOKEN: z.string().optional(),
  DISCORD_CHANNEL_ID: z.string().optional(),
  PORT: z.coerce.number().default(4001),
  LOG_LEVEL: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  HOOK_TIMEOUT_ON_MESSAGE: z.coerce.number().optional(),
  HOOK_TIMEOUT_ON_BEFORE_INVOKE: z.coerce.number().optional(),
  HOOK_TIMEOUT_ON_AFTER_INVOKE: z.coerce.number().optional(),
  HOOK_TIMEOUT_ON_BROADCAST: z.coerce.number().optional(),
  HOOK_TIMEOUT_ON_PIPELINE_START: z.coerce.number().optional(),
  HOOK_TIMEOUT_ON_PIPELINE_COMPLETE: z.coerce.number().optional(),
  HOOK_TIMEOUT_ON_SETTINGS_CHANGE: z.coerce.number().optional(),
  HOOK_TIMEOUT_ON_INTENT_CLASSIFY: z.coerce.number().optional(),
});

type LoadEnv = () => z.infer<typeof envSchema>;

export const loadEnv: LoadEnv = () => envSchema.parse(process.env);
