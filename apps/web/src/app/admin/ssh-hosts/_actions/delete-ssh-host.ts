'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type DeleteSshHostResult = { success: true } | { error: string };

type DeleteSshHost = (id: string) => Promise<DeleteSshHostResult>;

export const deleteSshHost: DeleteSshHost = async (id) => {
  try {
    await prisma.sshHost.delete({ where: { id } });
    revalidatePath('/admin/ssh-hosts');
    return { success: true };
  } catch (err) {
    logServerError({ action: 'deleteSshHost', error: err, context: { id } });
    return { error: 'Failed to delete SSH host' };
  }
};
