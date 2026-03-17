type WriteErrorToDb = (params: {
  db: unknown;
  level: string;
  source: string;
  message: string;
  stack?: string;
  traceId?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}) => void;

export const writeErrorToDb: WriteErrorToDb = ({ db, level, source, message, stack, traceId, threadId, metadata }) => {
  void (async () => {
    try {
      const client = db as {
        errorLog: {
          create: (args: {
            data: {
              level: string;
              source: string;
              message: string;
              stack?: string;
              traceId?: string;
              threadId?: string;
              metadata?: Record<string, unknown>;
            };
          }) => Promise<unknown>;
        };
      };
      await client.errorLog.create({
        data: {
          level,
          source,
          message,
          ...(stack !== undefined && { stack }),
          ...(traceId !== undefined && { traceId }),
          ...(threadId !== undefined && { threadId }),
          ...(metadata !== undefined && { metadata }),
        },
      });
    } catch (err) {
      // Last-resort fallback — cannot use @harness/logger here (circular dependency)
      process.stderr.write(`[writeErrorToDb] Failed to persist error log: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  })();
};
