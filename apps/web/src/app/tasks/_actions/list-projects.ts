'use server';

import { prisma } from '@harness/database';

type ProjectOption = {
  id: string;
  name: string;
};

type ListProjects = () => Promise<ProjectOption[]>;

export const listProjects: ListProjects = async () => {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return projects;
};
