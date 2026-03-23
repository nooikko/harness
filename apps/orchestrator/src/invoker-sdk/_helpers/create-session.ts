// Creates a single Agent SDK streaming session using query() with async iterable input
// The CLI subprocess stays alive between yields, keeping the session warm

import os from 'node:os';
import type { SDKMessage, SDKResultMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ContentBlock, PluginContext } from '@harness/plugin-contract';
import type { ToolContextRef } from '../../tool-server';
import type { InvocationMeta, SendOptions, Session, SessionConfig } from './session-pool';

type PendingRequest = {
  prompt: string;
  resolve: (result: SDKResultMessage) => void;
  reject: (error: Error) => void;
  onMessage?: (message: SDKMessage) => void;
  meta?: InvocationMeta;
};

type CreateSession = (model: string, config?: SessionConfig) => Session;

export const createSession: CreateSession = (model, config) => {
  let alive = true;
  let lastActivity = Date.now();

  // Per-session context ref — each session gets its own, captured by the MCP tool server.
  // Updated by drainQueue when a request becomes active, so tool handlers always read
  // the correct threadId/traceId/taskId for the currently-executing invocation.
  const contextRef: ToolContextRef = { ctx: null, threadId: '', pendingBlocks: [] };

  const pending: PendingRequest[] = [];
  const MAX_PENDING = 100;
  let activeRequest: PendingRequest | null = null;
  let yieldResolver: ((msg: SDKUserMessage) => void) | null = null;

  const drainQueue = () => {
    if (pending.length > 0 && yieldResolver && !activeRequest) {
      const request = pending.shift()!;
      activeRequest = request;
      const resolver = yieldResolver;
      yieldResolver = null;

      // Copy per-invocation meta to the session's contextRef so tool handlers
      // read the correct values for THIS request (not a stale or overwritten one)
      if (request.meta) {
        contextRef.threadId = request.meta.threadId;
        contextRef.traceId = request.meta.traceId;
        contextRef.taskId = request.meta.taskId;
        contextRef.pendingBlocks = request.meta.pendingBlocks as ContentBlock[][];
        contextRef.ctx = request.meta.ctx as PluginContext | null;
      }

      resolver({
        type: 'user',
        session_id: '',
        message: {
          role: 'user',
          content: [{ type: 'text', text: request.prompt }],
        },
        parent_tool_use_id: null,
      });
    }
  };

  // Async generator that the SDK consumes — pauses between yields to keep subprocess warm
  const messageStream = async function* (): AsyncGenerator<SDKUserMessage> {
    while (alive) {
      const msg: SDKUserMessage = await new Promise<SDKUserMessage>((resolve) => {
        yieldResolver = resolve;
        drainQueue();
      });
      yield msg;
    }
  };

  const env: Record<string, string | undefined> = { ...process.env };
  delete env.CLAUDECODE;
  delete env.ANTHROPIC_API_KEY;

  // If a systemPrompt is provided, define an inline agent with that prompt
  const agentConfig = config?.systemPrompt
    ? {
        agent: 'harness-agent',
        agents: {
          'harness-agent': {
            description: 'Harness orchestrator agent',
            prompt: config.systemPrompt,
            ...(config?.maxTurns ? { maxTurns: config.maxTurns } : {}),
          },
        },
      }
    : {};

  const q = query({
    prompt: messageStream(),
    options: {
      model,
      // Use config.cwd if provided (workspace tasks set this to the target project directory).
      // Otherwise use a neutral cwd outside the project tree so the Claude subprocess does not
      // auto-load the harness CLAUDE.md, .claude/rules/, or dev-session memory files.
      cwd: config?.cwd ?? os.tmpdir(),
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      env,
      ...(config?.mcpServerFactory ? { mcpServers: config.mcpServerFactory(contextRef) } : {}),
      ...(config?.thinking ? { thinking: config.thinking } : {}),
      ...(config?.effort ? { effort: config.effort } : {}),
      ...(config?.disallowedTools?.length ? { disallowedTools: config.disallowedTools } : {}),
      ...(config?.maxTurns && !config?.systemPrompt ? { maxTurns: config.maxTurns } : {}),
      ...agentConfig,
    },
  });

  // Background consumer: reads SDK messages and resolves result promises
  const consume = async () => {
    try {
      for await (const message of q as AsyncIterable<SDKMessage>) {
        if (message.type === 'result') {
          if (activeRequest) {
            const req = activeRequest;
            activeRequest = null;
            lastActivity = Date.now();
            req.resolve(message as SDKResultMessage);
            drainQueue();
          }
        } else if (activeRequest?.onMessage) {
          activeRequest.onMessage(message);
        }
      }
    } catch (err) {
      if (activeRequest) {
        activeRequest.reject(err instanceof Error ? err : new Error(String(err)));
        activeRequest = null;
      }
      for (const req of pending) {
        req.reject(err instanceof Error ? err : new Error(String(err)));
      }
      pending.length = 0;
      // Close the SDK subprocess to prevent zombie processes lingering after errors
      q.close();
    }
    alive = false;
  };

  consume();

  const send = (prompt: string, options?: SendOptions): Promise<SDKResultMessage> => {
    if (!alive) {
      return Promise.reject(new Error('Session is closed'));
    }
    if (pending.length >= MAX_PENDING) {
      return Promise.reject(new Error(`Session queue full (max ${MAX_PENDING} pending requests)`));
    }
    return new Promise<SDKResultMessage>((resolve, reject) => {
      pending.push({ prompt, resolve, reject, onMessage: options?.onMessage, meta: options?.meta });
      drainQueue();
    });
  };

  const close = () => {
    alive = false;
    q.close();
    for (const req of pending) {
      req.reject(new Error('Session closed'));
    }
    pending.length = 0;
    if (activeRequest) {
      activeRequest.reject(new Error('Session closed'));
      activeRequest = null;
    }
  };

  return {
    send,
    close,
    get isAlive() {
      return alive;
    },
    get lastActivity() {
      return lastActivity;
    },
  };
};
