import { join } from 'node:path';
import type { FileScope, PrismaClient } from '@harness/database';

export type FileReference = {
  name: string;
  mimeType: string;
  size: number;
  fullPath: string;
  scope: FileScope;
};

type LoadFileReferences = (db: PrismaClient, uploadDir: string, threadId: string, projectId: string | null) => Promise<FileReference[]>;

export const loadFileReferences: LoadFileReferences = async (db, uploadDir, threadId, projectId) => {
  const conditions: Array<{ threadId?: string; projectId?: string; scope: FileScope }> = [{ threadId, scope: 'THREAD' }];

  if (projectId) {
    conditions.push({ projectId, scope: 'PROJECT' });
  }

  const files = await db.file.findMany({
    where: { OR: conditions },
    orderBy: { createdAt: 'asc' },
    select: { name: true, mimeType: true, size: true, path: true, scope: true },
  });

  return files.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    fullPath: join(uploadDir, f.path),
    scope: f.scope,
  }));
};
