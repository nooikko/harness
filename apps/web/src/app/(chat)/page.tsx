import { prisma } from 'database';
import { MessageSquare } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type ChatIndexPageComponent = () => Promise<React.ReactNode>;

const ChatIndexPage: ChatIndexPageComponent = async () => {
  const primaryThread = await prisma.thread.findFirst({
    where: { kind: 'primary', status: { not: 'archived' } },
    select: { id: true },
  });

  if (primaryThread) {
    redirect(`/chat/${primaryThread.id}`);
  }

  const newestThread = await prisma.thread.findFirst({
    where: { status: { not: 'archived' } },
    orderBy: { lastActivity: 'desc' },
    select: { id: true },
  });

  if (newestThread) {
    redirect(`/chat/${newestThread.id}`);
  }

  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 text-center'>
      <MessageSquare className='h-12 w-12 text-muted-foreground' />
      <div>
        <h2 className='text-lg font-semibold'>Select a thread</h2>
        <p className='text-sm text-muted-foreground'>Choose a thread from the sidebar to view its messages.</p>
      </div>
    </div>
  );
};

export default ChatIndexPage;
