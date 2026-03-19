// Logger package — structured logging for Harness (backed by Pino)

export { createHttpLogger } from './_helpers/create-http-logger';
export { writeErrorToDb } from './_helpers/write-error-to-db';

import type { TransportTargetOptions } from 'pino';
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

type BuildTransport = () => pino.TransportSingleOptions | pino.TransportMultiOptions | undefined;

const buildTransport: BuildTransport = () => {
  const targets: TransportTargetOptions[] = [];

  if (env.LOG_FILE) {
    // Primary rotating log: info+ level, daily rotation, 100MB size cap, 7 files kept
    targets.push({
      target: 'pino-roll',
      level: 'info',
      options: {
        file: env.LOG_FILE,
        frequency: 'daily',
        size: '100m',
        dateFormat: 'yyyy-MM-dd',
        symlink: true,
        limit: { count: 7 },
        mkdir: true,
      },
    });

    // Error-only rotating log: errors retained longer (14 files)
    targets.push({
      target: 'pino-roll',
      level: 'error',
      options: {
        file: `${env.LOG_FILE}.error`,
        frequency: 'daily',
        size: '50m',
        dateFormat: 'yyyy-MM-dd',
        limit: { count: 14 },
        mkdir: true,
      },
    });
  }

  if (env.LOKI_URL) {
    targets.push({
      target: 'pino-loki',
      level: 'info',
      options: {
        host: env.LOKI_URL,
        batching: true,
        interval: 2,
      },
    });
  }

  // If we have any targets from LOG_FILE or LOKI_URL, return multi-target
  if (targets.length > 0) {
    return { targets };
  }

  // Dev mode: pretty print
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

  // Production without LOG_FILE/LOKI_URL: no transport (JSON to stdout)
  return undefined;
};

const rootLogger = pino({
  level: env.LOG_LEVEL,
  transport: buildTransport(),
});

// --- Adapter: wraps a Pino child logger as a Logger interface ---

type WrapPino = (pinoLogger: pino.Logger) => Logger & {
  _pinoInstance: pino.Logger;
};

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

// --- Flush + raw instance access ---

type FlushLogger = () => void;

export const flushLogger: FlushLogger = () => {
  rootLogger.flush();
};

type GetRootPinoInstance = () => pino.Logger;

export const getRootPinoInstance: GetRootPinoInstance = () => rootLogger;
