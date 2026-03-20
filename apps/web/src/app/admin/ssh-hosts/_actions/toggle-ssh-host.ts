'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type ToggleSshHost = (id: string) => Promise<void>;

export const toggleSshHost: ToggleSshHost = async (id) => {
  const host = await prisma.sshHost.findUniqueOrThrow({ where: { id } });
  await prisma.sshHost.update({
    where: { id },
    data: { enabled: !host.enabled },
  });
  revalidatePath('/admin/ssh-hosts');
};
