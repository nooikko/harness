'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { WsContext } from '@/app/_components/ws-provider';
import { getActiveDelegations } from '../_actions/get-active-delegations';

export type DelegationTask = {
  taskId: string;
  threadId: string;
  parentThreadId: string;
  prompt?: string;
  status: 'pending' | 'running' | 'evaluating' | 'completed' | 'failed';
  iteration: number;
  maxIterations: number;
  thinkingCount: number;
  toolCallCount: number;
  lastFeedback?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};

type TaskCreatedEvent = {
  taskId: string;
  threadId: string;
  parentThreadId: string;
  prompt?: string;
  maxIterations?: number;
};

type TaskStreamEvent = {
  taskId: string;
  parentThreadId: string;
  iteration: number;
  event: { type: string };
};

type TaskEvaluatedEvent = {
  taskId: string;
  threadId: string;
  iteration: number;
  accepted: boolean;
};

type TaskProgressEvent = {
  taskId: string;
  parentThreadId: string;
  iteration: number;
  maxIterations: number;
  feedback: string;
};

type TaskValidatedEvent = {
  taskId: string;
  parentThreadId: string;
  iterations: number;
};

type TaskFailedEvent = {
  taskId: string;
  parentThreadId: string;
  iterations: number;
  error: string;
};

type TaskCostCapEvent = {
  taskId: string;
  threadId: string;
  spent: number;
  cap: number;
};

const STREAM_FLUSH_INTERVAL_MS = 200;

type UseDelegationTasks = (parentThreadId: string) => DelegationTask[];

export const useDelegationTasks: UseDelegationTasks = (parentThreadId) => {
  const wsCtx = useContext(WsContext);
  const [tasks, setTasks] = useState<Map<string, DelegationTask>>(new Map());
  const streamAccRef = useRef<Map<string, { thinkingCount: number; toolCallCount: number }>>(new Map());
  const streamDirtyRef = useRef(false);
  const prevConnectedRef = useRef<boolean | null>(null);

  const updateTask = useCallback((taskId: string, updater: (prev: DelegationTask) => DelegationTask) => {
    setTasks((prev) => {
      const existing = prev.get(taskId);
      if (!existing) {
        return prev;
      }
      const next = new Map(prev);
      next.set(taskId, updater(existing));
      return next;
    });
  }, []);

  // Seed from DB on mount
  useEffect(() => {
    void getActiveDelegations(parentThreadId).then((results) => {
      if (results.length === 0) {
        return;
      }
      setTasks((prev) => {
        const next = new Map(prev);
        for (const r of results) {
          const task = r as unknown as DelegationTask;
          if (!next.has(task.taskId)) {
            next.set(task.taskId, task);
          }
        }
        return next;
      });
    });
  }, [parentThreadId]);

  // Re-seed on WebSocket reconnection (isConnected false -> true)
  useEffect(() => {
    if (!wsCtx) {
      return;
    }
    const wasDisconnected = prevConnectedRef.current === false;
    prevConnectedRef.current = wsCtx.isConnected;
    if (wasDisconnected && wsCtx.isConnected) {
      void getActiveDelegations(parentThreadId).then((results) => {
        if (results.length === 0) {
          return;
        }
        setTasks((prev) => {
          const next = new Map(prev);
          for (const r of results) {
            const task = r as unknown as DelegationTask;
            next.set(task.taskId, task);
          }
          return next;
        });
      });
    }
  }, [wsCtx?.isConnected, parentThreadId, wsCtx]);

  // Subscribe to all task:* events
  useEffect(() => {
    if (!wsCtx) {
      return;
    }

    const unsubs: (() => void)[] = [];

    // task:created
    unsubs.push(
      wsCtx.subscribe('task:created', (data) => {
        const event = data as TaskCreatedEvent;
        if (event.parentThreadId !== parentThreadId) {
          return;
        }
        const now = new Date();
        setTasks((prev) => {
          const next = new Map(prev);
          next.set(event.taskId, {
            taskId: event.taskId,
            threadId: event.threadId,
            parentThreadId: event.parentThreadId,
            prompt: event.prompt,
            status: 'running',
            iteration: 1,
            maxIterations: event.maxIterations ?? 4,
            thinkingCount: 0,
            toolCallCount: 0,
            createdAt: now,
            updatedAt: now,
          });
          return next;
        });
      }),
    );

    // task:stream — accumulate in ref, no re-render
    unsubs.push(
      wsCtx.subscribe('task:stream', (data) => {
        const event = data as TaskStreamEvent;
        if (event.parentThreadId !== parentThreadId) {
          return;
        }
        const acc = streamAccRef.current.get(event.taskId) ?? { thinkingCount: 0, toolCallCount: 0 };
        if (event.event.type === 'thinking') {
          acc.thinkingCount += 1;
        } else if (event.event.type === 'tool_call' || event.event.type === 'tool_use') {
          acc.toolCallCount += 1;
        }
        streamAccRef.current.set(event.taskId, acc);
        streamDirtyRef.current = true;
      }),
    );

    // task:evaluated — match by taskId (no parentThreadId)
    unsubs.push(
      wsCtx.subscribe('task:evaluated', (data) => {
        const event = data as TaskEvaluatedEvent;
        updateTask(event.taskId, (prev) => ({
          ...prev,
          status: event.accepted ? 'completed' : 'evaluating',
          iteration: event.iteration,
          updatedAt: new Date(),
        }));
      }),
    );

    // task:progress
    unsubs.push(
      wsCtx.subscribe('task:progress', (data) => {
        const event = data as TaskProgressEvent;
        if (event.parentThreadId !== parentThreadId) {
          return;
        }
        // Reset stream counts for the new iteration
        streamAccRef.current.set(event.taskId, { thinkingCount: 0, toolCallCount: 0 });
        updateTask(event.taskId, (prev) => ({
          ...prev,
          status: 'running',
          iteration: event.iteration,
          maxIterations: event.maxIterations,
          lastFeedback: event.feedback,
          thinkingCount: 0,
          toolCallCount: 0,
          updatedAt: new Date(),
        }));
      }),
    );

    // task:validated
    unsubs.push(
      wsCtx.subscribe('task:validated', (data) => {
        const event = data as TaskValidatedEvent;
        if (event.parentThreadId !== parentThreadId) {
          return;
        }
        updateTask(event.taskId, (prev) => ({
          ...prev,
          status: 'completed',
          iteration: event.iterations,
          updatedAt: new Date(),
        }));
      }),
    );

    // task:failed
    unsubs.push(
      wsCtx.subscribe('task:failed', (data) => {
        const event = data as TaskFailedEvent;
        if (event.parentThreadId !== parentThreadId) {
          return;
        }
        updateTask(event.taskId, (prev) => ({
          ...prev,
          status: 'failed',
          iteration: event.iterations,
          error: event.error,
          updatedAt: new Date(),
        }));
      }),
    );

    // task:cost-cap — match by taskId (no parentThreadId)
    unsubs.push(
      wsCtx.subscribe('task:cost-cap', (data) => {
        const event = data as TaskCostCapEvent;
        updateTask(event.taskId, (prev) => ({
          ...prev,
          status: 'failed',
          error: `Cost cap exceeded: $${event.spent.toFixed(2)} / $${event.cap.toFixed(2)}`,
          updatedAt: new Date(),
        }));
      }),
    );

    // task:cancelled
    unsubs.push(
      wsCtx.subscribe('task:cancelled', (data) => {
        const event = data as { taskId: string; parentThreadId: string };
        if (event.parentThreadId !== parentThreadId) {
          return;
        }
        updateTask(event.taskId, (prev) => ({
          ...prev,
          status: 'failed',
          error: 'Task cancelled',
          updatedAt: new Date(),
        }));
      }),
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [wsCtx, parentThreadId, updateTask]);

  // Flush stream accumulator to state every 200ms
  useEffect(() => {
    const interval = setInterval(() => {
      if (!streamDirtyRef.current) {
        return;
      }
      streamDirtyRef.current = false;
      const accEntries = Array.from(streamAccRef.current.entries());
      if (accEntries.length === 0) {
        return;
      }
      setTasks((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [taskId, acc] of accEntries) {
          const task = next.get(taskId);
          if (!task) {
            continue;
          }
          if (task.thinkingCount !== acc.thinkingCount || task.toolCallCount !== acc.toolCallCount) {
            next.set(taskId, {
              ...task,
              thinkingCount: acc.thinkingCount,
              toolCallCount: acc.toolCallCount,
              updatedAt: new Date(),
            });
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, STREAM_FLUSH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return Array.from(tasks.values());
};
