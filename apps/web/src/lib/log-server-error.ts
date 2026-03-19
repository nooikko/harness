import { webLogger } from './logger';

type LogServerErrorParams = {
  action: string;
  error: unknown;
  context?: Record<string, unknown>;
};

type LogServerError = (params: LogServerErrorParams) => void;

export const logServerError: LogServerError = ({ action, error, context }) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  webLogger.error(`Server action failed: ${action}`, {
    action,
    error: message,
    ...(stack !== undefined && { stack }),
    ...context,
  });
};
