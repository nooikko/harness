import { open, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@harness/database';
import { NextResponse } from 'next/server';
import { loadEnv } from '@/app/_helpers/env';

type RouteParams = { params: Promise<{ id: string }> };

export const GET = async (request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const env = loadEnv();

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fullPath = join(env.UPLOAD_DIR, file.path);

  let fileSize: number;
  try {
    const fileStat = await stat(fullPath);
    fileSize = fileStat.size;
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  const safeName = file.name.replace(/[^\w.\-\s]/g, '_');
  const encodedName = encodeURIComponent(file.name);
  const commonHeaders: Record<string, string> = {
    'Content-Type': file.mimeType,
    'Content-Disposition': `inline; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  };

  // Handle range requests (required for video seeking)
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
    if (match) {
      const start = Number.parseInt(match[1]!, 10);
      const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      // Positional read — only reads the requested byte range, not the entire file
      const length = end - start + 1;
      const slice = Buffer.allocUnsafe(length);
      const fh = await open(fullPath);
      try {
        await fh.read(slice, 0, length, start);
      } finally {
        await fh.close();
      }

      return new Response(slice, {
        status: 206,
        headers: {
          ...commonHeaders,
          'Content-Length': String(length),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        },
      });
    }
  }

  // Full file response
  const buffer = await readFile(fullPath);
  return new Response(buffer, {
    headers: {
      ...commonHeaders,
      'Content-Length': String(fileSize),
    },
  });
};
