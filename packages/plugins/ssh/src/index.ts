// SSH plugin — remote command execution via SSH connections
// Tools-only plugin: exec, list_hosts, add_host, remove_host, test_connection

import { createHash } from 'node:crypto';
import type { PluginContext, PluginDefinition, PluginHooks, PluginTool } from '@harness/plugin-contract';
import { createConnectionPool } from './_helpers/connection-pool';
import { executeCommand } from './_helpers/execute-command';
import { logCommand } from './_helpers/log-command';
import { resolveHost } from './_helpers/resolve-host';
import { settingsSchema } from './_helpers/settings-schema';
import { loadSshEnv } from './env';

type SshSettings = {
  defaultTimeout?: number;
  maxOutputLength?: number;
  logCommands?: boolean;
  maxConcurrentPerHost?: number;
  maxPoolConnections?: number;
};

type ClassifyError = (err: unknown) => string;

const classifyError: ClassifyError = (err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('authentication') || message.includes('auth')) {
    return `[AUTH_FAILED] ${message}`;
  }
  if (message.includes('timed out') || message.includes('timeout')) {
    return `[TIMEOUT] ${message}`;
  }
  if (message.includes('ECONNREFUSED') || message.includes('EHOSTUNREACH') || message.includes('ENOTFOUND')) {
    return `[CONNECTION_FAILED] ${message}`;
  }
  if (message.includes('Host key')) {
    return `[HOST_KEY_CHANGED] ${message}. Update the fingerprint in admin UI at /admin/ssh-hosts.`;
  }
  return `[ERROR] ${message}`;
};

// Closure state shared between register/start/stop and tool handlers
let pool: ReturnType<typeof createConnectionPool> | null = null;
let settings: SshSettings = {};
let encryptionKey: string | undefined;

type FormatExecResult = (result: { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }) => string;

const formatExecResult: FormatExecResult = (result) => {
  const parts: string[] = [];

  if (result.timedOut) {
    parts.push('[TIMED OUT]');
  }

  parts.push(`Exit code: ${result.exitCode ?? 'unknown'}`);

  if (result.stdout) {
    parts.push(`\nSTDOUT:\n${result.stdout}`);
  }

  if (result.stderr) {
    parts.push(`\nSTDERR:\n${result.stderr}`);
  }

  return parts.join('\n');
};

type BuildConnectConfig = (host: {
  hostname: string;
  port: number;
  username: string;
  privateKey: string | null;
  fingerprint: string | null;
}) => Record<string, unknown>;

const buildConnectConfig: BuildConnectConfig = (host) => {
  const config: Record<string, unknown> = {
    host: host.hostname,
    port: host.port,
    username: host.username,
  };

  if (host.privateKey) {
    config.privateKey = host.privateKey;
  }

  if (host.fingerprint) {
    config.hostVerifier = (key: Buffer) => {
      const hash = createHash('sha256').update(key).digest('base64');
      return hash === host.fingerprint;
    };
  }

  return config;
};

const tools: PluginTool[] = [
  {
    name: 'exec',
    audience: 'agent',
    description:
      'Execute a command on a remote SSH host. Returns stdout, stderr, and exit code. Commands must be non-interactive (no prompts for input). Use sudo -n for passwordless sudo.',
    schema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Name or ID of the SSH host to connect to.',
        },
        command: {
          type: 'string',
          description: 'The shell command to execute on the remote host.',
        },
        timeout: {
          type: 'number',
          description: "Timeout in seconds. Defaults to the plugin's configured default.",
        },
      },
      required: ['host', 'command'],
    },
    handler: async (ctx, input, meta) => {
      try {
        const hostName = input.host as string;
        const command = input.command as string;
        const MAX_TIMEOUT_SEC = 300;
        const timeoutSec = Math.min((input.timeout as number | undefined) ?? settings.defaultTimeout ?? 30, MAX_TIMEOUT_SEC);

        const host = await resolveHost({
          db: ctx.db,
          nameOrId: hostName,
          encryptionKey,
        });

        if (!pool) {
          return 'Error: SSH plugin not initialized';
        }

        const client = await pool.getConnection(host.id, buildConnectConfig(host) as import('ssh2').ConnectConfig);
        try {
          const startTime = Date.now();
          const result = await executeCommand({
            client,
            command,
            timeoutMs: timeoutSec * 1000,
            maxOutputLength: settings.maxOutputLength ?? 50000,
          });
          const duration = Date.now() - startTime;

          if (settings.logCommands ?? true) {
            // Resolve agentId from thread
            const thread = await ctx.db.thread.findUnique({
              where: { id: meta.threadId },
              select: { agentId: true },
            });
            logCommand(
              ctx.db,
              {
                hostId: host.id,
                command,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                duration,
                threadId: meta.threadId,
                agentId: thread?.agentId ?? undefined,
              },
              ctx.logger,
            );
          }

          return formatExecResult(result);
        } finally {
          pool.release(host.id);
        }
      } catch (err) {
        return classifyError(err);
      }
    },
  },
  {
    name: 'list_hosts',
    audience: 'agent',
    description: 'List registered SSH hosts. Optionally filter by tag.',
    schema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Filter hosts by this tag.',
        },
      },
    },
    handler: async (ctx, input) => {
      try {
        const tag = input.tag as string | undefined;
        const hosts = await ctx.db.sshHost.findMany({
          where: { enabled: true },
          select: {
            name: true,
            hostname: true,
            port: true,
            enabled: true,
            lastSeenAt: true,
            tags: true,
          },
          orderBy: { name: 'asc' },
        });

        const filtered = tag ? hosts.filter((h) => h.tags.includes(tag)) : hosts;

        if (filtered.length === 0) {
          return tag ? `No SSH hosts found with tag "${tag}".` : 'No SSH hosts registered.';
        }

        const lines = filtered.map((h) => {
          const lastSeen = h.lastSeenAt ? h.lastSeenAt.toISOString() : 'never';
          const tagStr = h.tags.length > 0 ? ` [${h.tags.join(', ')}]` : '';
          return `- ${h.name}: ${h.hostname}:${h.port} (last seen: ${lastSeen})${tagStr}`;
        });

        return lines.join('\n');
      } catch (err) {
        return classifyError(err);
      }
    },
  },
  {
    name: 'add_host',
    audience: 'agent',
    description: 'Register a new SSH host. Keys must be configured separately via admin UI.',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique name for this host.',
        },
        hostname: {
          type: 'string',
          description: 'Hostname or IP address.',
        },
        port: {
          type: 'number',
          description: 'SSH port. Defaults to 22.',
        },
        username: {
          type: 'string',
          description: 'SSH username.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for categorizing the host.',
        },
      },
      required: ['name', 'hostname', 'username'],
    },
    handler: async (ctx, input) => {
      try {
        const name = input.name as string;
        const hostname = input.hostname as string;
        const port = (input.port as number | undefined) ?? 22;
        const username = input.username as string;
        const tags = (input.tags as string[] | undefined) ?? [];

        const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
        if (!hostnameRegex.test(hostname)) {
          return 'Invalid hostname format. Use an IP address or domain name (e.g., 192.168.1.1 or server.local).';
        }
        if (port < 1 || port > 65535) {
          return 'Port must be between 1 and 65535.';
        }

        const existing = await ctx.db.sshHost.findUnique({ where: { name } });
        if (existing) {
          return `SSH host "${name}" already exists. Use a different name.`;
        }

        await ctx.db.sshHost.create({
          data: {
            name,
            hostname,
            port,
            username,
            tags,
          },
        });

        return `SSH host "${name}" registered (${username}@${hostname}:${port}). Configure authentication via admin UI.`;
      } catch (err) {
        return classifyError(err);
      }
    },
  },
  {
    name: 'remove_host',
    audience: 'agent',
    description: 'Remove a registered SSH host by name.',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the SSH host to remove.',
        },
      },
      required: ['name'],
    },
    handler: async (ctx, input) => {
      try {
        const name = input.name as string;

        const host = await ctx.db.sshHost.findUnique({
          where: { name },
        });

        if (!host) {
          return `SSH host not found: ${name}`;
        }

        await ctx.db.sshHost.delete({ where: { id: host.id } });

        return `SSH host "${name}" removed.`;
      } catch (err) {
        return classifyError(err);
      }
    },
  },
  {
    name: 'test_connection',
    audience: 'agent',
    description: 'Test SSH connectivity to a host. Updates lastSeenAt on success and saves fingerprint on first connection (TOFU).',
    schema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Name or ID of the SSH host to test.',
        },
      },
      required: ['host'],
    },
    handler: async (ctx, input) => {
      try {
        const hostName = input.host as string;

        const host = await resolveHost({
          db: ctx.db,
          nameOrId: hostName,
          encryptionKey,
        });

        if (!pool) {
          return 'Error: SSH plugin not initialized';
        }

        // Evict any cached connection so we get a fresh handshake with hostVerifier
        pool.evict(host.id);

        // Build config with TOFU fingerprint handling
        const config: Record<string, unknown> = {
          host: host.hostname,
          port: host.port,
          username: host.username,
        };

        if (host.privateKey) {
          config.privateKey = host.privateKey;
        }

        // Capture the host key fingerprint during connection
        let capturedFingerprint: string | null = null;

        config.hostVerifier = (key: Buffer) => {
          const hash = createHash('sha256').update(key).digest('base64');
          capturedFingerprint = hash;

          // If we have a stored fingerprint, verify it
          if (host.fingerprint) {
            return hash === host.fingerprint;
          }

          // TOFU: accept on first connection
          return true;
        };

        const client = await pool.getConnection(host.id, config as import('ssh2').ConnectConfig);
        try {
          // Update lastSeenAt
          const updateData: Record<string, unknown> = {
            lastSeenAt: new Date(),
          };

          // TOFU: save fingerprint on first connection
          if (!host.fingerprint && capturedFingerprint) {
            updateData.fingerprint = capturedFingerprint;
          }

          await ctx.db.sshHost.update({
            where: { id: host.id },
            data: updateData,
          });

          // Verify the connection works by running a simple command
          const result = await executeCommand({
            client,
            command: 'echo ok',
            timeoutMs: 10_000,
            maxOutputLength: 1000,
          });

          const fingerprintStatus = !host.fingerprint && capturedFingerprint ? ` Fingerprint saved (TOFU): ${capturedFingerprint}` : '';

          return `Connection to "${host.name}" successful (exit code: ${result.exitCode}).${fingerprintStatus}`;
        } finally {
          pool.release(host.id);
        }
      } catch (err) {
        return classifyError(err);
      }
    },
  },
];

export const plugin: PluginDefinition = {
  name: 'ssh',
  version: '1.0.0',
  settingsSchema,
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    const env = loadSshEnv();
    encryptionKey = env.encryptionKey;
    if (!encryptionKey) {
      ctx.reportStatus('degraded', 'HARNESS_ENCRYPTION_KEY not set — cannot store SSH keys securely');
    }

    settings = await ctx.getSettings(settingsSchema);
    pool = createConnectionPool({
      maxConnections: settings.maxPoolConnections ?? 20,
      logger: {
        debug: (msg: string) => ctx.logger.debug(msg),
        warn: (msg: string) => ctx.logger.warn(msg),
      },
    });

    ctx.logger.info('SSH plugin registered');

    return {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName === 'ssh') {
          settings = await ctx.getSettings(settingsSchema);
          ctx.logger.info('SSH plugin: settings reloaded');
        }
      },
    };
  },
  start: async (ctx: PluginContext): Promise<void> => {
    ctx.logger.info('SSH plugin started');
  },
  stop: async (ctx: PluginContext): Promise<void> => {
    if (pool) {
      pool.releaseAll();
      pool = null;
    }
    ctx.logger.info('SSH plugin stopped');
  },
  tools,
};
