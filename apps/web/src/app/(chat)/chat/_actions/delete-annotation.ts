'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type DeleteAnnotationResult = { success: true } | { error: string };

type DeleteAnnotation = (messageId: string) => Promise<DeleteAnnotationResult>;

export const deleteAnnotation: DeleteAnnotation = async (messageId) => {
  try {
    await prisma.messageAnnotation.delete({ where: { messageId } });
    revalidatePath('/chat');
    return { success: true };
  } catch {
    return { error: 'Failed to delete annotation' };
  }
};
