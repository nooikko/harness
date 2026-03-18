import { join } from 'node:path';
import type { FileScope, PrismaClient } from '@harness/database';

export const MAX_FILE_REFERENCES = 50;

export type FileReference = {
  name: string;
  mimeType: string;
  size: number;
  fullPath: string;
  scope: FileScope;
};

export type FileReferenceResult = {
  files: FileReference[];
  truncated: boolean;
};

type LoadFileReferences = (db: PrismaClient, uploadDir: string, threadId: string, projectId: string | null) => Promise<FileReferenceResult>;

export const loadFileReferences: LoadFileReferences = async (db, uploadDir, threadId, projectId) => {
  const conditions: Array<{ threadId?: string; projectId?: string; scope: FileScope }> = [{ threadId, scope: 'THREAD' }];

  if (projectId) {
    conditions.push({ projectId, scope: 'PROJECT' });
  }

  // Query newest-first so truncation drops the oldest (least relevant) files
  const files = await db.file.findMany({
    where: { OR: conditions },
    orderBy: { createdAt: 'desc' },
    take: MAX_FILE_REFERENCES + 1,
    select: { name: true, mimeType: true, size: true, path: true, scope: true },
  });

  const truncated = files.length > MAX_FILE_REFERENCES;
  // Slice to limit, then reverse to chronological (oldest-first) for stable prompt ordering
  const sliced = truncated ? files.slice(0, MAX_FILE_REFERENCES).reverse() : files.reverse();

  return {
    files: sliced.map((f) => ({
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      fullPath: join(uploadDir, f.path),
      scope: f.scope,
    })),
    truncated,
  };
};
