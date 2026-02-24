'use server';

import { prisma } from 'database';
import { revalidatePath } from 'next/cache';

type TogglePlugin = (id: string) => Promise<void>;

export const togglePlugin: TogglePlugin = async (id) => {
  const plugin = await prisma.pluginConfig.findUniqueOrThrow({
    where: { id },
  });
  await prisma.pluginConfig.update({
    where: { id },
    data: { enabled: !plugin.enabled },
  });
  revalidatePath('/admin/plugins');
};
