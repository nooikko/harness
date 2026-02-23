// Logger package — structured logging for Harness

export type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
};

type CreateLogger = (prefix: string) => Logger;

export const createLogger: CreateLogger = (prefix) => ({
  info: (message, meta) => console.log(`[${prefix}] ${message}`, meta ?? ""),
  warn: (message, meta) => console.warn(`[${prefix}] ${message}`, meta ?? ""),
  error: (message, meta) => console.error(`[${prefix}] ${message}`, meta ?? ""),
  debug: (message, meta) => console.debug(`[${prefix}] ${message}`, meta ?? ""),
});
