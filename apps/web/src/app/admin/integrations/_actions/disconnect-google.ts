'use server';

import { prisma } from '@harness/database';
import { revokeToken } from '@harness/oauth';
import { revalidatePath } from 'next/cache';

type DisconnectGoogle = (accountId: string) => Promise<void>;

export const disconnectGoogle: DisconnectGoogle = async (accountId) => {
  await revokeToken('google', accountId, prisma);

  // Clean up Google calendar sync states
  await prisma.calendarSyncState.deleteMany({
    where: { calendarId: { startsWith: 'google:' } },
  });

  // Clean up Google calendar events
  await prisma.calendarEvent.deleteMany({
    where: { source: 'GOOGLE' },
  });

  revalidatePath('/admin/integrations');
};
