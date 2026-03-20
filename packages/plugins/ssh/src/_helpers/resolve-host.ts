import type { PrismaClient } from '@harness/database';
import { decryptValue } from '@harness/plugin-contract';

type ResolvedHost = {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  authMethod: string;
  privateKey: string | null;
  fingerprint: string | null;
  enabled: boolean;
};

type ResolveHostParams = {
  db: PrismaClient;
  nameOrId: string;
  encryptionKey: string | undefined;
};

type ResolveHost = (params: ResolveHostParams) => Promise<ResolvedHost>;

export const resolveHost: ResolveHost = async ({ db, nameOrId, encryptionKey }) => {
  const host = (await db.sshHost.findUnique({ where: { name: nameOrId } })) ?? (await db.sshHost.findUnique({ where: { id: nameOrId } }));

  if (!host) {
    throw new Error(`SSH host "${nameOrId}" not found. Use ssh__list_hosts to see registered hosts.`);
  }

  if (!host.enabled) {
    throw new Error(`SSH host "${host.name}" is disabled. Enable it in the admin UI at /admin/ssh-hosts.`);
  }

  let decryptedKey: string | null = null;
  if (host.privateKey && encryptionKey) {
    decryptedKey = decryptValue(host.privateKey, encryptionKey);
  } else if (host.privateKey && !encryptionKey) {
    throw new Error(`Cannot decrypt private key for "${host.name}": HARNESS_ENCRYPTION_KEY is not set. Configure it in your .env file.`);
  }

  return {
    id: host.id,
    name: host.name,
    hostname: host.hostname,
    port: host.port,
    username: host.username,
    authMethod: host.authMethod,
    privateKey: decryptedKey,
    fingerprint: host.fingerprint,
    enabled: host.enabled,
  };
};
