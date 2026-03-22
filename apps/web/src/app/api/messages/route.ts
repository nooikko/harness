import { prisma } from '@harness/database';
import { NextResponse } from 'next/server';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('threadId');
  const limit = Number(searchParams.get('limit') ?? '50');

  if (!threadId) {
    return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
  }

  const messages = await prisma.message.findMany({
    where: { threadId },
    select: {
      id: true,
      role: true,
      content: true,
      kind: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      kind: m.kind,
      createdAt: m.createdAt.toISOString(),
    })),
  });
};
