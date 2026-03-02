'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@harness/ui';
import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteAgent } from '../../chat/_actions/delete-agent';

type AgentCardProps = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  threadCount: number;
};

type AgentCardComponent = (props: AgentCardProps) => React.ReactNode;

export const AgentCard: AgentCardComponent = ({ id, slug, name, enabled, threadCount }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      await deleteAgent(id);
      setConfirmDelete(false);
    });
  };

  const handleEdit = () => {
    router.push(`/agents/${id}`);
  };

  return (
    <Card className='flex flex-col gap-0'>
      <CardHeader className='flex flex-row items-start justify-between gap-4 pb-2'>
        <div className='flex flex-col gap-1 min-w-0'>
          <CardTitle className='text-base font-semibold truncate'>{name}</CardTitle>
          <span className='text-xs text-muted-foreground font-mono'>{slug}</span>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          <Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>
      </CardHeader>
      <CardContent className='flex items-center justify-between gap-4 pt-0'>
        <span className='text-sm text-muted-foreground'>
          {threadCount} {threadCount === 1 ? 'thread' : 'threads'}
        </span>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={handleEdit} className='gap-1.5'>
            <Pencil className='h-3.5 w-3.5' />
            Edit
          </Button>
          <Button variant={confirmDelete ? 'destructive' : 'outline'} size='sm' onClick={handleDelete} disabled={isPending} className='gap-1.5'>
            <Trash2 className='h-3.5 w-3.5' />
            {confirmDelete ? 'Confirm?' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
