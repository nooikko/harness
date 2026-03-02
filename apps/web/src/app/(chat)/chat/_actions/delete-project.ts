'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type DeleteProject = (projectId: string) => Promise<void>;

export const deleteProject: DeleteProject = async (projectId) => {
  await prisma.$transaction([
    prisma.thread.updateMany({
      where: { projectId },
      data: { projectId: null },
    }),
    prisma.project.delete({
      where: { id: projectId },
    }),
  ]);

  revalidatePath('/chat');
};
