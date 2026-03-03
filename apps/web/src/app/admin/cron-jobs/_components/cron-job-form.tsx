'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from '@harness/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { createCronJob } from '../_actions/create-cron-job';
import { updateCronJob } from '../_actions/update-cron-job';

type CronJobFormProps = {
  mode: 'create' | 'edit';
  agents: Array<{ id: string; name: string }>;
  threads: Array<{ id: string; name: string; agentId: string | null }>;
  projects: Array<{ id: string; name: string }>;
  defaultValues?: {
    id?: string;
    name?: string;
    agentId?: string;
    threadId?: string | null;
    projectId?: string | null;
    schedule?: string | null;
    fireAt?: string | null;
    prompt?: string;
    enabled?: boolean;
  };
};

type ScheduleType = 'recurring' | 'one-shot';

type CronJobFormComponent = (props: CronJobFormProps) => React.ReactNode;

const deriveScheduleType = (schedule: string | null | undefined, fireAt: string | null | undefined): ScheduleType => {
  if (fireAt) {
    return 'one-shot';
  }
  return 'recurring';
};

const formatDateTimeLocal = (iso: string | null | undefined): string => {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const CronJobForm: CronJobFormComponent = ({ mode, agents, threads, projects, defaultValues }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(defaultValues?.name ?? '');
  const [agentId, setAgentId] = useState(defaultValues?.agentId ?? '');
  const [threadId, setThreadId] = useState(defaultValues?.threadId ?? '');
  const [projectId, setProjectId] = useState(defaultValues?.projectId ?? '');
  const [scheduleType, setScheduleType] = useState<ScheduleType>(deriveScheduleType(defaultValues?.schedule, defaultValues?.fireAt));
  const [schedule, setSchedule] = useState(defaultValues?.schedule ?? '');
  const [fireAt, setFireAt] = useState(formatDateTimeLocal(defaultValues?.fireAt));
  const [prompt, setPrompt] = useState(defaultValues?.prompt ?? '');
  const [enabled, setEnabled] = useState(defaultValues?.enabled ?? true);

  const filteredThreads = useMemo(() => threads.filter((t) => t.agentId === agentId), [threads, agentId]);

  const handleAgentChange = (value: string) => {
    setAgentId(value);
    // Reset thread when agent changes since threads are filtered by agent
    setThreadId('');
  };

  const handleScheduleTypeChange = (type: ScheduleType) => {
    setScheduleType(type);
    if (type === 'recurring') {
      setFireAt('');
    } else {
      setSchedule('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createCronJob({
          name,
          agentId,
          threadId: threadId || undefined,
          projectId: projectId || undefined,
          schedule: scheduleType === 'recurring' ? schedule : undefined,
          fireAt: scheduleType === 'one-shot' ? fireAt : undefined,
          prompt,
          enabled,
        });

        if ('error' in result) {
          setError(result.error);
          return;
        }

        router.push('/admin/cron-jobs');
      } else {
        const result = await updateCronJob({
          id: defaultValues?.id ?? '',
          name,
          agentId,
          threadId: threadId || null,
          projectId: projectId || null,
          schedule: scheduleType === 'recurring' ? schedule : null,
          fireAt: scheduleType === 'one-shot' ? fireAt : null,
          prompt,
          enabled,
        });

        if ('error' in result) {
          setError(result.error);
          return;
        }

        setSuccess(true);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Create Cron Job' : 'Edit Cron Job'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='flex flex-col gap-6'>
          {error && <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>{error}</p>}
          {success && (
            <p className='rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400'>Cron job updated successfully.</p>
          )}

          {/* Name */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='cron-job-name'>Name</Label>
            <Input
              id='cron-job-name'
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder='e.g. Morning Digest'
              required
            />
          </div>

          {/* Agent + Thread row */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='cron-job-agent'>Agent</Label>
              <Select value={agentId} onValueChange={handleAgentChange}>
                <SelectTrigger id='cron-job-agent'>
                  <SelectValue placeholder='Select an agent' />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='cron-job-thread'>
                Thread
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <Select value={threadId} onValueChange={setThreadId} disabled={!agentId}>
                <SelectTrigger id='cron-job-thread'>
                  <SelectValue placeholder='Select a thread' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__auto__'>Auto-create on first run</SelectItem>
                  {filteredThreads.map((thread) => (
                    <SelectItem key={thread.id} value={thread.id}>
                      {thread.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='cron-job-project'>
              Project
              <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
            </Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id='cron-job-project'>
                <SelectValue placeholder='No project' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Schedule Type Toggle */}
          <div className='flex flex-col gap-1.5'>
            <Label>Type</Label>
            <div className='flex gap-2'>
              <Button
                type='button'
                variant={scheduleType === 'recurring' ? 'default' : 'outline'}
                size='sm'
                onClick={() => handleScheduleTypeChange('recurring')}
              >
                Recurring
              </Button>
              <Button
                type='button'
                variant={scheduleType === 'one-shot' ? 'default' : 'outline'}
                size='sm'
                onClick={() => handleScheduleTypeChange('one-shot')}
              >
                One-shot
              </Button>
            </div>
          </div>

          {/* Schedule (recurring) or Fire At (one-shot) */}
          {scheduleType === 'recurring' ? (
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='cron-job-schedule'>Schedule</Label>
              <Input
                id='cron-job-schedule'
                value={schedule}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSchedule(e.target.value)}
                placeholder='e.g. 0 14 * * * (UTC)'
                required
              />
              <p className='text-xs text-muted-foreground'>
                Cron expression in UTC. Example: <code>0 14 * * *</code> = daily at 14:00 UTC.
              </p>
            </div>
          ) : (
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='cron-job-fire-at'>Fire At</Label>
              <Input
                id='cron-job-fire-at'
                type='datetime-local'
                value={fireAt}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFireAt(e.target.value)}
                required
              />
              <p className='text-xs text-muted-foreground'>The exact date and time to fire this job once.</p>
            </div>
          )}

          <Separator />

          {/* Prompt */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='cron-job-prompt'>Prompt</Label>
            <Textarea
              id='cron-job-prompt'
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
              placeholder='The prompt sent to the agent when this job fires...'
              rows={6}
              required
              className='font-mono resize-y'
            />
          </div>

          {/* Enabled */}
          <div className='flex items-center gap-2'>
            <input
              id='cron-job-enabled'
              type='checkbox'
              checked={enabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnabled(e.target.checked)}
              className='h-4 w-4 rounded border border-input'
            />
            <label htmlFor='cron-job-enabled' className='cursor-pointer text-sm'>
              Enabled
            </label>
          </div>

          {/* Actions */}
          <div className='flex justify-end gap-3'>
            <Button type='button' variant='outline' onClick={() => router.push('/admin/cron-jobs')} disabled={isPending}>
              Cancel
            </Button>
            <Button type='submit' disabled={isPending || !agentId}>
              {isPending ? (mode === 'create' ? 'Creating...' : 'Saving...') : mode === 'create' ? 'Create Job' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
