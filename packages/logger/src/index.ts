// Logger package — structured logging for Harness (backed by Pino)

export { writeErrorToDb } from './_helpers/write-error-to-db';

import pino from 'pino';
import { loadLoggerEnv } from './env';

// --- Public types (unchanged — all existing consumers keep working) ---

export type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
};

// --- Pino instance ---

const env = loadLoggerEnv();

type BuildTransport = () => pino.TransportSingleOptions | undefined;

const buildTransport: BuildTransport = () => {
  if (env.LOG_FILE) {
    return {
      target: 'pino/file',
      options: { destination: env.LOG_FILE, mkdir: true },
    };
  }
  if (env.NODE_ENV !== 'production') {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    };
  }
  return undefined;
};

const rootLogger = pino({
  level: env.LOG_LEVEL,
  transport: buildTransport(),
});

// --- Adapter: wraps a Pino child logger as a Logger interface ---

type WrapPino = (pinoLogger: pino.Logger) => Logger & { _pinoInstance: pino.Logger };

const wrapPino: WrapPino = (p) => {
  const wrapped: Logger & { _pinoInstance: pino.Logger } = {
    _pinoInstance: p,
    info: (message, meta) => {
      if (meta) {
        p.info(meta, message);
      } else {
        p.info(message);
      }
    },
    warn: (message, meta) => {
      if (meta) {
        p.warn(meta, message);
      } else {
        p.warn(message);
      }
    },
    error: (message, meta) => {
      if (meta) {
        p.error(meta, message);
      } else {
        p.error(message);
      }
    },
    debug: (message, meta) => {
      if (meta) {
        p.debug(meta, message);
      } else {
        p.debug(message);
      }
    },
  };
  return wrapped;
};

// --- Public API ---

type CreateLogger = (prefix: string) => Logger;

export const createLogger: CreateLogger = (prefix) => wrapPino(rootLogger.child({ prefix }));

type CreateChildLogger = (parent: Logger, context: Record<string, unknown>) => Logger;

/**
 * Creates a child logger with additional bound context fields.
 * Every log call from the child will include these fields automatically.
 * Use for binding traceId, pluginName, threadId, etc.
 */
export const createChildLogger: CreateChildLogger = (parent, context) => {
  const pinoParent = (parent as { _pinoInstance?: pino.Logger })._pinoInstance;
  if (pinoParent) {
    return wrapPino(pinoParent.child(context));
  }
  // Fallback for mock/external loggers: merge context into every meta call
  return {
    info: (message, meta) => parent.info(message, { ...context, ...meta }),
    warn: (message, meta) => parent.warn(message, { ...context, ...meta }),
    error: (message, meta) => parent.error(message, { ...context, ...meta }),
    debug: (message, meta) => parent.debug(message, { ...context, ...meta }),
  };
};
