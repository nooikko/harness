'use server';

import { prisma } from '@harness/database';
import { encryptValue } from '@harness/plugin-contract';
import { revalidatePath } from 'next/cache';
import { loadEnv } from '@/app/_helpers/env';
import { webLogger } from '@/lib/logger';

type InstallSshKeyParams = {
  hostId: string;
  hostname: string;
  port: number;
  username: string;
  password: string;
};

type InstallSshKeyResult = { success: true; publicKey: string } | { error: string };

type InstallSshKey = (params: InstallSshKeyParams) => Promise<InstallSshKeyResult>;

export const installSshKey: InstallSshKey = async ({ hostId, hostname, port, username, password }) => {
  if (!password) {
    return { error: 'Password is required' };
  }
  if (!hostname) {
    return { error: 'Hostname is required' };
  }
  if (!username) {
    return { error: 'Username is required' };
  }

  const encryptionKey = loadEnv().HARNESS_ENCRYPTION_KEY;
  if (!encryptionKey) {
    return {
      error: 'Cannot store private key: HARNESS_ENCRYPTION_KEY is not configured',
    };
  }

  // Verify the host record exists
  const hostRecord = await prisma.sshHost.findUnique({
    where: { id: hostId },
    select: { id: true },
  });

  if (!hostRecord) {
    return { error: 'SSH host not found' };
  }

  // Use form-provided connection details, not database values
  const host = { id: hostId, hostname, port, username };

  // Generate ed25519 key pair using ssh2's generator (produces OpenSSH format that ssh2 can parse)
  const { Client, utils: sshUtils } = await import('ssh2');
  const keyPair = sshUtils.generateKeyPairSync('ed25519');
  const privateKey = keyPair.private;
  const publicKey = `${keyPair.public.trim()} harness@${host.hostname}`;

  // Connect with password and install the public key
  try {
    const client = new Client();

    webLogger.info(`install-ssh-key: connecting to ${host.username}@${host.hostname}:${host.port}`);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        webLogger.warn('install-ssh-key: connection timed out after 10s');
        client.end();
        reject(new Error('Connection timed out (10s)'));
      }, 10_000);

      client.on('ready', () => {
        clearTimeout(timeout);
        webLogger.info('install-ssh-key: connected, installing key');

        // Append public key to authorized_keys
        const cmd = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${publicKey}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;

        client.exec(cmd, ((err: Error | undefined, stream: Record<string, unknown>) => {
          if (err) {
            webLogger.error(`install-ssh-key: exec error: ${err.message}`);
            client.end();
            reject(err);
            return;
          }

          let stderr = '';

          // Consume stdout to prevent backpressure from blocking the stream
          (stream as { resume: () => void }).resume();

          const stderrStream = stream.stderr as { on: (event: string, listener: (data: Buffer) => void) => void };
          stderrStream.on('data', (data: Buffer) => {
            stderr += data.toString('utf8');
          });

          // Use 'exit' instead of 'close' — fires immediately when process exits
          const streamEvents = stream as { on: (event: string, listener: (code: number | null) => void) => void };
          streamEvents.on('exit', (code: number | null) => {
            client.end();
            if (code !== 0) {
              webLogger.error(`install-ssh-key: command failed (exit ${code}): ${stderr.trim()}`);
              reject(new Error(`Failed to install key (exit ${code}): ${stderr.trim()}`));
            } else {
              webLogger.info('install-ssh-key: key installed successfully');
              resolve();
            }
          });
        }) as never);
      });

      client.on('error', (err: Error) => {
        clearTimeout(timeout);
        webLogger.error(`install-ssh-key: connection error: ${err.message}`);
        reject(err);
      });

      // Handle keyboard-interactive auth (many servers use this instead of password)
      client.on(
        'keyboard-interactive',
        (_name: string, _instructions: string, _lang: string, prompts: Array<{ prompt: string }>, finish: (responses: string[]) => void) => {
          webLogger.info(`install-ssh-key: keyboard-interactive auth (${prompts.length} prompt(s))`);
          finish(prompts.map(() => password));
        },
      );

      // Track which auth methods we've tried
      let authAttempt = 0;
      const authMethods = ['password', 'keyboard-interactive'] as const;

      client.connect({
        host: host.hostname,
        port: host.port,
        username: host.username,
        password,
        tryKeyboard: true,
        readyTimeout: 10_000,
        authHandler: (methodsLeft: string[], _partialSuccess: boolean, callback: (config: Record<string, unknown> | false) => void) => {
          webLogger.info(`install-ssh-key: authHandler called, attempt=${authAttempt}, serverMethods=${JSON.stringify(methodsLeft)}`);

          if (authAttempt >= authMethods.length) {
            callback(false); // no more methods to try
            return;
          }

          const method = authMethods[authAttempt]!;
          authAttempt++;

          if (method === 'password') {
            callback({ type: 'password', username: host.username, password });
          } else {
            callback({ type: 'keyboard-interactive', username: host.username, prompt: () => [password] });
          }
        },
        debug: (msg: string) => webLogger.debug(`install-ssh-key: ssh2: ${msg}`),
      } as Record<string, unknown>);
    });

    // Verify: reconnect using the key (not the password) to prove it works
    webLogger.info('install-ssh-key: verifying key-based auth');

    const verifyClient = new Client();
    await new Promise<void>((resolve, reject) => {
      const verifyTimeout = setTimeout(() => {
        verifyClient.end();
        reject(new Error('Key verification timed out (10s)'));
      }, 10_000);

      verifyClient.on('ready', () => {
        clearTimeout(verifyTimeout);
        webLogger.info('install-ssh-key: key-based auth verified');
        verifyClient.end();
        resolve();
      });

      verifyClient.on('error', (verifyErr: Error) => {
        clearTimeout(verifyTimeout);
        webLogger.error(`install-ssh-key: key verification failed: ${verifyErr.message}`);
        reject(new Error(`Key was installed but verification failed: ${verifyErr.message}`));
      });

      webLogger.debug(`install-ssh-key: key format starts with: ${privateKey.substring(0, 40)}`);
      verifyClient.connect({
        host: host.hostname,
        port: host.port,
        username: host.username,
        privateKey: Buffer.from(privateKey),
        readyTimeout: 10_000,
      });
    });

    // Verified — encrypt and store the private key, update auth method
    const encryptedKey = encryptValue(privateKey, encryptionKey);

    await prisma.sshHost.update({
      where: { id: host.id },
      data: {
        privateKey: encryptedKey,
        authMethod: 'key',
        lastSeenAt: new Date(),
      },
    });

    revalidatePath('/admin/ssh-hosts');
    return { success: true, publicKey };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('authentication')) {
      return { error: 'Authentication failed — check the password' };
    }
    return { error: `Failed to install key: ${message}` };
  }
};
