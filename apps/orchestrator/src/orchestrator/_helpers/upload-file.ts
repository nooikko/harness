import crypto from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';
import type { UploadFileInput, UploadFileResult } from '@harness/plugin-contract';

const SCOPE_FOLDERS: Record<string, string> = {
  PROJECT: 'projects',
  THREAD: 'threads',
  DECORATIVE: 'agents',
};

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'application/xml',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/webm',
  'video/mp4',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/x-python',
  'text/x-c',
  'text/x-java-source',
  'text/x-go',
  'text/x-rustsrc',
  'text/x-shellscript',
  'text/x-yaml',
  'text/x-toml',
  'text/x-sql',
]);

type SanitizeFilename = (name: string) => string;

const sanitizeFilename: SanitizeFilename = (name) => {
  return name
    .replace(/[^\w.-]/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 200);
};

type CreateUploadFile = (deps: {
  db: PrismaClient;
  uploadDir: string;
  logger: Logger;
  broadcast: (event: string, data: unknown) => Promise<void>;
}) => (input: UploadFileInput) => Promise<UploadFileResult>;

export const createUploadFile: CreateUploadFile = (deps) => {
  return async (input) => {
    const { filename, buffer, mimeType, scope, threadId, projectId, agentId, messageId } = input;

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`File type '${mimeType}' is not allowed`);
    }

    // Validate scope/FK consistency
    if (scope === 'PROJECT' && !projectId) {
      throw new Error('projectId is required for PROJECT scope');
    }
    if (scope === 'THREAD' && !threadId) {
      throw new Error('threadId is required for THREAD scope');
    }
    if (scope === 'DECORATIVE' && !agentId) {
      throw new Error('agentId is required for DECORATIVE scope');
    }

    const fileId = crypto.randomUUID();
    const sanitized = sanitizeFilename(filename);
    const scopeFolder = SCOPE_FOLDERS[scope] ?? 'threads';
    const parentId = scope === 'PROJECT' ? projectId! : scope === 'THREAD' ? threadId! : agentId!;
    const relativePath = join(scopeFolder, parentId, `${fileId}-${sanitized}`);
    const fullPath = join(deps.uploadDir, relativePath);

    // Write to disk
    try {
      await mkdir(join(deps.uploadDir, scopeFolder, parentId), { recursive: true });
      await writeFile(fullPath, buffer);
    } catch (err) {
      deps.logger.error(`uploadFile: disk write failed [file=${filename}, scope=${scope}]: ${err instanceof Error ? err.message : String(err)}`);
      throw new Error(`Disk write failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Insert DB record
    try {
      await deps.db.file.create({
        data: {
          id: fileId,
          name: filename,
          path: relativePath,
          mimeType,
          size: buffer.byteLength,
          scope,
          projectId: scope === 'PROJECT' ? projectId : null,
          threadId: scope === 'THREAD' ? threadId : null,
          agentId: scope === 'DECORATIVE' ? agentId : null,
          messageId: messageId ?? null,
        },
      });
    } catch (err) {
      deps.logger.error(`uploadFile: DB insert failed [file=${filename}, fileId=${fileId}]: ${err instanceof Error ? err.message : String(err)}`);
      // Clean up disk file on DB failure
      try {
        await unlink(fullPath);
      } catch {
        /* best effort */
      }
      throw new Error(`Database error: ${err instanceof Error ? err.message : String(err)}`);
    }

    void deps.broadcast('file:uploaded', {
      fileId,
      name: filename,
      scope,
      projectId: scope === 'PROJECT' ? projectId : null,
      threadId: scope === 'THREAD' ? threadId : null,
      agentId: scope === 'DECORATIVE' ? agentId : null,
      mimeType,
      size: buffer.byteLength,
    });

    return { fileId, relativePath };
  };
};
