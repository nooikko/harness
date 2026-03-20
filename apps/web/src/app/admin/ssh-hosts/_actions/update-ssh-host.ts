'use server';

import { prisma } from '@harness/database';
import { encryptValue } from '@harness/plugin-contract';
import { revalidatePath } from 'next/cache';
import { loadEnv } from '@/app/_helpers/env';
import { logServerError } from '@/lib/log-server-error';

type UpdateSshHostInput = {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  authMethod: string;
  privateKey?: string;
  tags: string[];
};

type UpdateSshHostResult = { success: true } | { error: string };

type UpdateSshHost = (input: UpdateSshHostInput) => Promise<UpdateSshHostResult>;

export const updateSshHost: UpdateSshHost = async (input) => {
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

  const data: Record<string, unknown> = {
    name: input.name.trim(),
    hostname: input.hostname.trim(),
    port: input.port,
    username: input.username.trim(),
    authMethod: input.authMethod,
    tags: input.tags,
  };

  // Only update privateKey if a non-empty value is provided
  if (input.privateKey?.trim()) {
    const encryptionKey = loadEnv().HARNESS_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return { error: 'Cannot store private key: HARNESS_ENCRYPTION_KEY is not configured' };
    }
    try {
      data.privateKey = encryptValue(input.privateKey, encryptionKey);
    } catch {
      return { error: 'Failed to encrypt private key — check HARNESS_ENCRYPTION_KEY format' };
    }
  }

  try {
    await prisma.sshHost.update({
      where: { id: input.id },
      data,
    });
    revalidatePath('/admin/ssh-hosts');
    return { success: true };
  } catch (err) {
    logServerError({ action: 'updateSshHost', error: err, context: { id: input.id } });
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { error: `An SSH host named "${input.name}" already exists` };
    }
    return { error: 'Failed to update SSH host' };
  }
};
