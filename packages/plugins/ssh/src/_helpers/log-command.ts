import type { PrismaClient } from '@harness/database';

type LogCommandParams = {
  hostId: string;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  duration: number;
  threadId: string | undefined;
  agentId: string | undefined;
};

type LogCommand = (db: PrismaClient, params: LogCommandParams, logger?: { warn: (msg: string) => void }) => void;

const MAX_STORED_LENGTH = 500;

const truncateForStorage = (text: string): string => {
  if (text.length <= MAX_STORED_LENGTH) {
    return text;
  }
  return text.slice(0, MAX_STORED_LENGTH);
};

export const logCommand: LogCommand = (db, params, logger) => {
  void (async () => {
    try {
      await db.sshCommandLog.create({
        data: {
          hostId: params.hostId,
          command: params.command,
          exitCode: params.exitCode,
          stdout: truncateForStorage(params.stdout) || null,
          stderr: truncateForStorage(params.stderr) || null,
          duration: params.duration,
          threadId: params.threadId ?? null,
          agentId: params.agentId ?? null,
        },
      });
    } catch (err) {
      if (logger) {
        logger.warn(`ssh: audit log write failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  })();
};
