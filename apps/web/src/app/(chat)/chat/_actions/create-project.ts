'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type CreateProjectOptions = {
  name: string;
  description?: string;
  instructions?: string;
  model?: string;
};

type CreateProject = (options: CreateProjectOptions) => Promise<{
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  model: string | null;
}>;

export const createProject: CreateProject = async (options) => {
  const project = await prisma.project.create({
    data: {
      name: options.name,
      description: options.description,
      instructions: options.instructions,
      model: options.model,
    },
  });

  revalidatePath('/chat');

  return project;
};
