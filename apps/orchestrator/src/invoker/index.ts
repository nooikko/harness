// Invoker module — manages Claude CLI process invocations

import { spawn } from 'node:child_process';
import type { InvokeOptions, InvokeResult } from '@harness/plugin-contract';
import { buildArgs } from './_helpers/build-args';

export type { InvokeOptions, InvokeResult } from '@harness/plugin-contract';

export type InvokerConfig = {
  defaultModel: string;
  defaultTimeout: number;
};

type CreateInvoker = (config: InvokerConfig) => {
  invoke: (prompt: string, options?: InvokeOptions) => Promise<InvokeResult>;
};

export const createInvoker: CreateInvoker = (config) => {
  const invoke = async (prompt: string, options?: InvokeOptions): Promise<InvokeResult> => {
    const startTime = Date.now();
    const args = buildArgs(prompt, {
      model: options?.model ?? config.defaultModel,
      allowedTools: options?.allowedTools,
      maxTokens: options?.maxTokens,
    });
    const timeout = options?.timeout ?? config.defaultTimeout;

    return new Promise<InvokeResult>((resolve) => {
      const env = { ...process.env };
      // Remove Claude Code's nested-session guard so the CLI can be spawned as a child process
      delete env.CLAUDECODE;

      const child = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        // Give it a moment to clean up, then force kill
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({
          output: stdout.trim(),
          error: killed ? `Timed out after ${timeout}ms` : stderr.trim() || undefined,
          durationMs,
          exitCode: code,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({
          output: '',
          error: `Failed to spawn claude: ${err.message}`,
          durationMs,
          exitCode: null,
        });
      });
    });
  };

  return { invoke };
};
