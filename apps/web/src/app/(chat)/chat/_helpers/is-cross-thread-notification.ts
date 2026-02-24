// Detects whether a message is a cross-thread notification by inspecting its metadata.
// Cross-thread notifications are system messages persisted by the delegation plugin
// with metadata.type === "cross-thread-notification".

import type { Message } from 'database';

export type CrossThreadMetadata = {
  type: 'cross-thread-notification';
  sourceThreadId: string;
  taskId: string;
  status: 'completed' | 'failed';
  iterations: number;
};

type IsCrossThreadNotification = (message: Message) => message is Message & { metadata: CrossThreadMetadata };

export const isCrossThreadNotification: IsCrossThreadNotification = (message): message is Message & { metadata: CrossThreadMetadata } => {
  if (message.role !== 'system' || !message.metadata) {
    return false;
  }

  const meta = message.metadata as Record<string, unknown>;
  return meta.type === 'cross-thread-notification' && typeof meta.sourceThreadId === 'string' && typeof meta.taskId === 'string';
};
