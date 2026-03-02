'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@harness/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateAgent } from '../../chat/_actions/update-agent';

type AgentFields = {
  id: string;
  name: string;
  slug: string;
  soul: string;
  identity: string;
  role: string | null;
  goal: string | null;
  backstory: string | null;
  enabled: boolean;
  version: number;
};

type EditAgentFormProps = {
  agent: AgentFields;
};

type EditAgentFormComponent = (props: EditAgentFormProps) => React.ReactNode;

export const EditAgentForm: EditAgentFormComponent = ({ agent }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(agent.name);
  const [soul, setSoul] = useState(agent.soul);
  const [identity, setIdentity] = useState(agent.identity);
  const [role, setRole] = useState(agent.role ?? '');
  const [goal, setGoal] = useState(agent.goal ?? '');
  const [backstory, setBackstory] = useState(agent.backstory ?? '');
  const [enabled, setEnabled] = useState(agent.enabled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateAgent({
        id: agent.id,
        name,
        soul,
        identity,
        role: role || null,
        goal: goal || null,
        backstory: backstory || null,
        enabled,
      });

      if ('error' in result) {
        setError(result.error);
        return;
      }

      setSuccess(true);
    });
  };

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <CardTitle>Edit Agent</CardTitle>
        <div className='flex items-center gap-2'>
          <span className='text-xs text-muted-foreground'>v{agent.version}</span>
          <span className='text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded'>{agent.slug}</span>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='flex flex-col gap-6'>
          {error && <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>{error}</p>}
          {success && <p className='rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400'>Agent updated successfully.</p>}

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='edit-agent-name'>Name</Label>
              <Input id='edit-agent-name' value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='edit-agent-enabled'>Status</Label>
              <div className='flex items-center gap-2 h-10'>
                <input
                  id='edit-agent-enabled'
                  type='checkbox'
                  checked={enabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnabled(e.target.checked)}
                  className='h-4 w-4 rounded border border-input'
                />
                <label htmlFor='edit-agent-enabled' className='text-sm cursor-pointer'>
                  Enabled
                </label>
              </div>
            </div>
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='edit-agent-soul'>
              Soul
              <span className='ml-1 text-xs text-muted-foreground'>(SOUL.md content — incrementing version {agent.version + 1} on save)</span>
            </Label>
            <textarea
              id='edit-agent-soul'
              value={soul}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSoul(e.target.value)}
              required
              rows={10}
              className='flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y'
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='edit-agent-identity'>
              Identity
              <span className='ml-1 text-xs text-muted-foreground'>(IDENTITY.md content)</span>
            </Label>
            <textarea
              id='edit-agent-identity'
              value={identity}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIdentity(e.target.value)}
              required
              rows={8}
              className='flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y'
            />
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='edit-agent-role'>
                Role
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <Input id='edit-agent-role' value={role} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole(e.target.value)} />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='edit-agent-goal'>
                Goal
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <Input id='edit-agent-goal' value={goal} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoal(e.target.value)} />
            </div>
            <div className='flex flex-col gap-1.5 sm:col-span-3'>
              <Label htmlFor='edit-agent-backstory'>
                Backstory
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <textarea
                id='edit-agent-backstory'
                value={backstory}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBackstory(e.target.value)}
                rows={4}
                className='flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y'
              />
            </div>
          </div>

          <div className='flex justify-end gap-3'>
            <Button type='button' variant='outline' onClick={() => router.push('/agents')} disabled={isPending}>
              Back to Agents
            </Button>
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
