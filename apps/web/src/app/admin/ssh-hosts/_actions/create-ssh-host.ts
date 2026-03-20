'use server';

import { prisma } from '@harness/database';
import { encryptValue } from '@harness/plugin-contract';
import { revalidatePath } from 'next/cache';
import { loadEnv } from '@/app/_helpers/env';
import { logServerError } from '@/lib/log-server-error';

type CreateSshHostInput = {
  name: string;
  hostname: string;
  port: number;
  username: string;
  authMethod: string;
  privateKey?: string;
  tags: string[];
};

type CreateSshHostResult = { success: true; id: string } | { error: string };

type CreateSshHost = (input: CreateSshHostInput) => Promise<CreateSshHostResult>;

export const createSshHost: CreateSshHost = async (input) => {
  if (!input.name?.trim()) {
    return { error: 'Name is required' };
  }
  if (!input.hostname?.trim()) {
    return { error: 'Hostname is required' };
  }
  if (!input.username?.trim()) {
    return { error: 'Username is required' };
  }
  if (input.port < 1 || input.port > 65535) {
    return { error: 'Port must be between 1 and 65535' };
  }

  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
  if (!hostnameRegex.test(input.hostname.trim())) {
    return { error: 'Invalid hostname format. Use an IP address or domain name.' };
  }

  let privateKey: string | undefined = input.privateKey ?? undefined;

  if (privateKey) {
    const encryptionKey = loadEnv().HARNESS_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return { error: 'Cannot store private key: HARNESS_ENCRYPTION_KEY is not configured' };
    }
    try {
      privateKey = encryptValue(privateKey, encryptionKey);
    } catch {
      return { error: 'Failed to encrypt private key — check HARNESS_ENCRYPTION_KEY format' };
    }
  }

  try {
    const host = await prisma.sshHost.create({
      data: {
        name: input.name.trim(),
        hostname: input.hostname.trim(),
        port: input.port,
        username: input.username.trim(),
        authMethod: input.authMethod,
        privateKey: privateKey ?? null,
        tags: input.tags,
        enabled: true,
      },
    });
    revalidatePath('/admin/ssh-hosts');
    return { success: true, id: host.id };
  } catch (err) {
    logServerError({ action: 'createSshHost', error: err, context: { name: input.name } });
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { error: `An SSH host named "${input.name}" already exists` };
    }
    return { error: 'Failed to create SSH host' };
  }
};
