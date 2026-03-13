'use client';

import { Badge, Button, Card, CardFooter, CardHeader, CardTitle } from '@harness/ui';
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
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div className='flex min-w-0 flex-col gap-1'>
          <CardTitle className='truncate text-base font-semibold'>{name}</CardTitle>
          <span className='font-mono text-xs text-muted-foreground'>{slug}</span>
        </div>
        <Badge variant={enabled ? 'default' : 'secondary'} className='shrink-0'>
          {enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </CardHeader>
      <CardFooter className='justify-between'>
        <span className='text-xs text-muted-foreground'>
          {threadCount} {threadCount === 1 ? 'thread' : 'threads'}
        </span>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={handleEdit} className='gap-1.5'>
            <Pencil className='h-3.5 w-3.5' />
            Edit
          </Button>
          <Button
            variant={confirmDelete ? 'destructive' : 'ghost'}
            size='sm'
            onClick={handleDelete}
            disabled={isPending}
            className={confirmDelete ? 'gap-1.5' : 'gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10'}
          >
            <Trash2 className='h-3.5 w-3.5' />
            {confirmDelete ? 'Confirm?' : 'Delete'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
