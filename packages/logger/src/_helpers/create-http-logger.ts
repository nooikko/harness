import type { IncomingMessage, ServerResponse } from 'node:http';
import type pino from 'pino';
import type { HttpLogger, Options } from 'pino-http';
import pinoHttp from 'pino-http';

type CreateHttpLoggerOptions = {
  pinoInstance: pino.Logger;
};

type CreateHttpLogger = (options: CreateHttpLoggerOptions) => HttpLogger<IncomingMessage, ServerResponse>;

export const createHttpLogger: CreateHttpLogger = ({ pinoInstance }) => {
  const httpLoggerOptions: Options = {
    logger: pinoInstance,
    autoLogging: {
      ignore: (req) => {
        // Don't log health check spam
        const url = (req as { url?: string }).url ?? '';
        return url === '/health' || url === '/healthz' || url === '/ready';
      },
    },
    customSuccessMessage: (req, res) => {
      const method = (req as { method?: string }).method ?? '?';
      const url = (req as { url?: string }).url ?? '?';
      const status = (res as { statusCode?: number }).statusCode ?? 0;
      return `${method} ${url} ${status}`;
    },
    customErrorMessage: (req, _res, err) => {
      const method = (req as { method?: string }).method ?? '?';
      const url = (req as { url?: string }).url ?? '?';
      return `${method} ${url} failed: ${err.message}`;
    },
  };

  return pinoHttp(httpLoggerOptions);
};
