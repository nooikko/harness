import type { FileScope } from '@harness/database';
import { prisma } from '@harness/database';
import { NextResponse } from 'next/server';
import { uploadFile } from '@/app/(chat)/chat/_actions/upload-file';

export const POST = async (request: Request) => {
  const formData = await request.formData();
  const file = formData.get('file');
  const threadId = formData.get('threadId');
  const scope = (formData.get('scope') as FileScope | null) ?? 'THREAD';
  const messageId = formData.get('messageId') as string | null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (typeof threadId !== 'string' || !threadId) {
    return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
  }

  // Verify thread exists before accepting upload
  const thread = await prisma.thread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadFile({
    fileBuffer: buffer,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    scope,
    threadId: scope === 'THREAD' ? threadId : undefined,
    messageId: messageId ?? undefined,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.file);
};
