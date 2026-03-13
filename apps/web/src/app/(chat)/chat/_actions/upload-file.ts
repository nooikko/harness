'use server';

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { File as DbFile, FileScope } from '@harness/database';
import { prisma } from '@harness/database';
import { createId } from '@paralleldrive/cuid2';
import { revalidatePath } from 'next/cache';
import { loadEnv } from '@/app/_helpers/env';
import { notifyOrchestrator } from '@/app/_helpers/notify-orchestrator';

const ALLOWED_MIME_PREFIXES = ['text/'];
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'application/xml',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const SCOPE_FOLDERS: Record<FileScope, string> = {
  PROJECT: 'projects',
  THREAD: 'threads',
  DECORATIVE: 'agents',
};

type SanitizeFilename = (name: string) => string;

const sanitizeFilename: SanitizeFilename = (name) => {
  return name
    .replace(/[^\w.-]/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 200);
};

type IsAllowedMimeType = (mimeType: string) => boolean;

const isAllowedMimeType: IsAllowedMimeType = (mimeType) => {
  if (ALLOWED_MIME_TYPES.has(mimeType)) {
    return true;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
};

export type UploadFileInput = {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  scope: FileScope;
  projectId?: string;
  threadId?: string;
  agentId?: string;
};

type UploadFileResult = { file: DbFile } | { error: string };
type UploadFile = (input: UploadFileInput) => Promise<UploadFileResult>;

export const uploadFile: UploadFile = async (input) => {
  const { fileBuffer, fileName, mimeType, scope, projectId, threadId, agentId } = input;
  const env = loadEnv();
  const maxSizeBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;

  const broadcastFailure = (error: string) => {
    void notifyOrchestrator('file:upload-failed', { name: fileName, error, scope, projectId, threadId });
  };

  // Validate size
  if (fileBuffer.byteLength > maxSizeBytes) {
    const error = `File exceeds maximum size of ${env.MAX_FILE_SIZE_MB}MB`;
    broadcastFailure(error);
    return { error };
  }

  // Validate MIME type
  if (!isAllowedMimeType(mimeType)) {
    const error = `File type '${mimeType}' is not allowed`;
    broadcastFailure(error);
    return { error };
  }

  // Validate scope/FK consistency
  if (scope === 'PROJECT' && !projectId) {
    return { error: 'projectId is required for PROJECT scope' };
  }
  if (scope === 'THREAD' && !threadId) {
    return { error: 'threadId is required for THREAD scope' };
  }
  if (scope === 'DECORATIVE' && !agentId) {
    return { error: 'agentId is required for DECORATIVE scope' };
  }

  const fileId = createId();
  const sanitized = sanitizeFilename(fileName);
  const parentId = scope === 'PROJECT' ? projectId! : scope === 'THREAD' ? threadId! : agentId!;
  const relativePath = join(SCOPE_FOLDERS[scope], parentId, `${fileId}-${sanitized}`);
  const fullPath = join(env.UPLOAD_DIR, relativePath);

  // Write to disk
  try {
    await mkdir(join(env.UPLOAD_DIR, SCOPE_FOLDERS[scope], parentId), { recursive: true });
    await writeFile(fullPath, fileBuffer);
  } catch (err) {
    return { error: `Disk write failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Insert DB record
  let file: DbFile;
  try {
    file = await prisma.file.create({
      data: {
        id: fileId,
        name: fileName,
        path: relativePath,
        mimeType,
        size: fileBuffer.byteLength,
        scope,
        projectId: scope === 'PROJECT' ? projectId : null,
        threadId: scope === 'THREAD' ? threadId : null,
        agentId: scope === 'DECORATIVE' ? agentId : null,
      },
    });
  } catch (err) {
    // Clean up disk file on DB failure
    try {
      await unlink(fullPath);
    } catch {
      /* best effort */
    }
    return { error: `Database error: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath('/');

  void notifyOrchestrator('file:uploaded', {
    fileId: file.id,
    name: file.name,
    scope: file.scope,
    projectId: file.projectId,
    threadId: file.threadId,
    agentId: file.agentId,
    mimeType: file.mimeType,
    size: file.size,
  });

  return { file };
};
