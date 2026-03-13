import type { Message } from '@harness/database';

// A message kind that belongs inside a pipeline run (between start and complete status lines).
const PIPELINE_ACTIVITY_KINDS = new Set(['pipeline_step', 'thinking', 'tool_call', 'tool_result']);

type IsPipelineStatus = (message: Message, type: 'start' | 'complete') => boolean;

const isPipelineStatus: IsPipelineStatus = (message, type) => message.kind === 'status' && message.content.toLowerCase().includes(`pipeline ${type}`);

export type PipelineRun = {
  startMessage: Message;
  completeMessage: Message | null;
  activityMessages: Message[];
};

export type MessageGroup = { type: 'message'; message: Message } | { type: 'pipeline_run'; run: PipelineRun };

// Groups a chronological message list into regular messages and collapsed pipeline runs.
// A pipeline run is: status(start) → [activity messages] → status(complete).
// Unclosed runs (no complete status) are still grouped.
type GroupPipelineRuns = (messages: Message[]) => MessageGroup[];

export const groupPipelineRuns: GroupPipelineRuns = (messages) => {
  const groups: MessageGroup[] = [];
  let currentRun: PipelineRun | null = null;

  for (const message of messages) {
    if (isPipelineStatus(message, 'start')) {
      // If there's already an open run, close it without a complete message
      if (currentRun) {
        groups.push({ type: 'pipeline_run', run: currentRun });
      }
      currentRun = {
        startMessage: message,
        completeMessage: null,
        activityMessages: [],
      };
      continue;
    }

    if (currentRun && isPipelineStatus(message, 'complete')) {
      currentRun.completeMessage = message;
      groups.push({ type: 'pipeline_run', run: currentRun });
      currentRun = null;
      continue;
    }

    if (currentRun && (PIPELINE_ACTIVITY_KINDS.has(message.kind ?? 'text') || message.kind === 'status')) {
      currentRun.activityMessages.push(message);
      continue;
    }

    // Not inside a run, or it's a regular message (user/assistant text)
    if (currentRun) {
      // Close the run — this message doesn't belong to it
      groups.push({ type: 'pipeline_run', run: currentRun });
      currentRun = null;
    }
    groups.push({ type: 'message', message });
  }

  // Close any trailing open run
  if (currentRun) {
    groups.push({ type: 'pipeline_run', run: currentRun });
  }

  return groups;
};
