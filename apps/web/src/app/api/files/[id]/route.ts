import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@harness/database';
import { NextResponse } from 'next/server';
import { loadEnv } from '@/app/_helpers/env';

type RouteParams = { params: Promise<{ id: string }> };

export const GET = async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const env = loadEnv();

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fullPath = join(env.UPLOAD_DIR, file.path);

  try {
    await stat(fullPath);
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  const buffer = await readFile(fullPath);

  return new Response(buffer, {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${file.name}"`,
      'Content-Length': String(file.size),
      'Cache-Control': 'private, max-age=3600',
    },
  });
};
