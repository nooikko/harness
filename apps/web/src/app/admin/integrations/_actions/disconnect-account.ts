'use server';

import { prisma } from '@harness/database';
import { revokeToken } from '@harness/oauth';
import { revalidatePath } from 'next/cache';

type DisconnectAccount = (provider: string, accountId: string) => Promise<void>;

export const disconnectAccount: DisconnectAccount = async (provider, accountId) => {
  await revokeToken(provider, accountId, prisma);
  revalidatePath('/admin/integrations');
};
