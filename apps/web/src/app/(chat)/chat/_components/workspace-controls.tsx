'use client';

import type { WorkspacePlan } from '@harness/database';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, ScrollArea } from '@harness/ui';
import { Pause, Play, Square, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateWorkspacePlan } from '../_actions/update-workspace-plan';

type PlanTask = {
  id: string;
  title: string;
  status: string;
  dependsOn: string[];
  result: string | null;
  reviewNotes: string | null;
};

type PlanData = {
  tasks: PlanTask[];
};

type WorkspaceControlsProps = {
  plan: WorkspacePlan;
};

type StatusColor = Record<string, string>;

const STATUS_COLORS: StatusColor = {
  pending: 'bg-muted text-muted-foreground',
  delegated: 'bg-blue-500/10 text-blue-500',
  in_review: 'bg-yellow-500/10 text-yellow-500',
  accepted: 'bg-green-500/10 text-green-500',
  rejected: 'bg-red-500/10 text-red-500',
  failed: 'bg-red-500/10 text-red-500',
};

type WorkspaceControlsComponent = (props: WorkspaceControlsProps) => React.ReactNode;

export const WorkspaceControls: WorkspaceControlsComponent = ({ plan }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);

  const planData = plan.planData as unknown as PlanData;
  const tasks = planData?.tasks ?? [];
  const accepted = tasks.filter((t) => t.status === 'accepted').length;
  const total = tasks.length;
  const isActive = plan.status === 'active';
  const isPaused = plan.status === 'paused';
  const isPlanning = plan.status === 'planning';

  const handleStatusChange = (newStatus: string) => {
    startTransition(async () => {
      await updateWorkspacePlan({ planId: plan.id, status: newStatus });
      router.refresh();
    });
  };

  return (
    <>
      <button
        type='button'
        onClick={() => setIsOverviewOpen(true)}
        className='flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2 py-1 text-xs transition-colors hover:bg-muted/60'
      >
        <Target className='h-3 w-3 text-primary' />
        <span className='text-muted-foreground'>{isPlanning ? 'Planning' : `${accepted}/${total}`}</span>
        {isActive && (
          <span className='relative flex h-1.5 w-1.5'>
            <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75' />
            <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500' />
          </span>
        )}
        {isPaused && <Pause className='h-2.5 w-2.5 text-yellow-500' />}
      </button>

      <Dialog open={isOverviewOpen} onOpenChange={setIsOverviewOpen}>
        <DialogContent className='max-w-lg' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Target className='h-4 w-4' />
              Workspace Plan
            </DialogTitle>
          </DialogHeader>

          <div className='flex flex-col gap-4'>
            <div>
              <p className='text-sm font-medium'>Objective</p>
              <p className='text-sm text-muted-foreground'>{plan.objective}</p>
            </div>

            <div className='flex items-center gap-2'>
              <Badge variant='outline' className='text-xs'>
                {plan.status}
              </Badge>
              <span className='text-xs text-muted-foreground'>
                {accepted}/{total} tasks accepted
              </span>
            </div>

            {total > 0 && (
              <div className='relative h-1.5 w-full overflow-hidden rounded-full bg-muted'>
                <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${total > 0 ? (accepted / total) * 100 : 0}%` }} />
              </div>
            )}

            <ScrollArea className='max-h-64'>
              <div className='flex flex-col gap-1.5'>
                {tasks.map((task) => (
                  <div key={task.id} className='flex items-start gap-2 rounded-md border border-border/50 px-3 py-2'>
                    <Badge variant='secondary' className={`mt-0.5 shrink-0 text-[10px] ${STATUS_COLORS[task.status] ?? ''}`}>
                      {task.status}
                    </Badge>
                    <div className='min-w-0 flex-1'>
                      <p className='text-xs font-medium'>
                        {task.id}: {task.title}
                      </p>
                      {task.reviewNotes && <p className='mt-0.5 text-[10px] text-muted-foreground'>{task.reviewNotes}</p>}
                    </div>
                  </div>
                ))}
                {total === 0 && (
                  <p className='py-4 text-center text-xs text-muted-foreground'>No tasks yet. The agent will create a plan when activated.</p>
                )}
              </div>
            </ScrollArea>

            <div className='flex justify-end gap-2 border-t pt-3'>
              {isPlanning && (
                <Button size='sm' onClick={() => handleStatusChange('active')} disabled={isPending}>
                  <Play className='mr-1.5 h-3 w-3' />
                  Activate
                </Button>
              )}
              {isActive && (
                <Button size='sm' variant='outline' onClick={() => handleStatusChange('paused')} disabled={isPending}>
                  <Pause className='mr-1.5 h-3 w-3' />
                  Pause
                </Button>
              )}
              {isPaused && (
                <Button size='sm' onClick={() => handleStatusChange('active')} disabled={isPending}>
                  <Play className='mr-1.5 h-3 w-3' />
                  Resume
                </Button>
              )}
              {(isActive || isPaused || isPlanning) && (
                <Button size='sm' variant='destructive' onClick={() => handleStatusChange('failed')} disabled={isPending}>
                  <Square className='mr-1.5 h-3 w-3' />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
