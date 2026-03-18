// Scans for OrchestratorTask rows stuck at status='running' after a process crash
// and resets them to 'failed'. Called once at boot before plugins start.
//
// Note: parent-thread notification is intentionally omitted here because plugins
// have not started yet when this runs (sendToThread requires the web plugin).
// Recovery is visible in logs and in the DB; a future enhancement could post
// notifications after orchestrator.start() by passing sendToThread as a callback.

import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';

const ORPHAN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

type RecoverOrphanedTasks = (db: PrismaClient, logger: Logger) => Promise<number>;

export const recoverOrphanedTasks: RecoverOrphanedTasks = async (db, logger) => {
  const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS);

  const orphaned = await db.orchestratorTask.findMany({
    where: {
      status: { in: ['running', 'evaluating', 'pending'] },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      threadId: true,
      currentIteration: true,
      maxIterations: true,
    },
  });

  if (orphaned.length === 0) {
    return 0;
  }

  logger.warn(`Recovering ${orphaned.length} orphaned task(s) from previous run`);

  for (const task of orphaned) {
    await db.orchestratorTask.update({
      where: { id: task.id },
      data: { status: 'failed' },
    });

    await db.thread.update({
      where: { id: task.threadId },
      data: { status: 'failed', lastActivity: new Date() },
    });

    logger.warn('Recovered orphaned task', {
      taskId: task.id,
      threadId: task.threadId,
      iteration: task.currentIteration,
      maxIterations: task.maxIterations,
    });
  }

  return orphaned.length;
};
