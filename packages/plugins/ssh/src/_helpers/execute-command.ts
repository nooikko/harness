import type { Client as SshClient } from 'ssh2';

type ExecuteCommandParams = {
  client: SshClient;
  command: string;
  timeoutMs: number;
  maxOutputLength: number;
};

type ExecuteCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
};

type ExecuteCommand = (params: ExecuteCommandParams) => Promise<ExecuteCommandResult>;

const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  const lastNewline = text.lastIndexOf('\n', maxLength);
  const cutPoint = lastNewline > 0 ? lastNewline : maxLength;
  const omitted = text.length - cutPoint;
  return `${text.slice(0, cutPoint)}\n[Output truncated — ${omitted} bytes omitted]`;
};

export const executeCommand: ExecuteCommand = ({ client, command, timeoutMs, maxOutputLength }) => {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = '';
      let stderr = '';
      let exitCode: number | null = null;
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          stream.signal('KILL');
          stream.close();
        } catch {
          // Channel may already be closed — ignore
        }
      }, timeoutMs);

      stream.on('data', (data: Buffer) => {
        stdout += data.toString('utf8');
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf8');
      });

      stream.on('exit', (code: number | null) => {
        exitCode = code;
      });

      stream.on('close', () => {
        clearTimeout(timer);
        resolve({
          stdout: truncate(stdout, maxOutputLength),
          stderr: truncate(stderr, maxOutputLength),
          exitCode,
          timedOut,
        });
      });
    });
  });
};
