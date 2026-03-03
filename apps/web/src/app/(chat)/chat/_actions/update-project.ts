'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateProjectFields = {
  name?: string;
  description?: string;
  instructions?: string;
  model?: string | null;
};

type UpdateProject = (
  projectId: string,
  fields: UpdateProjectFields,
) => Promise<{
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  model: string | null;
}>;

export const updateProject: UpdateProject = async (projectId, fields) => {
  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: fields.name,
        description: fields.description,
        instructions: fields.instructions,
        model: fields.model,
      },
    });

    revalidatePath('/chat');

    return project;
  } catch (error) {
    throw new Error(`Failed to update project: ${error instanceof Error ? error.message : String(error)}`);
  }
};
