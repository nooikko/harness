// Creates a single Agent SDK streaming session using query() with async iterable input
// The CLI subprocess stays alive between yields, keeping the session warm

import os from 'node:os';
import type { SDKMessage, SDKResultMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SendOptions, Session, SessionConfig } from './session-pool';

type PendingRequest = {
  prompt: string;
  resolve: (result: SDKResultMessage) => void;
  reject: (error: Error) => void;
  onMessage?: (message: SDKMessage) => void;
};

type CreateSession = (model: string, config?: SessionConfig) => Session;

export const createSession: CreateSession = (model, config) => {
  let alive = true;
  let lastActivity = Date.now();

  const pending: PendingRequest[] = [];
  let activeRequest: PendingRequest | null = null;
  let yieldResolver: ((msg: SDKUserMessage) => void) | null = null;

  const drainQueue = () => {
    if (pending.length > 0 && yieldResolver && !activeRequest) {
      const request = pending.shift()!;
      activeRequest = request;
      const resolver = yieldResolver;
      yieldResolver = null;

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

  const q = query({
    prompt: messageStream(),
    options: {
      model,
      // Use a neutral cwd outside the project tree so the Claude subprocess does not
      // auto-load the harness CLAUDE.md, .claude/rules/, or dev-session memory files.
      // The orchestrator agent's context is delivered via the context plugin instead.
      cwd: os.tmpdir(),
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      env,
      ...(config?.mcpServerFactory ? { mcpServers: config.mcpServerFactory() } : {}),
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
    }
    alive = false;
  };

  consume();

  const send = (prompt: string, options?: SendOptions): Promise<SDKResultMessage> => {
    if (!alive) {
      return Promise.reject(new Error('Session is closed'));
    }
    return new Promise<SDKResultMessage>((resolve, reject) => {
      pending.push({ prompt, resolve, reject, onMessage: options?.onMessage });
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
